/**
 * 测试页专用逻辑（web/js/test.js）
 *
 * 这里只做测试页的 DOM 交互；真正的后端请求全部来自 ./api.js。
 */

import {
  getHealth,
  getApiInfo,
  registerUser,
  loginUser,
  getCurrentUser,
} from "./api.js";

const TOKEN_KEY = "api_test_access_token";

const els = {
  healthDot: document.getElementById("health-dot"),
  healthText: document.getElementById("health-text"),
  apiBaseDisplay: document.getElementById("api-base-display"),
  tokenStatus: document.getElementById("token-status"),
  docsLink: document.getElementById("docs-link"),
  toast: document.getElementById("toast"),
  btnHealth: document.getElementById("btn-health"),
  btnRoot: document.getElementById("btn-root"),
  registerForm: document.getElementById("register-form"),
  regUsername: document.getElementById("reg-username"),
  regEmail: document.getElementById("reg-email"),
  regPassword: document.getElementById("reg-password"),
  btnRandom: document.getElementById("btn-random"),
  loginForm: document.getElementById("login-form"),
  loginAccount: document.getElementById("login-account"),
  loginPassword: document.getElementById("login-password"),
  btnMe: document.getElementById("btn-me"),
  tokenInput: document.getElementById("token-input"),
  btnCopyToken: document.getElementById("btn-copy-token"),
  btnClearToken: document.getElementById("btn-clear-token"),
  btnRunAll: document.getElementById("btn-run-all"),
  flowSteps: document.getElementById("flow-steps"),
  resultTitle: document.getElementById("result-title"),
  resultStatus: document.getElementById("result-status"),
  resultTime: document.getElementById("result-time"),
  resultBody: document.getElementById("result-body"),
  resultHint: document.getElementById("result-hint"),
  btnCopyResult: document.getElementById("btn-copy-result"),
  btnClearResult: document.getElementById("btn-clear-result"),
};

let savedToken = "";
try {
  savedToken = localStorage.getItem(TOKEN_KEY) || "";
} catch (error) {
  /* 隐私模式下 localStorage 可能不可用 */
}

const state = {
  token: savedToken,
  running: false,
  busy: false,
  lastText: "",
};

let toastTimer = null;

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className = "toast is-visible" + (type === "error" ? " is-error" : "");
  toastTimer = setTimeout(() => {
    els.toast.className = "toast";
  }, 3200);
}

function setHealth(ok) {
  els.healthDot.className = "dot " + (ok ? "is-on" : "is-off");
  els.healthText.textContent = ok ? "后端已连接" : "后端未连接";
}

function updateTokenUI() {
  els.tokenInput.value = state.token;
  els.tokenStatus.textContent = state.token ? "已保存 Token" : "未保存 Token";
  els.tokenStatus.classList.toggle("is-on", Boolean(state.token));
  els.btnMe.disabled = state.busy;
  els.btnCopyToken.disabled = state.busy || !state.token;
  els.btnClearToken.disabled = state.busy || !state.token;
}

function setToken(value) {
  state.token = value || "";
  try {
    if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    /* 忽略隐私模式限制 */
  }
  updateTokenUI();
}

function renderResult({ method, path, status, ok, ms, data, message, request }) {
  els.resultTitle.textContent = method + " " + path;
  els.resultStatus.textContent = status ? String(status) : "ERR";
  els.resultStatus.className = "status-pill " + (ok ? "ok" : "error");
  els.resultTime.textContent = ms + " ms";

  const responseText = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const entry = method + " " + path + "\n请求：\n" +
    JSON.stringify(request, null, 2) + "\n响应（HTTP " + status + "）：\n" +
    (responseText || "(空响应)");
  state.lastText = state.running && state.lastText
    ? state.lastText + "\n\n--------------------\n\n" + entry
    : entry;

  els.resultBody.textContent = state.lastText || "(空响应)";
  els.resultHint.textContent = ok
    ? "请求成功，HTTP " + status + "，耗时 " + ms + " ms。"
    : message || "请求失败。";
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll("button, input").forEach((element) => {
    element.disabled = busy;
  });
  updateTokenUI();
}

async function runAction(button, action) {
  if (state.busy || button.disabled) return;
  setBusy(true);
  try {
    await action();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "请求失败", "error");
  } finally {
    setBusy(false);
  }
}

async function copyText(text) {
  if (!text) {
    showToast("没有可复制的内容", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制到剪贴板");
  } catch (error) {
    showToast("复制失败，请手动选择文本", "error");
  }
}

function randomAccount() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    username: "demo_" + suffix,
    email: "demo_" + suffix + "@example.com",
    password: "secret123",
  };
}

function applyAccount(account) {
  els.regUsername.value = account.username;
  els.regEmail.value = account.email;
  els.regPassword.value = account.password;
  els.loginAccount.value = account.username;
  els.loginPassword.value = account.password;
}

function setStep(name, status) {
  const item = els.flowSteps.querySelector('[data-step="' + name + '"]');
  if (!item) return;
  item.classList.remove("is-running", "is-done", "is-error");
  if (status) item.classList.add("is-" + status);
}

