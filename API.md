# 登录注册 API 对接文档

前后端对接说明。后端已经实现好，前端只需要按本文档调用接口。

## 基本信息

| 项目 | 值 |
| --- | --- |
| 后端地址 | `http://127.0.0.1:8000` |
| 接口前缀 | `/api` |
| 数据格式 | JSON，请求头 `Content-Type: application/json` |
| 鉴权方式 | `Authorization: Bearer <access_token>` |
| API 测试台 | <http://127.0.0.1:8000/test> |
| 页面示例 | `http://127.0.0.1:8000/web/login.html` |
| Swagger 文档 | <http://127.0.0.1:8000/docs> |
| ReDoc 文档 | <http://127.0.0.1:8000/redoc> |
| OpenAPI 文件 | <http://127.0.0.1:8000/openapi.json> |

> 打开 `/docs` 后可以直接点 “Try it out” 调接口，不需要写前端也能先验证后端。

## 推荐先看测试页

启动后端后打开 <http://127.0.0.1:8000/test>，这是一个已经写好的 API 测试台：

> `start.bat` 启动时会检测 `web/index.html`：有内容就优先打开 `/web/`，没有或为空才打开 `/test`。测试页仍然可以手动访问 `/test`。

- 可以单独测试健康检查、注册、登录、获取当前用户、API 信息。
- 点“测试核心流程”会自动按顺序执行 健康检查 → 注册 → 登录 → 获取用户，并保留四步请求与响应（请求中的密码和 Token 已隐藏）。
- 注册 / 登录成功后会自动保存 Token，右侧会显示每次请求的 HTTP 状态和 JSON 响应。
- 测试页源码在 `web/test.html`，只用于调试接口；通用 API 封装在 `web/js/api.js`，测试页专用逻辑在 `web/js/test.js`。确认接口没问题后，填写预留的 `web/index.html` 空首页（不存在时再新建，放登录 / 注册入口），再建 `login.html`、`register.html`、`dashboard.html`，通过 `/web/` 或 `/web/login.html` 访问；不要直接复制测试页当成品。

## 认证流程

1. 用户填写注册表单，前端调用 `POST /api/auth/register`。
2. 注册成功返回 `access_token` 和用户信息，前端保存 Token。
3. 已有账号调用 `POST /api/auth/login`，同样返回 `access_token`。
4. 之后访问需要登录的接口时，在请求头带 `Authorization: Bearer <access_token>`。
5. 退出登录时前端删除本地 Token 即可（JWT 无状态，后端没有 logout 接口）。

Token 默认有效期 **24 小时**（1440 分钟），过期后需要重新登录。新增数据库重置校验前签发的 Token 在升级后会失效一次，重新登录即可，已有账号和密码不受影响。清空数据库会删除账号并使旧 Token 失效；必须先在后端窗口按 Ctrl+C 停服，再运行 `clear-db.bat`，完成后重新启动服务。

## CORS 与本地前端

> 本作业统一用 `start.bat` 运行，页面放在 `web/` 下，通过 `http://127.0.0.1:8000/web/文件名.html` 访问；页面和 API 同源，不需要 Live Server，也不会有 CORS 问题。下面的 CORS 配置只在你自行用 Live Server 额外调试时参考。

后端默认允许这些前端地址跨域访问：

```text
http://localhost:5500
http://127.0.0.1:5500
http://localhost:5501
http://127.0.0.1:5501
http://localhost:5173
http://127.0.0.1:5173
http://localhost:3000
http://127.0.0.1:3000
```

- **不要直接双击 HTML 文件**（地址栏是 `file://...`），浏览器会把它当成特殊来源，跨域请求会被拦截。
- 作业要求用 `start.bat`，页面在 8000 下；只有你额外用 Live Server 调试时，才用 5500 启动并依赖下面的 CORS 白名单。
- 如果坚持用 Live Server，现有 `web/js/api.js` 的相对请求地址会指向 Live Server，而不是后端；还需自行改为完整后端地址。只配置 CORS 并不足够，因此本作业不推荐这种方式。
- 仅当前端与后端分开运行、且前端换了来源时，才把完整地址（包含 `http://`）写进后端 `.env` 的 `CORS_ORIGINS`，例如：

```env
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080
```

修改后重启后端。跨域请求带 `Authorization` 或 `Content-Type: application/json` 时，浏览器通常会先发 `OPTIONS` 预检，后端已经处理；同源请求不需要 CORS 预检。

## 接口详情

### 1. 注册

`POST /api/auth/register`

请求体：

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `username` | string | 是 | 3-32 位，只能包含字母、数字、下划线 |
| `email` | string | 是 | 合法邮箱，后端会转成小写存储 |
| `password` | string | 是 | 8-128 位 |

请求示例：

```json
{
  "username": "alice_01",
  "email": "alice@example.com",
  "password": "secret123"
}
```

