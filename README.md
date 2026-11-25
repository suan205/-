# 登录注册后端（FastAPI + SQLite）

一个**后端为主**的登录 / 注册项目：注册、登录、JWT 鉴权、当前用户信息、SQLite 用户存储，附带自动生成的 API 文档、一个可测试全部接口的 HTML 测试页，以及 Windows 一键启动脚本和数据库清空脚本。

项目**不包含最终业务前端页面**。先打开 `/test` 测试接口；自己创建的页面放在 `web/` 下（例如 `web/login.html`），通过 `http://127.0.0.1:8000/web/login.html` 访问。测试页源码是 [web/test.html](web/test.html)，只用于调试接口。接口字段和对接说明见 [API.md](API.md)。

## 功能

- 注册、登录、获取当前登录用户
- 支持用**邮箱或用户名**登录，不区分大小写
- 密码使用 PBKDF2-SHA256（60 万次迭代 + 随机盐）哈希存储，不保存明文
- JWT Bearer Token 鉴权，默认有效期 24 小时
- 用户名、邮箱唯一约束；注册冲突返回明确提示
- 登录 / 注册接口按 IP 限流（默认 20 次/分钟）
- 首次启动自动生成并保存 JWT 密钥，无需手动配置
- Swagger / ReDoc 自动接口文档，可直接在线调试
- 内置 API 测试台（`/test`），覆盖全部接口；自己创建的页面放在 `web/` 下，通过 `/web/文件名.html` 访问
- 使用项目独立的 `.venv`，依赖不装进全局 Python
- 保留常见本地开发地址的 CORS 白名单，便于额外调试
- 直接声明 5 个常用依赖（含 Pydantic 2 版本约束），数据存本地 SQLite，零外部服务

## 快速开始

环境要求：**Python 3.10+**，推荐 **Python 3.12 64 位**（项目测试环境）。

### Windows

双击 [start.bat](start.bat) 即可。脚本会在项目里创建独立的 `.venv`，依赖只装进这个虚拟环境；创建时会调用一次系统 Python，但后端运行固定使用 `.venv\Scripts\python.exe`，不会把依赖装进全局环境。启动后如果 `web/index.html` 有内容，会自动打开 `/web/`；没有或为空时打开 `/test`。

指定端口（CMD 中运行 `start.bat 8080`；PowerShell 中运行 `.\start.bat 8080`）：

```bat
start.bat 8080
```

> macOS / Linux 未提供一键脚本，请参考下方“手动启动”部分。

首次启动会在项目目录创建 `.venv` 并安装依赖，之后一直使用这个虚拟环境。默认使用清华 PyPI 镜像，**首次安装**会显示下载进度，并设置了 60 秒超时和 2 次重试；依赖已满足要求时跳过安装，便于之后断网使用。修改 `requirements.txt` 后会重新检查安装。

启动后：

| 地址 | 说明 |
| --- | --- |
| <http://127.0.0.1:8000/test> | API 测试台（只用于调试接口） |
| <http://127.0.0.1:8000/web/> | 页面首页（`web/index.html` 有内容时，`start.bat` 自动打开） |
| <http://127.0.0.1:8000/web/login.html> | 页面示例地址（页面建好后可访问） |
| <http://127.0.0.1:8000/docs> | Swagger 交互式 API 文档 |
| <http://127.0.0.1:8000/redoc> | ReDoc 风格的 API 文档 |
| <http://127.0.0.1:8000/openapi.json> | OpenAPI 描述文件，可导入 Postman / Apifox |
| <http://127.0.0.1:8000/> | API 信息 JSON（不是网页） |
| <http://127.0.0.1:8000/api/health> | 健康检查 |

> `/test` 是测试页，不是最终登录注册页；自己创建的页面放在 `web/` 下，通过 `/web/文件名.html` 访问。`web/index.html` 有内容时，`start.bat` 会自动打开 `/web/`；没有或为空时打开 `/test`。
>
> 打开 `/` 只会看到 API 信息 JSON；接口字段和调试请用 `/test` 或 `/docs`。
>
> 不想自动打开浏览器时，设置环境变量 `NO_BROWSER=1` 再运行启动脚本。
>
> 一键脚本默认不开启热重载；开发时可在手动启动命令里加 `--reload`，改代码后自动重启。
>
> `/docs` 的 Swagger 静态资源默认从 CDN 加载，完全离线时页面样式可能加载不出来，但接口本身不受影响，可以改看 [API.md](API.md)。

### 手动启动

Windows（PowerShell）：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

如果 `python` 命令不可用，可改用 `py -3.12 -m venv .venv`（把 `3.12` 换成已安装的版本）。

macOS / Linux（手动启动）：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 目录结构

