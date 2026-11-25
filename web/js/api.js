/**
 * 通用后端 API 工具（web/js/api.js）
 *
 * 页面和 API 由同一个服务提供，相对请求地址会自动跟随页面的主机和端口。
 * 测试页只负责 UI；真正的请求都走这个文件里的函数。
 */

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function extractMessage(data, status) {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data.detail === "string") return data.detail;
  if (data && Array.isArray(data.detail) && data.detail.length) {
    return data.detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const loc = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
        return loc ? loc + "：" + item.msg : item.msg;
      })
      .join("；");
  }
  if (data && typeof data.message === "string") return data.message;
  return "请求失败（HTTP " + status + "）";
}

/**
 * 通用请求函数。
 * @param {string} path 例如 /api/auth/login
 * @param {object} options { method, body, token, onResult }
 *   onResult 会在请求结束时收到 { method, path, request, status, ok, ms, data, message }，
 *   测试页用它来更新右侧结果面板；普通业务页面可以不传。
 */
export async function request(path, { method = "GET", body, token, onResult } = {}) {
  const started = performance.now();
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  const safeHeaders = { ...headers };
  if (token) safeHeaders.Authorization = "Bearer <已隐藏 Token>";
  const safeBody = body === undefined ? undefined : { ...body };
  if (safeBody && "password" in safeBody) safeBody.password = "<已隐藏密码>";
  const requestInfo = { headers: safeHeaders, body: safeBody };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  let text;
  try {
    response = await fetch(path, {
      signal: controller.signal,
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await response.text();
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    const info = {
      method,
      path,
      request: requestInfo,
      status: 0,
      ok: false,
      ms,
      data: null,
      message: controller.signal.aborted
        ? "请求超时（15 秒），请确认后端正常后重试。"
        : "连接后端失败或响应读取中断，请确认服务和网络正常后重试。",
    };
    if (typeof onResult === "function") onResult(info);
    throw new ApiError(info.message, 0, null);
  } finally {
    clearTimeout(timeout);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  const ms = Math.round(performance.now() - started);
  const message = response.ok ? "" : extractMessage(data, response.status);
  const info = {
    method,
    path,
    request: requestInfo,
    status: response.status,
    ok: response.ok,
    ms,
    data,
    message,
  };

  if (typeof onResult === "function") onResult(info);
  if (!response.ok) {
    throw new ApiError(message, response.status, data);
  }
  return data;
}

/* ---------------------------- 所有后端接口 ---------------------------- */

export function getHealth(options = {}) {
  return request("/api/health", options);
}

export function getApiInfo(options = {}) {
  return request("/", options);
}

export function registerUser({ username, email, password }, options = {}) {
  return request("/api/auth/register", {
    ...options,
    method: "POST",
    body: { username, email, password },
  });
}

export function loginUser({ account, password }, options = {}) {
  return request("/api/auth/login", {
    ...options,
    method: "POST",
    body: { account, password },
  });
}

export function getCurrentUser(token, options = {}) {
  return request("/api/auth/me", { ...options, token });
}
