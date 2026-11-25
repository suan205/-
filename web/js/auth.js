/**
 * 登录状态工具（web/js/auth.js）
 * 只负责本地 Token 的读写和 /api/auth/me 校验，不直接接触数据库。
 */

import { getCurrentUser } from "./api.js";

export const TOKEN_KEY = "access_token";

/** 读取本地 Token，读不到返回空字符串 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

/** 保存 Token */
export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    /* 极少数浏览器禁用 localStorage，这里静默失败即可 */
  }
}

/** 清除本地 Token（退出登录） */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    /* ignore */
  }
}

/** 跳回登录页；用 replace 避免在历史记录里留下受保护页面 */
export function goLogin() {
  location.replace("login.html");
}

/**
 * 校验当前登录状态。
 * 返回 { user, reason }，reason 取值：ok / no-token / 401 / error
 */
export async function loadCurrentUser() {
  const token = getToken();
  if (!token) return { user: null, reason: "no-token", token: "" };

  try {
    const user = await getCurrentUser(token);
    return { user, reason: "ok", token };
  } catch (error) {
    if (error && error.status === 401) {
      clearToken();
      return { user: null, reason: "401", error };
    }
    return { user: null, reason: "error", error, token };
  }
}

/** Token 摘要显示，只用于页面展示，不暴露完整 Token */
export function maskToken(token) {
  if (!token) return "—";
  if (token.length <= 20) return token;
  return token.slice(0, 10) + "…" + token.slice(-6);
}

/** 把后端返回的 UTC 时间转成本地可读时间 */
export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { hour12: false });
}
