/* ==========================================================================
   Layout Engine — Component loader, navigation, modals, toast, FAB
   Handles theme (dark/light) globally
   ========================================================================== */

const Layout = (function () {
  "use strict";

  let currentPage = "";
  let confirmCallback = null;
  let statusCallback = null;
  let paymentCallback = null;

  const COMPONENTS = {
    header: "components/header.html",
    sidebar: "components/sidebar.html",
    "bottom-nav": "components/bottom-nav.html",
    modals: "components/modals.html",
  };

  const PAGE_TITLES = {
    dashboard: "لوحة التحكم",
    bookings: "الحجوزات",
    "booking-new": "حجز جديد",
    customers: "العملاء",
    "customer-view": "ملف العميل",
    suppliers: "الموردون",
    "supplier-view": "ملف المورد",
    reports: "التقارير",
    settings: "الإعدادات",
    items: "الأصناف",
    invoices: "الفواتير",
    test: "صفحة الاختبار",
  };

  // ============================================================
  // FAB_CONFIG – التحكم في الزر العائم حسب الصفحة
  // ============================================================
  const FAB_CONFIG = {
    dashboard: { type: "link", url: "booking-form.html" },
    bookings: { type: "link", url: "booking-form.html" },
    "booking-new": { type: "hidden" },
    customers: { type: "modal", modalId: "addCustomerModal" },
    "customer-view": { type: "modal", modalId: "transactionModal" },
    suppliers: { type: "modal", modalId: "supplierModal" },
    "supplier-view": { type: "modal", modalId: "transactionModal" },
    items: { type: "modal", modalId: "itemModal" },
    invoices: { type: "link", url: "invoices.html" },
    reports: { type: "hidden" },
    settings: { type: "hidden" },
    default: { type: "link", url: "booking-form.html" },
  };

  // ----- Theme Management (Global) -----
  const htmlEl = document.documentElement;

  function applyTheme(theme) {
    if (theme === "dark") {
      htmlEl.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      htmlEl.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
    const toggle = document.getElementById("themeToggle");
    if (toggle) toggle.checked = theme === "dark";
    const icon = document.querySelector(".theme-icon");
    if (icon) {
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  }

  function loadTheme() {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") applyTheme("dark");
    else applyTheme("light");
  }

  window.applyTheme = applyTheme;
  window.loadTheme = loadTheme;

  // ----- Component Loading -----
  async function loadComponent(name, target) {
    if (!target) return;
    try {
      const res = await fetch(COMPONENTS[name]);
      if (!res.ok) throw new Error("HTTP " + res.status);
      target.innerHTML = await res.text();
    } catch (e) {
      console.warn("Component load failed:", name, e);
    }
  }

  // ----- دالة مساعدة للتحقق من وجود API -----
  function getAPI() {
    if (typeof window.API !== "undefined" && window.API) {
      return window.API;
    }
    return null;
  }

  function safeFormatCurrency(amount) {
    const api = getAPI();
    if (api && typeof api.formatCurrency === "function") {
      return api.formatCurrency(amount);
    }
    return Number(amount).toLocaleString("ar-SA") + " ر.س";
  }

  // فحص فعلي للجلسة مع Laravel قبل تهيئة أجزاء الواجهة المحمية.
  async function checkPageAuthentication() {
    const api = getAPI();

    if (!api || typeof api.isAuthenticated !== "function" || !api.isAuthenticated()) {
      window.location.replace("login.html");
      return false;
    }

    try {
      if (typeof api.getUser !== "function") {
        throw new Error("تعذر التحقق من الجلسة: خدمة المستخدم غير متاحة.");
      }

      const user = await api.getUser(); // GET /api/me (auth:sanctum)
      if (!user || !user.id) {
        api.clearToken();
        window.location.replace("login.html");
        return false;
      }

      return true;
    } catch (error) {
      // API.request يتولى تنظيف الجلسة والتحويل عند انتهاء الصلاحية (401).
      if (error?.status === 401) return false;

      // خطأ شبكة لا يعني انتهاء الجلسة: لا نحذف الرمز ولا نفتح الواجهة.
      console.error("Authentication check failed:", error);
      showAuthenticationError(
        "تعذر التحقق من تسجيل الدخول. تأكد من تشغيل الخادم ثم أعد المحاولة.",
      );
      return false;
    }
  }

  function showAuthenticationError(message) {
    hideLoadingScreen();

    let notice = document.getElementById("authCheckError");
    if (notice) return;

    notice = document.createElement("div");
    notice.id = "authCheckError";
    notice.setAttribute("role", "alert");
    notice.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,.65);padding:20px;direction:rtl;";

    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;color:#202020;border-radius:12px;max-width:420px;width:100%;" +
      "padding:24px;text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.2);";

    const text = document.createElement("p");
    text.textContent = message;

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "إعادة المحاولة";
    retry.style.cssText =
      "background:#701f3a;color:white;border:0;border-radius:8px;padding:10px 20px;cursor:pointer;";
    retry.addEventListener("click", () => window.location.reload());

    panel.append(text, retry);
    notice.appendChild(panel);
    document.body.appendChild(notice);
  }

  // ============================================================
  // ✅ التهيئة الرئيسية
  // ============================================================
  async function init() {
    loadTheme();

    currentPage = document.documentElement.getAttribute("data-page") || "";

    const authenticated = await checkPageAuthentication();

    if (!authenticated) {
      return;
    }

    await Promise.all([
      loadComponent("header", document.getElementById("header")),
      loadComponent("sidebar", document.getElementById("sidebar")),
      loadComponent("bottom-nav", document.getElementById("bottomNav")),
      loadComponent("modals", document.getElementById("modalContainer")),
    ]);

    initActiveNav();
    initSidebarToggle();
    initFAB();
    initModals();
    initHeaderActions();
    initStatusOptions();
    initThemeToggle();

    setTimeout(hideLoadingScreen, 350);

    window.layoutReady = true;
    document.dispatchEvent(new CustomEvent("layout:ready"));
  }

  function initActiveNav() {
    document.querySelectorAll("[data-page]").forEach((el) => {
      if (el.getAttribute("data-page") === currentPage) {
        el.classList.add("active");
      }
    });
    const titleEl = document.getElementById("pageTitle");
    if (titleEl && PAGE_TITLES[currentPage]) {
      titleEl.textContent = PAGE_TITLES[currentPage];
    }
  }

  function initSidebarToggle() {
    const toggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (toggle) {
      toggle.addEventListener("click", () => {
        sidebar.classList.add("open");
        overlay.classList.add("active");
      });
    }
    if (overlay) {
      overlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
      });
    }
    document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth < 1024) {
          sidebar.classList.remove("open");
          overlay.classList.remove("active");
        }
      });
    });
  }

  // ============================================================
  // ✅ التحكم في FAB حسب الصفحة
  // ============================================================
  function initFAB() {
    const fab = document.getElementById("fab");
    if (!fab) return;

    const config = FAB_CONFIG[currentPage] || FAB_CONFIG.default;

    if (config.type === "hidden") {
      fab.style.display = "none";
      return;
    }

    fab.style.display = "flex";

    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);

    newFab.addEventListener("click", function () {
      if (config.type === "link") {
        window.location.href = config.url;
      } else if (config.type === "modal") {
        const modal = document.getElementById(config.modalId);
        if (modal) {
          modal.classList.add("active");
          document.body.style.overflow = "hidden";
          document.dispatchEvent(
            new CustomEvent("fab:modal:opened", {
              detail: { modalId: config.modalId },
            }),
          );
        } else {
          console.warn("Modal not found:", config.modalId);
          showToast("المودال غير موجود", "error");
        }
      }
    });
  }

  // ============================================================
  // ✅ باقي الدوال (مودالات، توست، ثيم، إلخ)
  // ============================================================
  function initModals() {
    document.addEventListener("click", (e) => {
      if (
        e.target.matches("[data-close]") ||
        e.target.closest("[data-close]")
      ) {
        const modal = e.target.closest(".modal");
        if (modal) closeModal(modal.id);
      }
    });

    const confirmBtn = document.getElementById("confirmBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (confirmCallback) confirmCallback();
        closeModal("confirmModal");
        confirmCallback = null;
      });
    }

    const statusBtn = document.getElementById("statusConfirmBtn");
    if (statusBtn) {
      statusBtn.addEventListener("click", () => {
        const selected = document.querySelector(
          "#statusOptions .status-option.selected",
        );
        if (selected && statusCallback) {
          statusCallback(selected.getAttribute("data-status"));
        }
        closeModal("statusModal");
        statusCallback = null;
      });
    }

    const paymentBtn = document.getElementById("paymentConfirmBtn");
    if (paymentBtn) {
      paymentBtn.addEventListener("click", () => {
        const amount =
          parseFloat(document.getElementById("paymentAmount")?.value) || 0;
        if (amount <= 0) {
          showToast("يرجى إدخال مبلغ صحيح", "warning");
          return;
        }
        if (paymentCallback) paymentCallback(amount);
        closeModal("paymentModal");
        paymentCallback = null;
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".modal.active")
          .forEach((m) => closeModal(m.id));
      }
    });
  }

  function initStatusOptions() {
    document.addEventListener("click", (e) => {
      const option = e.target.closest(".status-option");
      if (!option) return;
      document
        .querySelectorAll("#statusOptions .status-option")
        .forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");
      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  }

  function initThemeToggle() {
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.checked = htmlEl.classList.contains("dark-mode");
      toggle.addEventListener("change", function () {
        if (this.checked) applyTheme("dark");
        else applyTheme("light");
        document.dispatchEvent(
          new CustomEvent("theme:changed", {
            detail: { theme: this.checked ? "dark" : "light" },
          }),
        );
      });
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  function showConfirm(options) {
    const { title, message, onConfirm, danger, confirmText } = options;
    const t = document.getElementById("confirmTitle");
    const m = document.getElementById("confirmMessage");
    const b = document.getElementById("confirmBtn");
    if (t) t.textContent = title || "تأكيد";
    if (m) m.textContent = message || "هل أنت متأكد؟";
    if (b) {
      b.textContent = confirmText || "تأكيد";
      b.className = danger ? "btn btn-danger" : "btn btn-primary";
    }
    confirmCallback = onConfirm || null;
    openModal("confirmModal");
  }

  function showStatusModal(currentStatus, onConfirm) {
    document.querySelectorAll("#statusOptions .status-option").forEach((o) => {
      o.classList.toggle(
        "selected",
        o.getAttribute("data-status") === currentStatus,
      );
      const radio = o.querySelector('input[type="radio"]');
      if (radio)
        radio.checked = o.getAttribute("data-status") === currentStatus;
    });
    statusCallback = onConfirm || null;
    openModal("statusModal");
  }

  function showPaymentModal(customerName, remaining, onConfirm) {
    const c = document.getElementById("paymentCustomer");
    const r = document.getElementById("paymentRemaining");
    const a = document.getElementById("paymentAmount");
    if (c) c.textContent = customerName || "—";
    if (r) r.textContent = safeFormatCurrency(remaining);
    if (a) a.value = "";
    paymentCallback = onConfirm || null;
    openModal("paymentModal");
    setTimeout(() => {
      if (a) a.focus();
    }, 300);
  }

  function showToast(message, type) {
    type = type || "info";
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const icons = {
      success: "fa-circle-check",
      error: "fa-circle-xmark",
      warning: "fa-triangle-exclamation",
      info: "fa-circle-info",
    };
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    const iconHtml = `<i class="fas ${icons[type] || icons.info}"></i>`;
    const msgHtml =
      Utils && typeof Utils.escapeHtml === "function"
        ? Utils.escapeHtml(message)
        : String(message).replace(/[&<>"']/g, function (m) {
            const map = {
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#039;",
            };
            return map[m];
          });
    toast.innerHTML =
      '<div class="toast-icon">' +
      iconHtml +
      "</div>" +
      '<div class="toast-content"><p>' +
      msgHtml +
      "</p></div>";
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function hideLoadingScreen() {
    const loader = document.getElementById("loadingScreen");
    if (loader) {
      loader.classList.add("hidden");
      setTimeout(() => {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 450);
    }
  }

  function initHeaderActions() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        showConfirm({
          title: "تسجيل الخروج",
          message: "هل تريد تسجيل الخروج من النظام؟",
          confirmText: "خروج",
          onConfirm: async () => {
            const api = getAPI();
            try {
              if (api && typeof api.logout === "function") {
                await api.logout();
              }
            } catch (error) {
              // إن تعذر الاتصال بالخادم لا نترك الجلسة محفوظة في المتصفح.
              console.warn("Server logout failed:", error);
            } finally {
              if (api && typeof api.clearToken === "function") api.clearToken();
              localStorage.removeItem("banquet_kitchen_user");
              sessionStorage.removeItem("banquet_kitchen_user");
              window.location.replace("login.html");
            }
          },
        });
      });
    }
  }

  // ============================================================
  // ✅ الواجهة العامة (Public API)
  // ============================================================
  return {
    init,
    openModal,
    closeModal,
    showConfirm,
    showStatusModal,
    showPaymentModal,
    showToast,
    hideLoadingScreen,
    applyTheme,
    loadTheme,
  };
})();

// ============================================================
// ✅ الاختصارات العامة (Global shortcuts)
// ============================================================
window.showToast = function (msg, type) {
  Layout.showToast(msg, type);
};
window.showConfirm = function (opts) {
  Layout.showConfirm(opts);
};
window.showStatusModal = function (status, cb) {
  Layout.showStatusModal(status, cb);
};
window.showPaymentModal = function (name, remaining, cb) {
  Layout.showPaymentModal(name, remaining, cb);
};
window.openModal = function (id) {
  Layout.openModal(id);
};
window.closeModal = function (id) {
  Layout.closeModal(id);
};
window.applyTheme = function (theme) {
  Layout.applyTheme(theme);
};
window.loadTheme = function () {
  Layout.loadTheme();
};

// ============================================================
// ✅ التشغيل (Boot)
// ============================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Layout.init());
} else {
  Layout.init();
}
