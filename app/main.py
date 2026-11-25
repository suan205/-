"""FastAPI 应用入口：注册、登录与当前用户信息。"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import EmailStr, TypeAdapter, ValidationError

from . import database
from .config import BASE_DIR, settings
from .rate_limit import rate_limit
from .schemas import AuthResponse, LoginRequest, RegisterRequest, UserOut
from .security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger("uvicorn.error")

WEB_DIR = BASE_DIR / "web"
bearer_scheme = HTTPBearer(auto_error=False)
email_adapter = TypeAdapter(EmailStr)


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    logger.info("SQLite 数据库：%s", settings.database_path)
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "一个基于 FastAPI + SQLite 的登录注册后端示例。"
        "支持注册、登录、JWT 鉴权和限流，API 文档可直接在 /docs 调试；"
        "/test 是接口测试页，前端页面放在 web/ 下，通过 /web/文件名.html 访问。"
    ),
    version="1.0.0",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 自己创建的页面放在 web/ 目录，通过 /web/文件名.html 访问；这样 start.bat 即可运行多页面。
app.mount("/web", StaticFiles(directory=WEB_DIR, html=True), name="web")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    """隐藏校验错误中的原始输入，避免把密码等字段回显给客户端。"""
    errors = [
        {key: value for key, value in error.items() if key not in {"input", "url"}}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(errors)},
    )


def _user_out(row: sqlite3.Row) -> UserOut:
    return UserOut(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        created_at=row["created_at"],
    )


def _auth_response(row: sqlite3.Row) -> AuthResponse:
    token, expires_in = create_access_token(row["id"])
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user=_user_out(row),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> sqlite3.Row:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录状态无效或已过期，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized

    user = database.get_user_by_id(user_id)
    if user is None:
        raise unauthorized
    return user


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    """API 根路径：返回文档、OpenAPI 描述和健康检查入口。"""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/api/health",
        "test": "/test",
    }


@app.get("/test", include_in_schema=False)
@app.get("/test/", include_in_schema=False)
def api_test_page() -> FileResponse:
    """API 测试页（只用于调试接口），修改 web/test.html 后刷新即可。"""
    return FileResponse(
        WEB_DIR / "test.html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/health", tags=["系统"], summary="健康检查")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["认证"],
    summary="注册新用户",
    dependencies=[Depends(rate_limit)],
)
def register(payload: RegisterRequest) -> AuthResponse:
    email = str(payload.email).strip().lower()
    username = payload.username

    if database.username_exists(username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="该用户名已被使用"
        )
    if database.email_exists(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="该邮箱已被注册"
        )

    user = database.create_user(username, email, hash_password(payload.password))
    if user is None:
        # 并发注册时由唯一索引兜底。
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="用户名或邮箱已被注册"
        )
    return _auth_response(user)


@app.post(
    "/api/auth/login",
    response_model=AuthResponse,
    tags=["认证"],
    summary="登录",
    dependencies=[Depends(rate_limit)],
)
def login(payload: LoginRequest) -> AuthResponse:
    account = payload.account.strip()
    if "@" in account:
        try:
            account = str(email_adapter.validate_python(account)).lower()
        except ValidationError:
            account = ""
    user = database.get_user_by_account(account) if account else None

    if user is None:
        # 保持与“密码错误”相近的耗时，降低账号枚举风险。
        verify_password(payload.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱/用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱/用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _auth_response(user)


@app.get(
    "/api/auth/me",
    response_model=UserOut,
    tags=["认证"],
    summary="获取当前登录用户",
)
def me(current_user: sqlite3.Row = Depends(get_current_user)) -> UserOut:
    return _user_out(current_user)