成功响应 `201 Created`：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": 1,
    "username": "alice_01",
    "email": "alice@example.com",
    "created_at": "2026-11-12T15:02:35Z"
  }
}
```

常见错误：

| 状态码 | `detail` 示例 | 原因 |
| --- | --- | --- |
| `409` | `该用户名已被使用` | 用户名重复（不区分大小写） |
| `409` | `该邮箱已被注册` | 邮箱重复（不区分大小写） |
| `422` | 校验错误数组 | 字段格式不符合规则 |
| `429` | `请求过于频繁，请 x 秒后再试` | 触发 IP 限流 |

### 2. 登录

`POST /api/auth/login`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `account` | string | 是 | 邮箱或用户名，不区分大小写；邮箱使用与注册相同的规范化规则 |
| `password` | string | 是 | 注册时的密码 |

请求示例：

```json
{
  "account": "alice@example.com",
  "password": "secret123"
}
```

成功响应 `200 OK`，结构同注册响应（`access_token` + `user`）。

失败响应 `401 Unauthorized`：

```json
{
  "detail": "邮箱/用户名或密码错误"
}
```

> 为了不泄露账号是否存在，邮箱不存在和密码错误返回同一句提示。

### 3. 获取当前用户

`GET /api/auth/me`

请求头：

```http
Authorization: Bearer <access_token>
```

成功响应 `200 OK`：

```json
{
  "id": 1,
  "username": "alice_01",
  "email": "alice@example.com",
  "created_at": "2026-11-12T15:02:35Z"
}
```

Token 缺失、伪造或过期时返回 `401`：

```json
{
  "detail": "登录状态无效或已过期，请重新登录"
}
```

### 4. 健康检查

`GET /api/health`

```json
{
  "status": "ok"
}
```

### 5. API 信息

`GET /`

```json
{
  "name": "登录注册 API",
  "version": "1.0.0",
  "docs": "/docs",
  "redoc": "/redoc",
  "openapi": "/openapi.json",
  "health": "/api/health",
  "test": "/test"
}
```

## 错误响应格式

以下格式适用于业务错误和请求校验错误；网络故障或未处理的 500 异常不保证返回 JSON 或 `detail`，应提供通用错误提示。

业务错误（401 / 409 / 429 等）：

```json
{
  "detail": "该邮箱已被注册"
}
```

字段校验错误（422）：`detail` 是数组，每个元素包含 `type`、`loc`、`msg` 等字段：

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "password"],
      "msg": "String should have at least 8 characters",
      "ctx": { "min_length": 8 }
    }
  ]
}
```

前端可以这样取提示：

```js
const message =
  (typeof data?.detail === "string" ? data.detail : data?.detail?.[0]?.msg)
  || "请求失败";
```

## 复用现有 API 工具（推荐）

无需复制下面的请求封装。以 `web/login.html` 为例，在 HTML 中使用模块脚本：

```html
<script type="module">
  import { loginUser } from "./js/api.js";
  // 在自己的表单提交事件里调用 loginUser({ account, password })。
</script>
```

如果把脚本写在 `web/js/login.js` 中，引入路径应为 `./api.js`；HTML 用 `<script type="module" src="./js/login.js"></script>` 加载它。相对引入路径是相对于当前脚本文件，而不是 HTML 文件。

测试台使用独立的 `api_test_access_token` 存储键；学生网站使用 `access_token`，互不覆盖。Token 是否有效，应通过 `/api/auth/me` 判断，而不是只检查本地有没有字符串。

现有 `web/js/api.js` 会在 15 秒后中止仍未完成的请求（包括读取响应），抛出 `status` 为 `0` 的 `ApiError`，测试台会恢复操作。超时不代表服务端已取消处理；注册超时后可先尝试登录，避免重复提交。

默认注册与登录**共用**每 IP 每分钟 20 次额度，一次核心流程消耗 2 次。遇到 429，等待提示的秒数再试。

## JavaScript `fetch` 示例

下面只是请求封装示例，页面结构、样式和交互由你自己完成。测试页 `web/test.html` 里也用了同样的调用方式，可以直接参考或复用。

```js
const API_BASE = ""; // 与当前页面同源，自动跟随 start.bat 指定的端口

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message =
      (typeof detail === "string" ? detail : detail?.[0]?.msg)
      || `请求失败（HTTP ${response.status}）`;
    throw new Error(message);
  }
  return data;
}
```

登录并保存 Token：

```js
const auth = await api("/api/auth/login", {
  method: "POST",
  body: {
    account: emailOrUsername,
    password,
  },
});
localStorage.setItem("access_token", auth.access_token);
```

获取当前用户：

```js
const user = await api("/api/auth/me", {
  token: localStorage.getItem("access_token"),
});
```

退出登录：

```js
localStorage.removeItem("access_token");
```

## 数据库结构

后端使用 SQLite，启动时自动建表，使用时无需手动建库。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | INTEGER | 主键，自增 |
| `username` | TEXT | 唯一，不区分大小写 |
| `email` | TEXT | 唯一，不区分大小写，入库前转小写 |
| `password_hash` | TEXT | PBKDF2-SHA256 哈希，不保存明文 |
| `created_at` | TEXT | UTC 时间，ISO 8601 字符串 |

## 对接检查清单

- [ ] 后端已启动，`/api/health` 返回 `{"status":"ok"}`
- [ ] 已打开 `/test` 并跑通“健康检查 → 注册 → 登录 → 获取用户”
- [ ] 前端通过 `start.bat` 启动的 `/web/` 地址访问，不使用 Live Server 或 `file://`
- [ ] 注册成功，能拿到 `access_token`
- [ ] 登录成功后保存 Token
- [ ] `/api/auth/me` 请求头包含 `Authorization: Bearer ...`
- [ ] 退出登录会删除本地 Token
- [ ] 401、409、422、429 都有对应提示
- [ ] 刷新页面后能恢复登录状态（重新读取 Token 并调用 `/api/auth/me`）
