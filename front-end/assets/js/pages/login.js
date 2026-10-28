"use strict";

// تسجيل دخول فعلي فقط. حماية بيانات API تتم من Laravel auth:sanctum.
const LOGIN_CONFIG = {
  DASHBOARD_PAGE: "index.html",
  USER_KEY: "banquet_kitchen_user",
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const errorText = document.getElementById("errorText");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMeCheck = document.getElementById("rememberMe");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const submitBtn = document.querySelector(".btn-login");

  if (!form || !emailInput || !passwordInput || !submitBtn) return;

  function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorBox) errorBox.classList.add("show");
  }

  function hideError() {
    if (errorBox) errorBox.classList.remove("show");
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...'
      : '<i class="fas fa-arrow-left"></i> تسجيل الدخول';
  }

  function openDashboard() {
    window.location.replace(LOGIN_CONFIG.DASHBOARD_PAGE);
  }

  function clearStoredUser() {
    localStorage.removeItem(LOGIN_CONFIG.USER_KEY);
    sessionStorage.removeItem(LOGIN_CONFIG.USER_KEY);
  }

  function storeUser(user, remember) {
    clearStoredUser();
    if (!user) return;
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(LOGIN_CONFIG.USER_KEY, JSON.stringify(user));
  }

  [emailInput, passwordInput].forEach((input) => {
    input.addEventListener("input", hideError);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideError();
    });
  });

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePasswordBtn.classList.toggle("fa-lock", !isPassword);
      togglePasswordBtn.classList.toggle("fa-eye", isPassword);
    });
  }

  // عند وجود رمز قديم نتحقق منه مع الخادم؛ لا ندخل بمجرد وجوده.
  async function checkExistingSession() {
    const api = window.API;
    if (!api || typeof api.getUser !== "function" || !api.isAuthenticated()) {
      return;
    }

    const tokenBeingChecked = api.getToken();
    try {
      const user = await api.getUser();
      // لا نستبدل جلسة أحدث بسبب استجابة لفحص قديم.
      if (api.getToken() !== tokenBeingChecked) return;
      if (user?.id) {
        openDashboard();
      } else {
        api.clearToken();
        clearStoredUser();
      }
    } catch (error) {
      if (error?.status === 401) {
        if (api.getToken() === tokenBeingChecked) {
          api.clearToken();
          clearStoredUser();
        }
      } else {
        // تعطل الاتصال ليس دليلًا على أن الرمز انتهى.
        showError("تعذر التحقق من الجلسة الحالية. يمكنك إعادة تسجيل الدخول.");
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitBtn.disabled) return;
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = Boolean(rememberMeCheck?.checked);

    if (!email || !password) {
      showError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("يرجى إدخال بريد إلكتروني صحيح");
      emailInput.focus();
      return;
    }

    const api = window.API;
    if (!api || typeof api.login !== "function") {
      showError("خدمة تسجيل الدخول غير متاحة");
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(email, password, remember);
      const payload = response?.data ?? response ?? {};
      const token = payload.token;

      if (!token) {
        throw new Error("لم يتم استلام رمز الدخول من الخادم");
      }

      // API.login يحفظ الرمز تلقائيًا؛ نؤكد مكان التخزين المختار.
      api.setToken(token, remember);
      storeUser(payload.user ?? null, remember);
      openDashboard();
    } catch (error) {
      const message =
        typeof window.Utils?.getErrorText === "function"
          ? window.Utils.getErrorText(error)
          : error?.message || "فشل تسجيل الدخول، يرجى المحاولة مرة أخرى";
      showError(message);
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      setLoading(false);
    }
  });

  checkExistingSession();
});
