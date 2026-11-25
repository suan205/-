/**
 * 注册页逻辑（web/js/register.js）
 * 调用 POST /api/auth/register，成功后保存 Token 并进入主页。
 */

import { registerUser } from "./api.js";
import { getToken, saveToken, loadCurrentUser, clearToken } from "./auth.js";

const form = document.getElementById("register-form");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm");
const submitBtn = document.getElementById("register-btn");
const tip = document.getElementById("register-tip");
const peek = document.getElementById("peek");

const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setTip(message, type = "") {
  tip.textContent = message;
  tip.className = "form-tip" + (type ? " " + type : "");
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? "注册中…" : "注 册";
}

peek.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  peek.textContent = isPassword ? "隐藏" : "显示";
});

// 已登录时直接去主页
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

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  // 与后端规则保持一致的本地预检查
  if (!USERNAME_RE.test(username)) {
    setTip("用户名需为 3-32 位，只能包含字母、数字和下划线。", "error");
    usernameInput.focus();
    return;
  }
  if (!EMAIL_RE.test(email)) {
    setTip("请输入正确的邮箱地址。", "error");
    emailInput.focus();
    return;
  }
  if (password.length < 8 || password.length > 128) {
    setTip("密码长度需在 8-128 位之间。", "error");
    passwordInput.focus();
    return;
  }
  if (password !== confirm) {
    setTip("两次输入的密码不一致。", "error");
    confirmInput.focus();
    return;
  }

  setBusy(true);
  setTip("正在创建账号，请稍候…");

  try {
    const data = await registerUser({ username, email, password });
    saveToken(data.access_token);
    setTip("注册成功，正在进入主页…", "ok");
    location.replace("dashboard.html");
  } catch (error) {
    setBusy(false);
    if (!error || !error.status) {
      setTip("连不上后端：请确认已双击 start.bat 启动服务，再刷新本页重试。", "error");
      return;
    }
    if (error.status === 409) {
      setTip(error.message || "用户名或邮箱已被注册。", "error");
      return;
    }
    if (error.status === 422) {
      setTip(error.message || "填写内容不符合要求，请检查后再提交。", "error");
      return;
    }
    if (error.status === 429) {
      setTip(error.message || "请求过于频繁，请稍后再试。", "error");
      return;
    }
    setTip(error.message || "注册失败，请稍后重试。", "error");
  }
});