```text
auth-starter/
├─ app/
│  ├─ main.py          # FastAPI 入口、路由、鉴权依赖
│  ├─ config.py        # 环境变量 / .env 配置、密钥管理
│  ├─ database.py      # SQLite 连接与用户表操作
│  ├─ security.py      # 密码哈希、JWT 签发与校验
│  ├─ schemas.py       # Pydantic 请求 / 响应模型
│  └─ rate_limit.py    # 内存 IP 限流
├─ .venv/              # 项目独立虚拟环境（运行时生成，不提交）
├─ data/               # 运行时生成：app.db、secret.key
├─ web/
│  ├─ index.html       # 预留空首页，由学生编写
│  ├─ test.html        # API 测试页（只用于调试接口）
│  ├─ css/
│  │  └─ test.css      # 测试页专用样式
│  └─ js/
│     ├─ api.js        # 通用后端 API 工具（所有页面可复用）
│     └─ test.js       # 测试页专用逻辑
├─ requirements.txt
├─ start.bat           # Windows 一键启动
├─ clear-db.bat        # 清空数据库（删除所有账号）
├─ API.md              # 接口对接文档
├─ .env.example        # 配置模板
└─ README.md
```

## 打包分发

恢复到干净状态、发给别人之前，删除这些运行时内容：

- `.venv/`：虚拟环境和创建它的电脑、Python 小版本绑定，**不能直接拷给别人用**
- `data/`：里面有 `app.db`（账号数据）和 `secret.key`（JWT 密钥），不要分发
- `app/__pycache__/`：Python 缓存，如果存在就删掉
- `.env`：如果自己创建过，可能含本地配置或密钥
- `.tmp/` 或 `pip-*` 临时目录：如果存在就删掉

删完这些，剩下的就是干净的源码，可以压缩整个文件夹发送。

对方拿到后：

1. 安装 Python 3.10+（推荐 3.12 64 位）
2. 解压并双击 `start.bat`
3. 首次启动会自动创建新的 `.venv` 和 `data`，并从默认镜像安装依赖

> 不要为了让对方“开箱即用”而打包 `.venv`：换一台电脑、换一个 Python 小版本或换一个安装路径都可能直接跑不起来。

## API 一览

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | 否 | 注册，成功直接返回 Token |
| `POST` | `/api/auth/login` | 否 | 登录，返回 Token |
| `GET` | `/api/auth/me` | Bearer | 获取当前用户信息 |
| `GET` | `/api/health` | 否 | 健康检查 |
| `GET` | `/` | 否 | API 信息 JSON |

详细请求字段、响应示例、错误码和 JavaScript `fetch` 示例见 **[API.md](API.md)**；也可以启动后直接打开 `/docs`，点 “Try it out” 调试。

## 配置

复制 `.env.example` 为 `.env` 后修改（可选，全部有默认值）：

```bash
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SECRET_KEY` | 自动生成 | JWT 签名密钥；留空时自动生成到 `data/secret.key` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 有效期（分钟） |
| `DATABASE_PATH` | `data/app.db` | SQLite 文件路径，相对路径基于项目根目录 |
| `CORS_ORIGINS` | 本地 5500 / 5501 / 5173 / 3000 | 允许跨域的前端地址，逗号分隔 |
| `RATE_LIMIT_PER_MINUTE` | `20` | 每个 IP 每分钟登录 / 注册次数，`0` 关闭 |
| `DATA_DIR` | `data` | 数据目录（一般不用改） |

修改 `.env` 后重启服务生效。环境变量优先级高于 `.env`。

> 兼容提示：当前版本新增数据库重置标识：**新增校验前签发的 Token** 在升级后会失效一次，重新登录即可，账号数据不会删除。正常重启不会让当前版本签发的未过期 Token 失效。

## 数据库

位置：默认 `data/app.db`，首次启动自动建表。若只设置 `DATA_DIR` 而未设置 `DATABASE_PATH`，数据库默认位于该数据目录内；显式设置 `DATABASE_PATH` 时以它为准。除下面的用户表外，另有内部 `auth_state` 表保存数据库重置标识，前端无需操作。用户表结构：

| 字段 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| `id` | INTEGER | 主键，自增 |
| `username` | TEXT | 必填，唯一，不区分大小写 |
| `email` | TEXT | 必填，唯一，不区分大小写；入库前转小写 |
| `password_hash` | TEXT | 必填；PBKDF2-SHA256 哈希，不存明文 |
| `created_at` | TEXT | 必填；UTC 时间，ISO 8601 字符串 |

- 清空所有账号：**先停止后端**（在运行窗口按 Ctrl+C），再双击 [clear-db.bat](clear-db.bat)，按提示输入 `YES` 确认。脚本复用后端配置，显示并删除实际 `DATABASE_PATH` 对应的数据库及 WAL / SHM / journal 文件，保留 `secret.key`；下次启动自动创建空数据库。数据库内的重置标识会重新生成，使旧 Token 失效，即使配置了固定 `SECRET_KEY` 也一样。脚本使用项目 `.venv`，请先运行过 `start.bat`。
- 也可以在**停止后端后**手动删除配置的数据库及同目录的 `-wal`、`-shm`、`-journal` 附属文件，再重新启动。默认数据库是 `data/app.db`；若改过 `DATABASE_PATH`，以实际配置为准。
- 密码是单向哈希，忘记密码无法找回；本项目未包含重置密码流程。

