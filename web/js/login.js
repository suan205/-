/**
 * 登录页逻辑（web/js/login.js）
 * 调用 POST /api/auth/login，成功后保存 Token 并进入主页。
 */

import { loginUser } from "./api.js";
import { getToken, saveToken, loadCurrentUser, clearToken } from "./auth.js";

const form = document.getElementById("login-form");
const accountInput = document.getElementById("account");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("login-btn");
const tip = document.getElementById("login-tip");
const peek = document.getElementById("peek");

function setTip(message, type = "") {
  tip.textContent = message;
  tip.className = "form-tip" + (type ? " " + type : "");
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? "登录中…" : "登 录";
}

// 密码显示 / 隐藏
peek.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  peek.textContent = isPassword ? "隐藏" : "显示";
});

// 已经登录过的话，直接进入主页
(async function checkLogged() {
  if (!getToken()) return;
  const result = await loadCurrentUser();
  if (result.user) {
    location.replace("dashboard.html");
  } else if (result.reason === "401") {
    clearToken();
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const account = accountInput.value.trim();
  const password = passwordInput.value;

  if (!account) {
    setTip("请先填写用户名或邮箱。", "error");
    accountInput.focus();
    return;
  }
  if (!password) {
    setTip("请填写密码。", "error");
    passwordInput.focus();
    return;
  }

  setBusy(true);
  setTip("正在连接后端，请稍候…");

  try {
    const data = await loginUser({ account, password });
    saveToken(data.access_token);
    setTip("登录成功，正在进入主页…", "ok");
    location.replace("dashboard.html");
  } catch (error) {
    setBusy(false);
    if (!error || !error.status) {
      setTip("连不上后端：请确认已双击 start.bat 启动服务，再刷新本页重试。", "error");
      return;
    }
    if (error.status === 429) {
      setTip(error.message || "请求过于频繁，请稍后再试。", "error");
      return;
    }
    setTip(error.message || "登录失败，请稍后重试。", "error");
  }
});
