/**
 * 个人主页逻辑（web/js/dashboard.js）
 * 进入页面先校验 Token，用户名等信息全部来自 GET /api/auth/me。
 */

import { getCurrentUser } from "./api.js";
import { getToken, clearToken, goLogin, maskToken, formatTime } from "./auth.js";


const nameEl = document.getElementById("username");
const stateEl = document.getElementById("state");
const tipEl = document.getElementById("dash-tip");
const refreshBtn = document.getElementById("refresh-btn");
const logoutBtn = document.getElementById("logout-btn");

const infoUsername = document.getElementById("info-username");
const infoEmail = document.getElementById("info-email");
const infoId = document.getElementById("info-id");
const infoCreated = document.getElementById("info-created");
const infoToken = document.getElementById("info-token");

function setState(message, type = "") {
  stateEl.textContent = message;
  stateEl.className = "dash-sub" + (type ? " " + type : "");
}

function setTip(message, type = "") {
  tipEl.textContent = message;
  tipEl.className = "form-tip" + (type ? " " + type : "");
}

/** 把用户信息渲染到页面上 */
function render(user) {
  
  nameEl.textContent = user.username;

  infoUsername.textContent = user.username;
  infoEmail.textContent = user.email;
  infoId.textContent = "#" + user.id;
  infoCreated.textContent = formatTime(user.created_at);
  infoToken.textContent = maskToken(getToken());

  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  setState(`登录状态有效，最近一次校验：${now}`, "ok");
}

/** 校验失败时统一处理：401 直接回登录页，其他只提示 */
function handleAuthError(error) {
  if (error && error.status === 401) {
    clearToken();
    setState("登录状态已失效，正在返回登录页…", "error");
    location.replace("login.html");
    return true;
  }
  return false;
}

async function loadUser({ silent = false } = {}) {
  const token = getToken();

  // 本地没有 Token，无需请求后端，直接回登录页
  if (!token) {
    setState("本地没有 Token，正在返回登录页…");
    goLogin();
    return null;
  }

  if (!silent) setState("正在通过 /api/auth/me 校验登录状态…");

  try {
    const user = await getCurrentUser(token);
    render(user);
    if (!silent) setTip("");
    return user;
  } catch (error) {
    if (handleAuthError(error)) return null;

    // status 为 0：断网 / 服务未启动 / 超时
    setState("读取用户信息失败：请确认后端已经启动。", "error");
    setTip(
      error && error.status
        ? "接口返回异常：" + (error.message || "未知错误")
        : "连不上后端，请双击 start.bat 启动服务后点“重新校验”。",
      "error"
    );
    return null;
  }
}

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "校验中…";
  setTip("");
  await loadUser();
  refreshBtn.disabled = false;
  refreshBtn.textContent = "重新校验";
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  setState("已退出登录，正在返回登录页…");
  setTimeout(() => location.replace("login.html"), 120);
});

// 页面加载（含刷新）时立刻校验一次
loadUser();
