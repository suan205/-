/**
 * 首页逻辑（web/js/home.js）
 * 如果本地有有效 Token，就在首页多显示一个“进入我的主页”的入口。
 */

import { loadCurrentUser, clearToken } from "./auth.js";

const loggedTip = document.getElementById("home-logged");
const actions = document.getElementById("home-actions");

function showLoggedIn(user) {
  loggedTip.hidden = false;
  loggedTip.textContent = `当前已登录：${user.username}`;

  const enter = document.createElement("a");
  enter.className = "pixel-btn";
  enter.href = "dashboard.html";
  enter.textContent = "进入我的主页";
  actions.appendChild(enter);
}

(async function init() {
  const result = await loadCurrentUser();
  if (result.user) {
    showLoggedIn(result.user);
  } else if (result.reason === "401") {
    // Token 过期或失效，静默清掉，首页继续当游客页使用
    clearToken();
  }
})();
