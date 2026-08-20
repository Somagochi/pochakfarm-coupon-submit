const STORAGE_KEY = "pochakfarm_coupon_session";
const ACCESS_TOKEN_KEY = "pochakfarm_access_token";
const PENDING_REWARD_KEY = "pochakfarm_coupon_pending_reward";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const API_REQUEST_BASE_URL = window.location.protocol === "https:" ? "" : API_BASE_URL;
const IS_COUPON_DEV_PAGE = /^\/coupon-dev\/?$/.test(window.location.pathname);
const IS_COUPON_RESULT_PAGE = /^\/coupon-result\/?$/.test(window.location.pathname);
const INITIAL_SEARCH_PARAMS = new URLSearchParams(window.location.search);
const DEV_SCREEN = INITIAL_SEARCH_PARAMS.get("screen") || "registration";

if (window.location.search) {
  const accessToken = INITIAL_SEARCH_PARAMS.get("accessToken");

  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.hash}`,
  );
}

function userFromAccessToken(accessToken) {
  if (!accessToken) return null;

  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) throw new Error("Opaque access token");
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const payloadBytes = Uint8Array.from(atob(paddedPayload), (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      return null;
    }

    return {
      id: payload.sub || "authenticated-user",
      nickname: payload.nickname || payload.name || payload.preferred_username || "회원",
      provider: payload.provider || "oauth",
    };
  } catch {
    return { id: "authenticated-user", nickname: "회원", provider: "oauth" };
  }
}

const authenticatedUser = userFromAccessToken(sessionStorage.getItem(ACCESS_TOKEN_KEY));
let pendingReward = null;
try {
  pendingReward = JSON.parse(sessionStorage.getItem(PENDING_REWARD_KEY) || "null");
} catch {
  sessionStorage.removeItem(PENDING_REWARD_KEY);
}
const devReward = {
  couponCode: "DEV-COUPON",
  tier: "S",
  animalName: "테스트 동물",
  cardImageUrl: "/assets/coupon-card-placeholder.png",
};
const initialDevStage = DEV_SCREEN === "confirmation" ? "confirmation" : ["card", "badge", "coin"].includes(DEV_SCREEN) ? "reward" : "registration";
const initialDevError = DEV_SCREEN === "registration-error"
  ? "쿠폰 등록에 실패했습니다."
  : DEV_SCREEN === "complete-error"
    ? "쿠폰 보상을 받지 못했습니다."
    : "";
const state = {
  user: IS_COUPON_DEV_PAGE
    ? { id: "coupon-dev-user", nickname: "테스트" }
    : authenticatedUser || JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
  submitting: false,
  completing: false,
  farmFullModalVisible: IS_COUPON_DEV_PAGE && DEV_SCREEN === "farm-full",
  couponCode: IS_COUPON_DEV_PAGE ? "" : pendingReward?.couponCode || "",
  error: IS_COUPON_DEV_PAGE ? initialDevError : "",
  stage: IS_COUPON_DEV_PAGE && DEV_SCREEN === "complete-error" ? "confirmation" : IS_COUPON_DEV_PAGE ? initialDevStage : IS_COUPON_RESULT_PAGE && pendingReward ? "confirmation" : "registration",
  reward: IS_COUPON_DEV_PAGE ? devReward : pendingReward,
  rewardStep: ["card", "badge", "coin"].includes(DEV_SCREEN) ? DEV_SCREEN : "card",
};

const appCard = document.querySelector("#app-card");
const accountArea = document.querySelector("#account-area");
const toast = document.querySelector("#toast");

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char]));

async function redeemCoupon(couponCode) {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_REQUEST_BASE_URL}/api/coupons/redeem`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ couponCode }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || response.status !== 200) {
    const message = response.ok
      ? "쿠폰 등록에 실패했습니다."
      : body?.message || body?.data?.message || "쿠폰 등록에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.code || body?.data?.code || null;
    error.isApiError = true;
    throw error;
  }

  return body?.data || body?.result || body;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

