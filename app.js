const STORAGE_KEY = "pochakfarm_coupon_session";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const state = {
  user: JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
  submitting: false,
  error: "",
  success: null,
};

const appCard = document.querySelector("#app-card");
const accountArea = document.querySelector("#account-area");
const toast = document.querySelector("#toast");

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char]));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Backend integration boundary.
 * Replace this demo body with POST /api/coupons/redeem and credentials: "include".
 * The server must identify the user from its session and award all rewards atomically.
 */
async function redeemCoupon(couponCode) {
  await sleep(950);
  const code = couponCode.trim().toUpperCase();
  const demoErrors = {
    USED2026: { code: "ALREADY_REDEEMED", message: "이미 사용한 쿠폰입니다." },
    EXPIRED2026: { code: "EXPIRED", message: "사용 기간이 종료된 쿠폰입니다." },
    SESSION2026: { code: "UNAUTHORIZED", message: "로그인이 만료되었습니다. 다시 로그인해주세요." },
    ERROR2026: { code: "SERVER_ERROR", message: "쿠폰을 등록하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요." },
  };
  if (demoErrors[code]) throw demoErrors[code];
  if (code !== "FARM2026") throw { code: "INVALID_COUPON", message: "유효하지 않은 쿠폰입니다. 쿠폰 코드를 다시 확인해주세요." };
  return { success: true, message: "쿠폰이 등록되었습니다.", rewards: [{ type: "CARROT", name: "황금 당근", amount: 10, icon: "🥕" }] };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderHeader() {
  accountArea.innerHTML = state.user
    ? `<div class="account-pill"><span class="avatar">🐣</span><span class="name">${escapeHtml(state.user.nickname)}님의 농장</span><button class="logout" type="button">로그아웃</button></div>`
    : "";
  accountArea.querySelector(".logout")?.addEventListener("click", logout);
}

function startOAuthLogin(provider) {
  if (!API_BASE_URL) {
    showToast("API 서버 주소가 설정되지 않았습니다.");
    return;
  }
  window.location.assign(`${API_BASE_URL}/api/auth/oauth2/${provider}`);
}

function login(provider) {
  if (provider === "kakao" || provider === "naver") {
    startOAuthLogin(provider);
    return;
  }

  // Apple remains a demo login until its OAuth configuration is provided.
  state.user = { id: `demo-${provider}-user`, nickname: "포착이", provider };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.user));
  state.error = "";
  render();
  const providerNames = { kakao: "카카오", naver: "네이버", apple: "Apple" };
  showToast(`${providerNames[provider]} 계정으로 로그인했어요!`);
}

function logout() {
  state.user = null;
  state.success = null;
  state.error = "";
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function loginView() {
  return `<div class="card-inner">
    <div class="login-controls">
      <h2 class="card-title">먼저 로그인해주세요!</h2>
      <p class="card-copy">쿠폰 보상을 받을 포착팜 계정으로 로그인해주세요.</p>
      <div class="social-buttons" aria-label="소셜 로그인">
        <button class="social-button" data-provider="kakao" type="button" aria-label="카카오 로그인"><img src="/assets/login-kakao.png" alt="" /></button>
        <button class="social-button" data-provider="naver" type="button" aria-label="네이버 로그인"><img src="/assets/login-naver.png" alt="" /></button>
        <button class="social-button" data-provider="apple" type="button" aria-label="Apple 로그인"><img src="/assets/login-apple.png" alt="" /></button>
      </div>
    </div>
    <div class="reservation-rewards" aria-label="사전예약 보상">
      <img src="/assets/reward-01.png" alt="01 S등급 캐릭터 카드 무료 획득" />
      <img src="/assets/reward-02.png" alt="02 1기 포착단 한정 배지 증정" />
      <img src="/assets/reward-03.png" alt="03 더 많은 포착을 위한 3,000 코인 증정" />
    </div>
  </div>`;
}

function couponView() {
  return `<div class="card-inner">
    <div class="card-icon" aria-hidden="true">🎫</div>
    <h2 class="card-title">쿠폰을 등록해주세요!</h2>
    <p class="card-copy">받은 쿠폰 코드를 입력하면<br />포착팜 계정으로 보상이 지급돼요.</p>
    <form id="coupon-form" novalidate>
      <label class="coupon-label" for="coupon-code">쿠폰 코드</label>
      <input class="coupon-input" id="coupon-code" name="couponCode" placeholder="쿠폰 코드를 입력해주세요" autocomplete="off" autocapitalize="characters" maxlength="30" ${state.submitting ? "disabled" : ""} />
      <div class="field-error" id="field-error">${escapeHtml(state.error)}</div>
      <button class="primary-button" type="submit" ${state.submitting ? "disabled" : ""}>${state.submitting ? "쿠폰 확인 중..." : "쿠폰 등록하기"}</button>
    </form>
  </div>`;
}

function successView() {
  const rewards = state.success.rewards || [];
  return `<div class="card-inner success">
    <span class="sparkle one">✦</span><span class="sparkle two">✦</span>
    <div class="card-icon" aria-hidden="true">🎉</div>
    <h2 class="card-title">쿠폰 등록 완료!</h2>
    <p class="card-copy">보상이 포착팜 계정에 지급되었어요.</p>
    <div class="reward-box"><div class="reward-label">획득한 보상</div>
      ${rewards.map((reward) => `<div class="reward-item"><span class="item-icon">${escapeHtml(reward.icon || "🎁")}</span><span class="reward-name">${escapeHtml(reward.name)}<strong>× ${Number(reward.amount).toLocaleString("ko-KR")}</strong></span></div>`).join("")}
    </div>
    <button class="secondary-button" id="another-coupon" type="button">다른 쿠폰 등록하기</button>
  </div>`;
}

async function submitCoupon(event) {
  event.preventDefault();
  if (state.submitting) return;
  const input = document.querySelector("#coupon-code");
  const code = input.value.trim().toUpperCase();
  if (!code) {
    state.error = "쿠폰 코드를 입력해주세요.";
    document.querySelector("#field-error").textContent = state.error;
    input.focus();
    return;
  }
  state.submitting = true;
  state.error = "";
  render();
  try {
    state.success = await redeemCoupon(code);
  } catch (error) {
    if (error?.code === "UNAUTHORIZED") {
      localStorage.removeItem(STORAGE_KEY);
      state.user = null;
      showToast(error.message);
    } else {
      state.error = error?.message || (navigator.onLine ? "쿠폰을 등록하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요." : "네트워크 연결을 확인한 후 다시 시도해주세요.");
    }
  } finally {
    state.submitting = false;
    render();
  }
}

function render() {
  renderHeader();
  appCard.innerHTML = !state.user ? loginView() : state.success ? successView() : couponView();
  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.provider));
  });
  document.querySelector("#coupon-form")?.addEventListener("submit", submitCoupon);
  document.querySelector("#another-coupon")?.addEventListener("click", () => { state.success = null; state.error = ""; render(); document.querySelector("#coupon-code")?.focus(); });
}

render();
