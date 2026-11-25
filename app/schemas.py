"""请求 / 响应模型。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=32,
        pattern=r"^[A-Za-z0-9_]+$",
        description="3-32 位字母、数字或下划线",
        examples=["alice_01"],
    )
    email: EmailStr = Field(..., description="有效邮箱地址", examples=["alice@example.com"])
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="至少 8 位",
        examples=["secret123"],
    )


class LoginRequest(BaseModel):
    account: str = Field(
        ...,
        min_length=1,
        max_length=254,
        description="邮箱或用户名",
        examples=["alice@example.com"],
    )
    password: str = Field(..., min_length=1, max_length=128, examples=["secret123"])


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="访问令牌有效期（秒）")
    user: UserOut