function resetSteps() {
  els.flowSteps.querySelectorAll("li").forEach((item) => {
    item.classList.remove("is-running", "is-done", "is-error");
  });
}

function clearResult() {
  state.lastText = "";
  els.resultTitle.textContent = "等待请求";
  els.resultStatus.textContent = "—";
  els.resultStatus.className = "status-pill";
  els.resultTime.textContent = "—";
  els.resultBody.textContent = "点击左侧按钮开始测试。";
  els.resultHint.textContent = "测试台的 Token 独立保存在浏览器 localStorage，不会覆盖你的网站登录状态。";
}

/* ------------------------------ 事件绑定 ------------------------------ */

els.btnHealth.addEventListener("click", () => {
  runAction(els.btnHealth, async () => {
    try {
      await getHealth({ onResult: renderResult });
      setHealth(true);
      showToast("后端连接正常");
    } catch (error) {
      setHealth(false);
      throw error;
    }
  });
});

els.btnRoot.addEventListener("click", () => {
  runAction(els.btnRoot, () => getApiInfo({ onResult: renderResult }));
});

els.registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = els.regUsername.value.trim();
  const email = els.regEmail.value.trim();
  const password = els.regPassword.value;

  const submit = els.registerForm.querySelector('button[type="submit"]');
  runAction(submit, async () => {
    const data = await registerUser(
      { username, email, password },
      { onResult: renderResult }
    );
    setToken(data.access_token);
    els.loginAccount.value = username;
    els.loginPassword.value = password;
    showToast("注册成功，Token 已保存");
  });
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const account = els.loginAccount.value.trim();
  const password = els.loginPassword.value;

  if (!account || !password) {
    showToast("请填写账号和密码", "error");
    return;
  }

  const submit = els.loginForm.querySelector('button[type="submit"]');
  runAction(submit, async () => {
    const data = await loginUser(
      { account, password },
      { onResult: renderResult }
    );
    setToken(data.access_token);
    showToast("登录成功，Token 已保存");
  });
});

els.btnRandom.addEventListener("click", () => {
  applyAccount(randomAccount());
  showToast("已生成测试账号，可以直接注册");
});

els.btnMe.addEventListener("click", () => {
  runAction(els.btnMe, async () => {
    try {
      await getCurrentUser(state.token, { onResult: renderResult });
    } catch (error) {
      if (error.status === 401) setToken("");
      throw error;
    }
  });
});

els.btnCopyToken.addEventListener("click", () => {
  copyText(state.token);
});

els.tokenInput.addEventListener("change", () => {
  setToken(els.tokenInput.value.trim());
});

els.btnClearToken.addEventListener("click", () => {
  setToken("");
  showToast("Token 已清除");
});

els.btnCopyResult.addEventListener("click", () => {
  copyText(state.lastText);
});

els.btnClearResult.addEventListener("click", () => {
  clearResult();
});

els.btnRunAll.addEventListener("click", async () => {
  if (state.busy) return;

  state.running = true;
  setBusy(true);
  const originalText = els.btnRunAll.textContent;
  els.btnRunAll.textContent = "测试中…";
  resetSteps();
  clearResult();

  const account = randomAccount();
  applyAccount(account);

  try {
    setStep("health", "running");
    await getHealth({ onResult: renderResult });
    setHealth(true);
    setStep("health", "done");

    setStep("register", "running");
    const registered = await registerUser(
      {
        username: account.username,
        email: account.email,
        password: account.password,
      },
      { onResult: renderResult }
    );
    setToken(registered.access_token);
    setStep("register", "done");

    setStep("login", "running");
    const loggedIn = await loginUser(
      { account: account.username, password: account.password },
      { onResult: renderResult }
    );
    if (loggedIn.user.id !== registered.user.id) {
      throw new Error("登录返回的用户与注册用户不一致");
    }
    setToken(loggedIn.access_token);
    setStep("login", "done");

    setStep("me", "running");
    const me = await getCurrentUser(state.token, { onResult: renderResult });
    if (me.id !== registered.user.id || me.username !== account.username) {
      throw new Error("当前用户与本次测试账号不一致");
    }
    setStep("me", "done");

    showToast("核心流程通过，当前用户：" + me.username);
  } catch (error) {
    if (error.status === 401) setToken("");
    const running = els.flowSteps.querySelector(".is-running");
    if (running) {
      running.classList.remove("is-running");
      running.classList.add("is-error");
    }
    if (els.flowSteps.querySelector('[data-step="health"].is-error')) setHealth(false);
    showToast(error instanceof Error ? error.message : "测试失败", "error");
  } finally {
    state.running = false;
    setBusy(false);
    els.btnRunAll.textContent = originalText;
  }
});

/* ------------------------------ 初始化 ------------------------------ */

(async function init() {
  updateTokenUI();
  els.apiBaseDisplay.textContent = location.origin;
  els.docsLink.href = "/docs";

  if (location.protocol === "file:") {
    els.resultHint.textContent =
      "不要直接双击 HTML（file://），请用 start.bat 启动后访问 /test。";
    showToast("请通过 start.bat 打开页面", "error");
  }

  try {
    await getHealth();
    setHealth(true);
  } catch (error) {
    setHealth(false);
  }
})();