async function loadCurrentUser() {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return;

  try {
    const response = await fetch(`${API_REQUEST_BASE_URL}/api/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(body?.message || "사용자 정보를 불러오지 못했습니다.");
      error.status = response.status;
      throw error;
    }

    const user = body?.data?.user || body?.data || body?.result?.user || body?.result || body?.user || body;
    const nickname = user?.nickname || user?.userNickname || user?.name;
    if (!nickname) throw new Error("사용자 닉네임을 확인할 수 없습니다.");

    state.user = {
      id: user.id || user.userId || user.sub || "authenticated-user",
      nickname,
      provider: user.provider || "oauth",
    };
    localStorage.removeItem(STORAGE_KEY);
    render();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      logout();
      return;
    }
    showToast(error.message || "사용자 정보를 불러오지 못했습니다.");
  }
}

function renderHeader() {
  accountArea.innerHTML = state.user
    ? `<div class="account-pill"><span class="name">${escapeHtml(state.user.nickname)}님의 농장</span><button class="logout" type="button">로그아웃</button></div>`
    : "";
  accountArea.querySelector(".logout")?.addEventListener("click", logout);
}

function startOAuthLogin(provider) {
  if (!API_REQUEST_BASE_URL && window.location.protocol !== "https:") {
    showToast("API 서버 주소가 설정되지 않았습니다.");
    return;
  }
  window.location.assign(`${API_REQUEST_BASE_URL}/api/auth/oauth2/${provider}`);
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
  window.location.assign("/coupon");
}

function logout() {
  state.user = null;
  state.reward = null;
  state.error = "";
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_REWARD_KEY);
  window.location.replace("/");
}

function loginView() {
  return `<div class="card-inner">
    <div class="login-controls">
      <h2 class="card-title">포착팜 로그인</h2>
      <p class="card-copy">보상을 받을 포착팜 계정으로 로그인해주세요.</p>
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
  const isNextEnabled = Boolean(state.couponCode.trim()) && !state.submitting;
  return `<form class="coupon-registration-panel" id="coupon-form" novalidate>
    <div class="coupon-registration-header">
      <img class="coupon-registration-title" src="/assets/coupon-registration-title.png" alt="쿠폰 등록" />
    </div>
    <img class="coupon-usage-warning" src="/assets/coupon-policy-notice.png" alt="부당한 방법으로 쿠폰을 이용하는 경우 운영정책에 따라 계정 사용이 제한될 수 있어요" />
    <input class="coupon-registration-input" id="coupon-code" name="couponCode" value="${escapeHtml(state.couponCode)}" placeholder="쿠폰 번호 입력" aria-label="쿠폰 번호 입력" autocomplete="off" autocapitalize="characters" maxlength="30" ${state.submitting ? "disabled" : ""} />
    <button class="coupon-next-button" type="submit" aria-label="다음으로" ${isNextEnabled ? "" : "disabled"}>
      <img src="/assets/coupon-next-${isNextEnabled ? "active" : "disabled"}.png" alt="" />
    </button>
    ${farmFullModalView()}
    ${state.error ? `<div class="coupon-error-overlay" role="dialog" aria-modal="true"><div class="coupon-error-dialog"><p>${escapeHtml(state.error)}</p><button id="coupon-error-close" type="button">확인</button></div></div>` : ""}
  </form>`;
}

function farmFullModalView() {
  return state.farmFullModalVisible
    ? `<div class="coupon-farm-full-overlay" role="dialog" aria-modal="true" aria-label="농장 공간 부족 안내">
        <div class="coupon-farm-full-dialog">
          <img class="coupon-farm-full-frame" src="/assets/coupon-farm-full-dialog.png" alt="" />
          <img class="coupon-farm-full-text" src="/assets/coupon-farm-full-text.png" alt="현재 농장에 공간이 없어요. 땅 타일 농장을 정리한 뒤 다시 보상을 수령해주세요" />
          <button class="coupon-farm-full-organize" type="button" aria-label="농장 정리하러 가기"><img src="/assets/coupon-farm-full-organize.png" alt="" /></button>
          <button class="coupon-farm-full-close" type="button" aria-label="농장 공간 부족 안내 닫기"></button>
        </div>
      </div>`
    : "";
}

function errorModalView() {
  return state.error
    ? `<div class="coupon-error-overlay" role="dialog" aria-modal="true"><div class="coupon-error-dialog"><p>${escapeHtml(state.error)}</p><button id="coupon-error-close" type="button">확인</button></div></div>`
    : "";
}

function confirmationView() {
  return `<section class="coupon-confirmation-panel" aria-label="쿠폰 보상 확인">
    <div class="coupon-registration-header"></div>
    <img class="coupon-reward-guide" src="/assets/coupon-reward-guide.png" alt="아래 보상을 확인하고 맞다면 보상받기 버튼을 눌러주세요" />
    <img class="coupon-reward-card" src="/assets/coupon-reward-card.png" alt="S등급 카드, 1기 포착팜 배지, 코인 3,000개" />
    <button class="coupon-complete-button" type="button" aria-label="수령하기" ${state.completing ? "disabled" : ""}><img src="/assets/coupon-complete-button.png" alt="" /></button>
    ${errorModalView()}
  </section>`;
}

function rewardResultView() {
  const step = state.rewardStep;
  const tier = ["C", "B", "A", "S", "SS", "SSS"].includes(state.reward?.tier) ? state.reward.tier : "S";
  const title = step === "coin" ? "코인 3,000개 획득!" : step === "badge" ? "1기 포착단 뱃지 획득!" : `${tier}등급 카드 획득!`;
  const paws = step === "coin" ? "coupon-coin-reward-paws.png" : step === "badge" ? "coupon-badge-reward-paws.png" : "coupon-card-reward-paws.png";
  const visual = step === "card"
    ? `<img class="coupon-reward-creature-card" src="${escapeHtml(state.reward?.cardImageUrl || "/assets/coupon-card-placeholder.png")}" data-fallback="/assets/coupon-card-placeholder.png" alt="${tier}등급 카드" />`
    : `<div class="coupon-reward-visual"><img class="coupon-reward-glow" src="/assets/coupon-badge-reward.png" alt="" /><img class="coupon-reward-${step}-icon" src="/assets/coupon-${step}-reward-icon.png" alt="${step === "coin" ? "코인 3,000개" : "1기 포착단 뱃지"}" /></div>`;

  return `<section class="coupon-reward-result" aria-label="보상 결과">
    ${visual}
    <h2>${title}</h2>
    <p>다음으로를 클릭해주세요</p>
    <img class="coupon-reward-paws" src="/assets/${paws}" alt="보상 진행 단계" />
    <button class="coupon-reward-next" type="button" aria-label="다음으로"><img src="/assets/coupon-reward-next-button.png" alt="" /></button>
  </section>`;
}

async function submitCoupon(event) {
  event.preventDefault();
  if (state.submitting) return;
  const input = document.querySelector("#coupon-code");
  const code = input.value.trim();
  if (!code) {
    state.error = "쿠폰 번호를 입력해주세요.";
    render();
    document.querySelector("#coupon-code")?.focus();
    return;
  }
  if (IS_COUPON_DEV_PAGE) {
    state.reward = { ...devReward, couponCode: code };
    state.stage = "confirmation";
    state.error = "";
    render();
    return;
  }
  state.submitting = true;
  state.error = "";
  render();
  try {
    const reward = await redeemCoupon(code);
    state.reward = { ...reward, couponCode: code };
    state.stage = "confirmation";
    sessionStorage.setItem(PENDING_REWARD_KEY, JSON.stringify(state.reward));
    window.history.pushState({}, "", "/coupon-result");
  } catch (error) {
    if (error?.status === 419) {
      state.farmFullModalVisible = true;
      state.error = "";
    } else {
      state.error = error instanceof Error ? error.message : "쿠폰 등록에 실패했습니다.";
    }
  } finally {
    state.submitting = false;
    render();
  }
}

async function completeCoupon() {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_REQUEST_BASE_URL}/api/coupons/complete`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ couponCode: state.reward?.couponCode }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || response.status !== 200) {
    const message = response.ok
      ? "쿠폰 보상을 받지 못했습니다."
      : body?.message || body?.data?.message || "쿠폰 보상을 받지 못했습니다.";
    const error = new Error(message);
    error.status = response.status;
    error.isApiError = true;
    throw error;
  }
}

async function submitCompleteCoupon() {
  if (state.completing) return;
  if (!state.reward?.couponCode) {
    state.error = "쿠폰 보상 정보가 올바르지 않습니다.";
    render();
    return;
  }
  if (IS_COUPON_DEV_PAGE) {
    state.stage = "reward";
    state.rewardStep = "card";
    state.error = "";
    render();
    return;
  }

  state.completing = true;
  state.error = "";
  render();
  try {
    await completeCoupon();
    state.stage = "reward";
    state.rewardStep = "card";
  } catch (error) {
    state.error = error?.isApiError ? error.message : "쿠폰 보상을 받지 못했습니다.";
  } finally {
    state.completing = false;
    render();
  }
}

function advanceReward() {
  if (state.rewardStep === "card") {
    state.rewardStep = "badge";
    render();
    return;
  }
  if (state.rewardStep === "badge") {
    state.rewardStep = "coin";
    render();
    return;
  }

  if (IS_COUPON_DEV_PAGE) {
    state.reward = devReward;
    state.couponCode = "";
    state.stage = "registration";
    state.rewardStep = "card";
    window.history.replaceState({}, "", "/coupon-dev?screen=registration");
    render();
    return;
  }

  sessionStorage.removeItem(PENDING_REWARD_KEY);
  state.reward = null;
  state.couponCode = "";
  state.stage = "registration";
  window.history.replaceState({}, "", "/coupon");
  render();
}

function renderDevToolbar() {
  if (!IS_COUPON_DEV_PAGE) return;
  let toolbar = document.querySelector("#coupon-dev-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("nav");
    toolbar.id = "coupon-dev-toolbar";
    toolbar.className = "coupon-dev-toolbar";
    toolbar.setAttribute("aria-label", "쿠폰 화면 미리보기");
    document.body.appendChild(toolbar);
  }

  toolbar.innerHTML = [
    ["registration", "쿠폰 입력"],
    ["confirmation", "보상 확인"],
    ["card", "카드 결과"],
    ["badge", "배지 결과"],
    ["coin", "코인 결과"],
    ["registration-error", "등록 오류"],
    ["farm-full", "419 농장 가득 참"],
    ["complete-error", "완료 오류"],
  ].map(([screen, label]) => `<button type="button" data-dev-screen="${screen}">${label}</button>`).join("");

  toolbar.querySelectorAll("[data-dev-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      const screen = button.dataset.devScreen;
      state.reward = devReward;
      state.error = "";
      state.farmFullModalVisible = false;
      if (screen === "registration" || screen === "registration-error" || screen === "farm-full") {
        state.stage = "registration";
        state.couponCode = "";
        if (screen === "registration-error") state.error = "쿠폰 등록에 실패했습니다.";
        if (screen === "farm-full") state.farmFullModalVisible = true;
      } else if (screen === "confirmation" || screen === "complete-error") {
        state.stage = "confirmation";
        if (screen === "complete-error") state.error = "쿠폰 보상을 받지 못했습니다.";
      } else {
        state.stage = "reward";
        state.rewardStep = screen;
      }
      window.history.replaceState({}, "", `/coupon-dev?screen=${screen}`);
      render();
    });
  });
}

function render() {
  renderHeader();
  appCard.innerHTML = !state.user
    ? loginView()
    : state.stage === "reward"
      ? rewardResultView()
      : state.stage === "confirmation"
        ? confirmationView()
        : couponView();
  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.provider));
  });
  document.querySelector("#coupon-form")?.addEventListener("submit", submitCoupon);
  const couponInput = document.querySelector("#coupon-code");
  couponInput?.addEventListener("input", () => {
    state.couponCode = couponInput.value;
    const nextButton = document.querySelector(".coupon-next-button");
    const nextImage = nextButton?.querySelector("img");
    const isEnabled = Boolean(couponInput.value.trim()) && !state.submitting;
    if (nextButton && nextImage) {
      nextButton.disabled = !isEnabled;
      nextImage.src = `/assets/coupon-next-${isEnabled ? "active" : "disabled"}.png`;
    }
  });
  document.querySelector("#coupon-error-close")?.addEventListener("click", () => { state.error = ""; render(); });
  document.querySelector(".coupon-farm-full-close")?.addEventListener("click", () => { state.farmFullModalVisible = false; render(); });
  document.querySelector(".coupon-farm-full-organize")?.addEventListener("click", () => { state.farmFullModalVisible = false; render(); });
  document.querySelector(".coupon-complete-button")?.addEventListener("click", submitCompleteCoupon);
  document.querySelector(".coupon-reward-next")?.addEventListener("click", advanceReward);
  const rewardCardImage = document.querySelector(".coupon-reward-creature-card");
  rewardCardImage?.addEventListener("error", () => { rewardCardImage.src = rewardCardImage.dataset.fallback; });
  renderDevToolbar();
}

function initialize() {
  if (IS_COUPON_DEV_PAGE) {
    document.body.classList.add("coupon-registration-page");
    render();
    return;
  }

  const isCouponPage = /^\/coupon\/?$/.test(window.location.pathname);
  const isCouponFlowPage = isCouponPage || IS_COUPON_RESULT_PAGE;
  const hasAccessToken = Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));
  const hasDemoSession = Boolean(localStorage.getItem(STORAGE_KEY));
  const hasAuthenticatedSession = hasAccessToken || hasDemoSession;

  if (isCouponFlowPage) document.body.classList.add("coupon-registration-page");

  if (isCouponFlowPage && !hasAuthenticatedSession) {
    window.location.replace("/");
    return;
  }

  if (IS_COUPON_RESULT_PAGE && !pendingReward) {
    window.location.replace("/coupon");
    return;
  }

  if (!isCouponFlowPage && hasAuthenticatedSession) {
    window.location.replace("/coupon");
    return;
  }

  render();
  loadCurrentUser();
}

initialize();

window.addEventListener("popstate", () => {
  if (/^\/coupon\/?$/.test(window.location.pathname)) {
    state.stage = "registration";
  } else if (/^\/coupon-result\/?$/.test(window.location.pathname) && state.reward) {
    state.stage = "confirmation";
  }
  render();
});