## 前端对接要点

1. **先跑测试页**：启动后打开 `/test`，点“测试核心流程”，观察健康检查、注册、登录、获取用户四个步骤的请求和返回。测试台独立保存 Token，不会覆盖学生网站的 `access_token`。注册与登录共用每 IP 每分钟 20 次额度，一次核心流程消耗 2 次；遇到 429 按提示等待后再试。
2. **先写首页**：在预留的 `web/index.html` 空文件中编写网站首页（不存在时再新建），放“登录”“注册”两个按钮，分别链接到 `login.html` 和 `register.html`；再建 `login.html`、`register.html`、`dashboard.html`。不要直接复制 `test.html` 当成品。页面通过 `/web/index.html`（或 `/web/`）访问；通用请求封装在 [web/js/api.js](web/js/api.js)，测试页自己的逻辑在 [web/js/test.js](web/js/test.js)。
3. **后端地址**：默认 `http://127.0.0.1:8000`，接口统一以 `/api` 开头；页面和 API 由同一服务提供，自定义端口时一起变化，仍然同源。
4. **运行方式**：双击 `start.bat`；不要用 `file://`，也不需要 Live Server。所有自己创建的页面都通过该服务的 `/web/` 地址访问。
5. **页面目录**：HTML/CSS/JS 都放在 `web/` 下；`web/index.html` 有内容后，`start.bat` 会自动打开 `/web/` 作为首页。
6. **Token**：登录 / 注册成功后把 `access_token` 存起来（`localStorage` 或 `sessionStorage`），之后请求 `GET /api/auth/me` 时加请求头 `Authorization: Bearer <access_token>`。
7. **退出登录**：JWT 是无状态的，前端删除本地 Token 即可，后端不需要额外接口。
8. **错误处理**：业务错误和字段校验错误使用 `detail` 字段；字段校验错误时它是数组。网络故障或未处理的服务端异常不保证有此格式，前端应保留通用错误提示。

> 如果你自己用 Live Server 做额外调试，才需要处理 CORS；按作业要求用 `start.bat` 时页面和 API 同源，不需要。默认的 CORS 白名单仍然保留。

完整说明和 `fetch` 示例见 [API.md](API.md)。

## 生产部署注意

这是面向学习 / 原型的最小实现，上线前建议至少处理：

1. **HTTPS**：通过 Nginx / Caddy 等反向代理加证书，不要明文暴露。
2. **固定 `SECRET_KEY`**：生产环境显式设置环境变量，并妥善保管；更换密钥会让所有已签发 Token 失效。
3. **数据库**：SQLite 适合单机和小流量；并发更高时换成 PostgreSQL / MySQL，并引入迁移工具（如 Alembic）。
4. **限流**：当前是单进程内存实现，多 worker / 多实例下请换成 Redis 等共享存储。
5. **启动参数**：生产环境不要使用 `--reload`，用 `uvicorn app.main:app --host 0.0.0.0 --port 8000` 配合进程守护。
6. **CORS**：把 `CORS_ORIGINS` 收紧到真实前端域名。
7. **功能补齐**：邮箱验证、找回密码、Refresh Token / 主动吊销、登录审计等。
8. **前端令牌存储**：后端只负责签发 JWT；前端可以存 `localStorage` / `sessionStorage`。生产环境建议改用 HttpOnly Cookie + CSRF 防护，并做好 XSS 防御。

## 验证范围

接口流程、数据库重置行为和前端脚本已通过隔离测试。教师已实测确认 Windows 下 BAT 双击首次安装、自动打开浏览器及真实浏览器交互正常。首次安装需要联网下载依赖；运行 `clear-db.bat` 前务必先在后端窗口按 Ctrl+C 停止服务。

## 常见问题

**端口被占用**：换一个端口启动，例如 `start.bat 8080`。

**`python` 命令不可用**：安装 Python 时勾选 “Add Python to PATH”，或使用 `py -3`；`start.bat` 会自动尝试多种方式。

**依赖安装失败**：检查网络或代理，然后删除 `.venv` 目录重新运行 `start.bat`。本项目固定使用项目内的 `.venv`，不会回退到全局 Python；请不要直接用全局 `python` 启动后端。

脚本默认使用清华镜像。如果有更快的镜像，可以在运行前设置 `PIP_INDEX_URL`，脚本会优先使用它：

```bat
set PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
start.bat
```

想换回官方源：

```bat
set PIP_INDEX_URL=https://pypi.org/simple
start.bat
```

如果只是手动排查，先激活虚拟环境再运行：

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**浏览器提示 CORS 错误**：按作业要求用 `start.bat`，页面和 API 同源（包括一起改端口），无需配置 CORS。如果额外用 Live Server 调试，除了将其来源加入白名单，还需把请求地址改为完整后端地址；现有 `api.js` 的相对地址会指向 Live Server。建议直接使用 `/web/文件名.html`。

**接口返回 401**：检查请求头是否为 `Authorization: Bearer <token>`，以及 Token 是否过期（默认 24 小时）。
