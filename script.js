// ============================================================
// CONFIGURATION - API
// ============================================================
const API_BASE = "http://localhost:8000/api";
let authToken = localStorage.getItem("auth_token") || null;
let currentUser = null;

// ============================================================
// API HELPER FUNCTIONS
// ============================================================
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options.headers,
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // معالجة أخطاء المصادقة
      if (response.status === 401) {
        // محاولة إعادة تسجيل الدخول تلقائياً
        const loginSuccess = await autoLogin();
        if (loginSuccess) {
          // إعادة المحاولة مرة واحدة
          return apiRequest(endpoint, options);
        }
        showToast("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً");
        return null;
      }

      throw new Error(data.message || "حدث خطأ في الطلب");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    showToast(error.message || "حدث خطأ في الاتصال بالخادم");
    return null;
  }
}

// ============================================================
// LOGIN HANDLER
// ============================================================
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showToast("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    return;
  }

  // إظهار حالة التحميل
  const btn = document.querySelector("#screenLogin button");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري التسجيل...';
  btn.disabled = true;

  try {
    const success = await login(email, password);
    if (success) {
      // سيتم التوجيه تلقائياً عبر دالة login
    }
  } catch (error) {
    showToast("حدث خطأ في الاتصال بالخادم");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function autoLogin() {
  const savedEmail = localStorage.getItem("user_email");
  const savedPassword = localStorage.getItem("user_password");

  if (!savedEmail || !savedPassword) return false;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: savedEmail,
        password: savedPassword,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      authToken = data.data.token;
      currentUser = data.data.user;
      localStorage.setItem("auth_token", authToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================
// PWA INSTALL
// ============================================================
let deferredPrompt;
const installBanner = document.getElementById("installBanner");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.classList.add("show");
});

document.getElementById("installBtn").addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      showToast("تم تثبيت التطبيق 🎉");
    } else {
      showToast("تم إلغاء التثبيت");
    }
    deferredPrompt = null;
    installBanner.classList.remove("show");
  } else {
    showToast("المتصفح لا يدعم التثبيت التلقائي");
  }
});

// ============================================================
// DATA - Defaults (للنسخ الاحتياطي فقط)
// ============================================================
const defaultSettings = {
  restaurant: {
    name: "شواطئ عدن",
    subtitle: "مطابخ ومطاعم",
    specialty: "للحجوزات والولائم والمناسبات",
    phone: "0550724459",
    delivery: "0547504445",
    address: "جده شارع جاك - جوار كودو",
    social: "@SHAWATI_ADEN",
    logo: "",
  },
};

const defaultItems = [
  { id: 1, name: "أرز بسمتي", price: 25 },
  { id: 2, name: "سلطة خضراء", price: 15 },
  { id: 3, name: "تبولة", price: 12 },
  { id: 4, name: "حمص", price: 10 },
  { id: 5, name: "مشاوي مشكلة", price: 80 },
  { id: 6, name: "دجاج مشوي", price: 45 },
  { id: 7, name: "خبز", price: 2 },
  { id: 8, name: "ماء", price: 1 },
  { id: 9, name: "عصير برتقال", price: 8 },
  { id: 10, name: "فحم", price: 15 },
];

// ============================================================
// APP STATE (يتم ملؤه من API)
// ============================================================
let appData = {
  settings: JSON.parse(JSON.stringify(defaultSettings)),
  items: [],
  bookings: [],
  currentFilter: "all",
  editingId: null,
  tempBookingId: null,
  currentInvoiceId: null,
  isLoaded: false,
};

// ============================================================
// INIT
// ============================================================
async function init() {
  // محاولة تسجيل الدخول التلقائي
  const token = localStorage.getItem("auth_token");

  if (token) {
    authToken = token;
    // حاول تحميل البيانات
    await loadAllData();

    setTimeout(() => {
      showScreen("screenHome");
      updateStats();
      renderTodayBookings();
      renderUpcomingBookings();
      renderAllBookings();
      renderItems();
      fillSettings();
    }, 500);
  } else {
    // لا يوجد توكن، عرض شاشة تسجيل الدخول
    showScreen("screenLogin");
    // إزالة شاشة البداية
    document.getElementById("screenSplash").classList.remove("active");
  }
}

// ============================================================
// LOAD DATA FROM API
// ============================================================
async function loadAllData() {
  try {
    // 1. تحميل الإعدادات
    const settingsResponse = await apiRequest("/settings");
    if (settingsResponse?.success) {
      appData.settings.restaurant = settingsResponse.data;
    }

    // 2. تحميل الأصناف
    const itemsResponse = await apiRequest("/items");
    if (itemsResponse?.success) {
      appData.items = itemsResponse.data;
    } else {
      // في حالة فشل التحميل، استخدم البيانات المحلية
      appData.items = JSON.parse(JSON.stringify(defaultItems));
    }

    // 3. تحميل الحجوزات
    const bookingsResponse = await apiRequest("/bookings");
    if (bookingsResponse?.success) {
      appData.bookings = bookingsResponse.data;
    }

    appData.isLoaded = true;
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("حدث خطأ في تحميل البيانات");
    // استخدام البيانات المحلية كنسخة احتياطية
    appData.items = JSON.parse(JSON.stringify(defaultItems));
    appData.bookings = [];
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================
// ============================================================
// AUTHENTICATION
// ============================================================
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      authToken = data.data.token;
      currentUser = data.data.user;
      localStorage.setItem("auth_token", authToken);
      localStorage.setItem("user_email", email);
      localStorage.setItem("user_password", password);

      showToast("تم تسجيل الدخول بنجاح");

      // تحميل البيانات
      await loadAllData();

      // الانتقال للصفحة الرئيسية
      setTimeout(() => {
        showScreen("screenHome");
        updateStats();
        renderTodayBookings();
        renderUpcomingBookings();
        renderAllBookings();
        renderItems();
        fillSettings();
      }, 300);

      return true;
    } else {
      showToast(data.message || "بيانات الدخول غير صحيحة");
      return false;
    }
  } catch (error) {
    console.error("Login error:", error);
    showToast(" حدث خطأ في الاتصال بالخادم");
    return false;
  }
}

async function logout() {
  if (authToken) {
    await apiRequest("/logout", { method: "POST" });
  }
  authToken = null;
  currentUser = null;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_password");
  showToast("تم تسجيل الخروج");
  showScreen("screenLogin");
}

// ============================================================
// SAVE FUNCTIONS (API)
// ============================================================
async function saveSettingsToAPI(settings) {
  // تحويل البيانات إلى صيغة API
  const apiData = {
    restaurant_name: settings.restaurant_name || settings.name,
    restaurant_subtitle: settings.restaurant_subtitle || settings.subtitle,
    restaurant_phone: settings.restaurant_phone || settings.phone,
    restaurant_delivery: settings.restaurant_delivery || settings.delivery,
    restaurant_address: settings.restaurant_address || settings.address,
    restaurant_social: settings.restaurant_social || settings.social,
    restaurant_logo: settings.restaurant_logo || settings.logo || "",
  };

  const response = await apiRequest("/settings", {
    method: "PUT",
    body: JSON.stringify(apiData),
  });

  if (response?.success) {
    // تحديث البيانات بالتنسيق الصحيح
    const data = response.data;
    appData.settings.restaurant = {
      name: data.restaurant_name || data.name,
      subtitle: data.restaurant_subtitle || data.subtitle,
      specialty: data.restaurant_specialty || data.specialty,
      phone: data.restaurant_phone || data.phone,
      delivery: data.restaurant_delivery || data.delivery,
      address: data.restaurant_address || data.address,
      social: data.restaurant_social || data.social,
      logo: data.restaurant_logo || data.logo || "",
    };
    return true;
  }
  return false;
}

async function saveItemToAPI(item) {
  if (item.id) {
    // تحديث
    const response = await apiRequest(`/items/${item.id}`, {
      method: "PUT",
      body: JSON.stringify(item),
    });
    if (response?.success) {
      const idx = appData.items.findIndex((i) => i.id === item.id);
      if (idx !== -1) appData.items[idx] = response.data;
      return response.data;
    }
  } else {
    // إضافة جديدة
    const response = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify(item),
    });
    if (response?.success) {
      appData.items.push(response.data);
      return response.data;
    }
  }
  return null;
}

async function deleteItemFromAPI(id) {
  const response = await apiRequest(`/items/${id}`, {
    method: "DELETE",
  });
  if (response?.success) {
    appData.items = appData.items.filter((i) => i.id !== id);
    return true;
  }
  return false;
}

async function saveBookingToAPI(booking) {
  // تحويل البيانات إلى صيغة API
    const apiData = {
        customer_name: booking.customer.name,
        customer_phone: booking.customer.phone || "",
        customer_location: booking.customer.location || "",
        booking_date: booking.booking.date,
        booking_time: booking.booking.time,
        delivery_time: booking.booking.deliveryTime || "ظهراً",
        mark: booking.booking.mark || "",
        notes: booking.notes || "",
        plates_deposit: booking.platesDeposit || 0,
        paid_amount: booking.finance.paid || 0,
        payment_method: booking.payment?.method || "نقدي",
        side_orders: booking.sideOrders.map((so) => ({
            item_id: so.id,
            quantity: so.quantity,
            price: so.price,
        })),
    };

  let response;
  if (booking.id && booking.id.toString().length < 10) {
    // تحديث (ID رقمي صغير - من API)
    response = await apiRequest(`/bookings/${booking.id}`, {
      method: "PUT",
      body: JSON.stringify(apiData),
    });
  } else {
    // إضافة جديدة
    response = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(apiData),
    });
  }

  if (response?.success) {
    const savedBooking = response.data;
    if (booking.id && booking.id.toString().length < 10) {
      const idx = appData.bookings.findIndex((b) => b.id === booking.id);
      if (idx !== -1) appData.bookings[idx] = savedBooking;
    } else {
      appData.bookings.push(savedBooking);
    }
    return savedBooking;
  }
  return null;
}

async function deleteBookingFromAPI(id) {
  const response = await apiRequest(`/bookings/${id}`, {
    method: "DELETE",
  });
  if (response?.success) {
    appData.bookings = appData.bookings.filter((b) => b.id !== id);
    return true;
  }
  return false;
}

async function updateBookingStatus(id, status) {
  const response = await apiRequest(`/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (response?.success) {
    const idx = appData.bookings.findIndex((b) => b.id === id);
    if (idx !== -1) appData.bookings[idx] = response.data;
    return true;
  }
  return false;
}

// ============================================================
// NAVIGATION
// ============================================================
function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");

  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  const activeBtn = document.querySelector(
    `.nav-btn[data-screen="${screenId}"]`,
  );
  if (activeBtn) activeBtn.classList.add("active");

  if (screenId === "screenNewBooking" && !appData.editingId) {
    resetBookingForm();
    addSideOrderRow();
  }
  if (screenId === "screenBookings") renderAllBookings();
  if (screenId === "screenHome") {
    updateStats();
    renderTodayBookings();
    renderUpcomingBookings();
  }
  if (screenId === "screenItems") renderItems();
  if (screenId === "screenSettings") fillSettings();
  window.scrollTo(0, 0);
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  const allBookings = appData.bookings || [];
  const todayCount = allBookings.filter(
    (b) => b.booking?.date === today && b.status !== "cancelled",
  ).length;
  const pendingCount = allBookings.filter((b) => b.status === "new").length;

  document.getElementById("statToday").textContent = todayCount;
  document.getElementById("statPending").textContent = pendingCount;
  document.getElementById("statTotal").textContent = allBookings.length;

  const activeBookings = allBookings.filter((b) => b.status !== "cancelled");
  let totalRevenue = 0;
  let totalDeposits = 0;
  let totalRemaining = 0;
  activeBookings.forEach((b) => {
    totalRevenue += b.finance?.total || 0;
    totalDeposits += b.finance?.deposit || 0;
    totalRemaining += b.finance?.remaining || 0;
  });
  document.getElementById("statTotalRevenue").textContent =
    totalRevenue.toFixed(2) + " ر.س";
  document.getElementById("statTotalDeposits").textContent =
    totalDeposits.toFixed(2) + " ر.س";
  document.getElementById("statTotalRemaining").textContent =
    totalRemaining.toFixed(2) + " ر.س";

  const badge = document.getElementById("navBadge");
  badge.textContent = pendingCount;
  badge.style.display = pendingCount > 0 ? "flex" : "none";
}

// ============================================================
// BOOKING FORM
// ============================================================
function resetBookingForm() {
    ["custName", "custPhone", "custLocation", "bookingMark", "bookingNotes", 
     "platesDeposit", "paidAmount"].forEach((id) => {
        document.getElementById(id).value = "";
    });
    document.getElementById("bookingDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("bookingTime").value = "12:00";
    document.getElementById("deliveryTime").value = "ظهراً";
    document.getElementById("paymentMethod").value = "نقدي";
    document.getElementById("sideOrdersContainer").innerHTML = "";
    document.getElementById("bookingFormTitle").textContent = "حجز جديد";
    calcBookingTotal();
}


function addSideOrderRow() {
  const container = document.getElementById("sideOrdersContainer");
  const opts = appData.items
    .map(
      (i) =>
        `<option value="${i.id}" data-price="${i.price}">${i.name} - سعر: ${i.price} ر.س</option>`,
    )
    .join("");
  const row = document.createElement("div");
  row.className =
    "flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-xl animate-slideUp";
  row.innerHTML = `
        <select class="side-item-select flex-1 min-w-[120px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-black" onchange="updateSidePrice(this)">
            <option value="">اختر الصنف</option>${opts}
        </select>
        <input type="number" class="side-item-price w-20 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" placeholder="سعر" value="0" min="0" step="0.5" oninput="calcBookingTotal()">
        <input type="number" class="side-item-qty w-16 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" value="1" min="1" oninput="calcBookingTotal()">
        <button onclick="this.parentElement.remove();calcBookingTotal();" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center btn-press">
            <i class="fas fa-times text-xs"></i>
        </button>
    `;
  container.appendChild(row);
  const sel = row.querySelector(".side-item-select");
  const priceInput = row.querySelector(".side-item-price");
  if (sel.value) {
    const price =
      parseFloat(sel.options[sel.selectedIndex]?.dataset?.price) || 0;
    priceInput.value = price;
  }
  calcBookingTotal();
}

function updateSidePrice(sel) {
  const row = sel.closest(".flex");
  const priceInput = row.querySelector(".side-item-price");
  const price = parseFloat(sel.options[sel.selectedIndex]?.dataset?.price) || 0;
  priceInput.value = price;
  calcBookingTotal();
}

function calcBookingTotal() {
    // حساب إجمالي الطلبات من الأصناف الجانبية
    let total = 0;
    document.querySelectorAll("#sideOrdersContainer > div").forEach((row) => {
        const sel = row.querySelector(".side-item-select");
        const qty = parseInt(row.querySelector(".side-item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".side-item-price").value) || 0;
        total += price * qty;
    });

    // تأمين الصحون
    const platesDeposit = parseFloat(document.getElementById("platesDeposit").value) || 0;

    // الإجمالي الكلي للفاتورة
    const grandTotal = total + platesDeposit;

    // المبلغ المدفوع
    const paidAmount = parseFloat(document.getElementById("paidAmount").value) || 0;

    // المتبقي
    const remaining = Math.max(0, grandTotal - paidAmount);

    // تحديث العرض
    document.getElementById("bookingTotalDisplay").textContent = total.toFixed(2) + " ر.س";
    document.getElementById("grandTotalDisplay").textContent = grandTotal.toFixed(2) + " ر.س";
    document.getElementById("paidAmount").value = grandTotal.toFixed(2);
    document.getElementById("remainingDisplay").textContent = remaining.toFixed(2) + " ر.س";

    return grandTotal;
}


function updatePaymentSummary(grandTotal, totalPaid, remaining) {
    const summary = document.getElementById("paymentSummary");
    if (grandTotal > 0 || totalPaid > 0) {
        summary.classList.remove("hidden");
        document.getElementById("summaryTotal").textContent = grandTotal.toFixed(2) + " ر.س";
        document.getElementById("summaryPaid").textContent = totalPaid.toFixed(2) + " ر.س";
        document.getElementById("summaryRemaining").textContent = remaining.toFixed(2) + " ر.س";
    } else {
        summary.classList.add("hidden");
    }
}
// ============================================================
// VIEW INVOICE (فتح الفاتورة في نفس التبويب)
// ============================================================
function viewInvoice(id) {
    const b = appData.bookings.find((x) => x.id == id);
    if (!b) {
        showToast("❌ لا توجد بيانات للفاتورة");
        return;
    }

    const invoiceData = {
        id: b.id,
        customer: {
            name: b.customer?.name || "",
            phone: b.customer?.phone || "",
            location: b.customer?.location || "",
        },
        booking: {
            date: formatDateForDisplay(b.booking?.date || ""),
            time: convertTimeTo12H(b.booking?.time || ""),
            day: getDayName(b.booking?.date || ""),
            mark: b.booking?.mark || "",
            deliveryTime: b.booking?.deliveryTime || "ظهراً",
        },
        paymentMethod: b.payment?.method || "نقدي",
        items: (b.sideOrders || []).map((item) => ({
            name: item.name || "صنف",
            qty: item.quantity || 1,
            price: item.price || 0,
            total: (item.price || 0) * (item.quantity || 1),
        })),
        total: (b.finance?.total || 0).toFixed(2),
        platesDeposit: (b.platesDeposit || 0).toFixed(2),
        notes: b.notes || "",
        deposit: (b.finance?.deposit || 0).toFixed(2),
        remaining: Math.max(0, (b.finance?.total || 0) - (b.finance?.deposit || 0)).toFixed(2),
        restaurant: appData.settings.restaurant || defaultSettings.restaurant,
    };

    localStorage.setItem('preview_invoice_data', JSON.stringify(invoiceData));
    
    // ✅ فتح في نفس التبويب
    window.location.href = 'invoice.html';
}

// ============================================================
// SAVE BOOKING (API)
// ============================================================
let pendingBooking = null; // لتخزين بيانات الحجز قبل الحفظ

async function saveBooking() {
    const name = document.getElementById("custName").value.trim();
    if (!name) {
        showToast("يرجى إدخال اسم العميل");
        return;
    }

    const sideOrders = [];
    document.querySelectorAll("#sideOrdersContainer > div").forEach((row) => {
        const sel = row.querySelector(".side-item-select");
        const qty = parseInt(row.querySelector(".side-item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".side-item-price").value) || 0;
        const itemId = parseInt(sel.value);
        if (itemId && qty > 0 && price > 0) {
            const item = appData.items.find((i) => i.id === itemId);
            sideOrders.push({
                id: itemId,
                name: item ? item.name : sel.options[sel.selectedIndex]?.text || "صنف",
                price: price,
                quantity: qty,
                total: price * qty,
            });
        }
    });

    const platesDeposit = parseFloat(document.getElementById("platesDeposit").value) || 0;
    const totalOrders = sideOrders.reduce((sum, s) => sum + s.total, 0);
    const grandTotal = totalOrders + platesDeposit;
    const paidAmount = parseFloat(document.getElementById("paidAmount").value) || 0;
    const paymentMethod = document.getElementById("paymentMethod").value || "نقدي";
    const remaining = Math.max(0, grandTotal - paidAmount);

    // تخزين بيانات الحجز مؤقتاً
    pendingBooking = {
        id: appData.editingId,
        customer: {
            name: name,
            phone: document.getElementById("custPhone").value,
            location: document.getElementById("custLocation").value,
        },
        booking: {
            date: document.getElementById("bookingDate").value,
            time: document.getElementById("bookingTime").value,
            mark: document.getElementById("bookingMark").value,
            day: getDayName(document.getElementById("bookingDate").value),
            deliveryTime: document.getElementById("deliveryTime").value,
        },
        notes: document.getElementById("bookingNotes").value,
        sideOrders: sideOrders,
        platesDeposit: platesDeposit,
        finance: {
            totalOrders: totalOrders,
            total: grandTotal,
            paid: paidAmount,
            remaining: remaining,
        },
        payment: {
            method: paymentMethod,
        },
        status: "new",
        createdAt: new Date().toISOString(),
    };

    // ✅ عرض نافذة التأكيد قبل الحفظ
    showConfirmModal(pendingBooking);
}

// ============================================================
// CONFIRM MODAL
// ============================================================
function showConfirmModal(booking) {
    // تعبئة البيانات
    document.getElementById("confirmCustName").textContent = booking.customer.name;
    document.getElementById("confirmBookingDate").textContent = booking.booking.date;
    document.getElementById("confirmBookingTime").textContent = convertTimeTo12H(booking.booking.time);
    document.getElementById("confirmLocation").textContent = booking.customer.location || "-";
    document.getElementById("confirmMark").textContent = booking.booking.mark || "-";
    document.getElementById("confirmTotalOrders").textContent = booking.finance.totalOrders.toFixed(2) + " ر.س";
    document.getElementById("confirmPlatesDeposit").textContent = booking.platesDeposit.toFixed(2) + " ر.س";
    document.getElementById("confirmGrandTotal").textContent = booking.finance.total.toFixed(2) + " ر.س";
    document.getElementById("confirmPaymentMethod").textContent = booking.payment.method;
    document.getElementById("confirmPaidAmount").textContent = booking.finance.paid.toFixed(2) + " ر.س";
    document.getElementById("confirmRemaining").textContent = booking.finance.remaining.toFixed(2) + " ر.س";
    
    // عرض المودال
    document.getElementById("confirmBookingModal").classList.add("active");
}

function closeConfirmModal() {
    document.getElementById("confirmBookingModal").classList.remove("active");
    pendingBooking = null;
}

// ============================================================
// CONFIRM AND SAVE
// ============================================================
async function confirmAndSave() {
    if (!pendingBooking) {
        showToast("❌ لا توجد بيانات للحفظ");
        return;
    }

    // إغلاق المودال
    closeConfirmModal();

    // حفظ الحجز
    const saved = await saveBookingToAPI(pendingBooking);
    if (saved) {
        appData.editingId = null;
        showToast("✅ تم حفظ الحجز بنجاح");
        showScreen("screenBookings");
    } else {
        showToast("❌ حدث خطأ في حفظ الحجز");
    }
    
    pendingBooking = null;
}

function goToBookings() {
    closeConfirmModal();
    showScreen("screenBookings");
}


function getDayName(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const days = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return days[date.getDay()];
}
function formatDateForDisplay(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
}

// ============================================================
// RENDER HELPERS
// ============================================================
function getStatusLabel(s) {
  const map = {
    new: "جديد",
    confirmed: "مؤكد",
    completed: "مكتمل",
    cancelled: "ملغي",
  };
  return map[s] || s;
}

function getStatusClass(s) {
  const map = {
    new: "status-new",
    confirmed: "status-confirmed",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };
  return map[s] || "bg-gray-500 text-white";
}

// ============================================================
// RENDER BOOKING CARD
// ============================================================
function renderBookingCard(b, showActions) {
  if (!b || !b.customer) return "";

  // تنسيق التاريخ والوقت
  const bookingDate = b.booking?.date || "";
  const formattedDate = formatDateForDisplay(bookingDate);
  const dayName = getDayName(bookingDate);
  const bookingTime = b.booking?.time || "";
  const time12 = convertTimeTo12H(bookingTime);

  // إنشاء HTML للبطاقة
  let html = `<div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50/80" data-id="${b.id}">`;

  // رأس البطاقة - الاسم والحالة
  html += `<div class="flex items-start justify-between">`;
  html += `<div><h3 class="font-bold text-base">${b.customer.name || ""}</h3>`;
  html += `<p class="text-xs text-gray-400">${b.customer.phone || "لا يوجد رقم"}</p></div>`;
  html += `<span class="${getStatusClass(b.status)} px-3 py-1 rounded-full text-[10px] font-bold">${getStatusLabel(b.status)}</span>`;
  html += `</div>`;

  // معلومات الحجز - التاريخ والوقت والمبلغ
  html += `<div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2.5 bg-gray-50 rounded-xl px-3 py-2">`;
  html += `<span><i class="far fa-calendar ml-1 text-blue-500"></i>${formattedDate}</span>`;
  html += `<span><i class="far fa-clock ml-1 text-purple-500"></i>${time12}</span>`;
  html += `<span class="font-bold text-green-600"><i class="fas fa-money-bill ml-1"></i>${(b.finance?.total || 0).toFixed(0)} ر.س</span>`;
  html += `</div>`;

  // إظهار اسم اليوم إذا كان متاحاً
  if (dayName) {
    html += `<div class="text-xs text-gray-400 mt-1 mr-1">${dayName}</div>`;
  }

  // أزرار الإجراءات (إذا كان showActions == true)
  if (showActions) {
    html += `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">`;
    // في renderBookingCard()
    html += `<button onclick="viewInvoice(${b.id})" class="flex-1 bg-gray-800 text-white rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-receipt ml-1"></i> الفاتورة</button>`;
    html += `<button onclick="editBooking(${b.id})" class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-edit ml-1"></i> تعديل</button>`;
    html += `<button onclick="openStatusModal(${b.id})" class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-exchange-alt ml-1"></i> الحالة</button>`;
    html += `<button onclick="confirmDelete(${b.id})" class="w-10 bg-red-50 text-red-500 rounded-xl py-2 btn-press"><i class="fas fa-trash text-xs"></i></button>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// ============================================================
// RENDER LISTS
// ============================================================
function renderTodayBookings() {
  const today = new Date().toISOString().split("T")[0];
  const list = (appData.bookings || [])
    .filter((b) => b.booking?.date === today && b.status !== "cancelled")
    .sort((a, b) =>
      (a.booking?.time || "").localeCompare(b.booking?.time || ""),
    );
  const el = document.getElementById("todayBookingsList");
  if (!list.length) {
    el.innerHTML = `<div class="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><i class="fas fa-calendar-day text-3xl mb-2 opacity-40"></i><p class="text-sm font-medium">لا توجد حجوزات اليوم</p></div>`;
  } else {
    el.innerHTML = list.map((b) => renderBookingCard(b, false)).join("");
  }
}

function renderUpcomingBookings() {
  const today = new Date().toISOString().split("T")[0];
  const list = (appData.bookings || [])
    .filter((b) => (b.booking?.date || "") > today && b.status !== "cancelled")
    .sort((a, b) =>
      (a.booking?.date || "").localeCompare(b.booking?.date || ""),
    )
    .slice(0, 5);
  const el = document.getElementById("upcomingBookingsList");
  if (!list.length) {
    el.innerHTML = `<div class="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><i class="fas fa-calendar-alt text-3xl mb-2 opacity-40"></i><p class="text-sm font-medium">لا توجد حجوزات قادمة</p></div>`;
  } else {
    el.innerHTML = list.map((b) => renderBookingCard(b, false)).join("");
  }
}

function renderAllBookings() {
  let list = [...(appData.bookings || [])].sort(
    (a, b) => (b.id || 0) - (a.id || 0),
  );
  if (appData.currentFilter !== "all")
    list = list.filter((b) => b.status === appData.currentFilter);
  const search = (
    document.getElementById("searchBookings")?.value || ""
  ).toLowerCase();
  if (search)
    list = list.filter(
      (b) =>
        (b.customer?.name || "").toLowerCase().includes(search) ||
        (b.customer?.phone || "").includes(search) ||
        (b.booking?.date || "").includes(search),
    );
  const el = document.getElementById("allBookingsList");
  if (!list.length) {
    el.innerHTML = `<div class="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><i class="fas fa-inbox text-4xl mb-2 opacity-40"></i><p class="text-sm font-medium">لا توجد حجوزات</p></div>`;
  } else {
    el.innerHTML = list.map((b) => renderBookingCard(b, true)).join("");
  }
}

function filterBookings() {
  renderAllBookings();
}

function filterByStatus(status, btn) {
  appData.currentFilter = status;
  document.querySelectorAll(".status-filter").forEach((b) => {
    b.classList.remove("bg-white", "text-black");
    b.classList.add("bg-white/10", "text-white/70");
  });
  if (btn) {
    btn.classList.remove("bg-white/10", "text-white/70");
    btn.classList.add("bg-white", "text-black");
  }
  renderAllBookings();
}

// ============================================================
// EDIT / DELETE / STATUS (مع API)
// ============================================================
function editBooking(id) {
    const b = appData.bookings.find((x) => x.id == id);
    if (!b) return;
    appData.editingId = id;
    showScreen("screenNewBooking");
    document.getElementById("bookingFormTitle").textContent = "تعديل حجز";
    document.getElementById("custName").value = b.customer?.name || "";
    document.getElementById("custPhone").value = b.customer?.phone || "";
    document.getElementById("custLocation").value = b.customer?.location || "";
    document.getElementById("bookingDate").value = b.booking?.date || "";
    document.getElementById("bookingTime").value = b.booking?.time || "";
    document.getElementById("bookingMark").value = b.booking?.mark || "";
    document.getElementById("deliveryTime").value = b.booking?.deliveryTime || "ظهراً";
    document.getElementById("bookingNotes").value = b.notes || "";
    document.getElementById("platesDeposit").value = b.platesDeposit || 0;
    document.getElementById("paidAmount").value = b.finance?.paid || 0;
    document.getElementById("paymentMethod").value = b.payment?.method || "نقدي";

    document.getElementById("sideOrdersContainer").innerHTML = "";
    (b.sideOrders || []).forEach((so) => {
        const container = document.getElementById("sideOrdersContainer");
        const opts = appData.items
            .map((i) =>
                `<option value="${i.id}" data-price="${i.price}" ${i.id == so.id ? "selected" : ""}>${i.name} - سعر: ${i.price} ر.س</option>`
            )
            .join("");
        const row = document.createElement("div");
        row.className = "flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-xl";
        row.innerHTML = `
            <select class="side-item-select flex-1 min-w-[120px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-black" onchange="updateSidePrice(this)">
                <option value="">اختر الصنف</option>${opts}
            </select>
            <input type="number" class="side-item-price w-20 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" placeholder="سعر" value="${so.price}" min="0" step="0.5" oninput="calcBookingTotal()">
            <input type="number" class="side-item-qty w-16 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" value="${so.quantity}" min="1" oninput="calcBookingTotal()">
            <button onclick="this.parentElement.remove();calcBookingTotal();" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center btn-press">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
        container.appendChild(row);
    });
    calcBookingTotal();
}

function confirmDelete(id) {
  appData.tempBookingId = id;
  document.getElementById("confirmText").textContent =
    "هل أنت متأكد من حذف هذا الحجز؟";
  document.getElementById("confirmBtn").onclick = async function () {
    await deleteBookingFromAPI(appData.tempBookingId);
    renderAllBookings();
    updateStats();
    closeModal();
    showToast("تم حذف الحجز");
  };
  document.getElementById("confirmModal").classList.add("active");
}

function openStatusModal(id) {
  appData.tempBookingId = id;
  document.getElementById("statusModal").classList.add("active");
}

async function changeStatus(status) {
  await updateBookingStatus(appData.tempBookingId, status);
  renderAllBookings();
  updateStats();
  showToast("تم تغيير الحالة");
  closeModal();
}

function closeModal() {
  document
    .querySelectorAll(".modal-overlay")
    .forEach((m) => m.classList.remove("active"));
}

// ============================================================
// CONVERT TIME
// ============================================================
function convertTimeTo12H(time24) {
  if (!time24) return "";

  // إذا كان الوقت بصيغة ISO (2024-08-08T14:30:00.000000Z)
  if (time24.includes("T")) {
    try {
      const date = new Date(time24);
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "مساءً" : "صباحاً";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return time24;
    }
  }

  // الوقت بصيغة 24 ساعة عادية (14:30)
  const parts = time24.split(":");
  if (parts.length < 2) return time24;

  let hours = parseInt(parts[0]);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "مساءً" : "صباحاً";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}
// ============================================================
// ITEMS (مع API)
// ============================================================
function renderItems() {
  const search = (
    document.getElementById("searchItems")?.value || ""
  ).toLowerCase();
  let list = appData.items || [];
  if (search)
    list = list.filter((i) => (i.name || "").toLowerCase().includes(search));
  const el = document.getElementById("itemsList");
  el.innerHTML = list
    .map(
      (i) => `
                <div class="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-gray-50/80">
                    <div>
                        <p class="font-bold text-sm">${i.name}</p>
                        <div class="flex gap-3 text-xs text-gray-500 mt-0.5">
                            <span>السعر: ${(i.price || 0).toFixed(2)} ر.س</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="openEditItem(${i.id})" class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center btn-press">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button onclick="deleteItem(${i.id})" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center btn-press">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `,
    )
    .join("");
}

function filterItems() {
  renderItems();
}

async function addItem() {
  const name = document.getElementById("newItemName").value.trim();
  const price = parseFloat(document.getElementById("newItemPrice").value) || 0;
  if (!name || price <= 0) {
    showToast("يرجى إدخال الاسم والسعر");
    return;
  }
  const saved = await saveItemToAPI({ name, price });
  if (saved) {
    document.getElementById("newItemName").value = "";
    document.getElementById("newItemPrice").value = "";
    renderItems();
    showToast("تم إضافة الصنف");
  }
}

function deleteItem(id) {
  appData.tempDeleteId = id;
  document.getElementById("confirmText").textContent =
    "هل أنت متأكد من حذف هذا الصنف؟";
  document.getElementById("confirmBtn").onclick = async function () {
    await deleteItemFromAPI(appData.tempDeleteId);
    renderItems();
    closeModal();
    showToast("تم حذف الصنف");
  };
  document.getElementById("confirmModal").classList.add("active");
}

function openEditItem(id) {
  const item = appData.items.find((i) => i.id == id);
  if (!item) return;
  document.getElementById("editItemId").value = id;
  document.getElementById("editItemName").value = item.name;
  document.getElementById("editItemPrice").value = item.price;
  document.getElementById("editItemModal").classList.add("active");
}

async function updateItem() {
  const id = parseInt(document.getElementById("editItemId").value);
  const name = document.getElementById("editItemName").value.trim();
  const price = parseFloat(document.getElementById("editItemPrice").value) || 0;
  if (!name || price <= 0) {
    showToast("يرجى إدخال اسم وسعر صحيح");
    return;
  }
  const saved = await saveItemToAPI({ id, name, price });
  if (saved) {
    renderItems();
    closeModal();
    showToast("تم تحديث الصنف");
  }
}

// ============================================================
// SETTINGS (مع API)
// ============================================================
function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    appData.settings.restaurant.logo = e.target.result;
    document.getElementById("logoPreview").src = e.target.result;
    document.getElementById("logoPreview").classList.remove("hidden");
    document.getElementById("removeLogoBtn").classList.remove("hidden");
    showToast("تم رفع الشعار، اضغط حفظ الإعدادات");
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  appData.settings.restaurant.logo = "";
  document.getElementById("logoPreview").src = "";
  document.getElementById("logoPreview").classList.add("hidden");
  document.getElementById("removeLogoBtn").classList.add("hidden");
  document.getElementById("restLogo").value = "";
  showToast("تم حذف الشعار، اضغط حفظ الإعدادات");
}

// ============================================================
// SETTINGS (مع API)
// ============================================================
// ============================================================
// SETTINGS (مع دعم الشعار)
// ============================================================
function fillSettings() {
  const r = appData.settings.restaurant || defaultSettings.restaurant;

  console.log("📋 Settings data:", r);

  // ملء الحقول - دعم كلا التنسيقين
  document.getElementById("restName").value = r.restaurant_name || r.name || "";
  document.getElementById("restSubtitle").value =
    r.restaurant_subtitle || r.subtitle || "";
  document.getElementById("restPhone").value =
    r.restaurant_phone || r.phone || "";
  document.getElementById("restDelivery").value =
    r.restaurant_delivery || r.delivery || "";
  document.getElementById("restAddress").value =
    r.restaurant_address || r.address || "";
  document.getElementById("restSocial").value =
    r.restaurant_social || r.social || "";

  // عرض الشعار - دعم كلا التنسيقين
  const logo = r.restaurant_logo || r.logo || "";
  const logoPreview = document.getElementById("logoPreview");
  const removeLogoBtn = document.getElementById("removeLogoBtn");

  if ((logo && logo.startsWith("data:image")) || logo.startsWith("http")) {
    logoPreview.src = logo;
    logoPreview.classList.remove("hidden");
    removeLogoBtn.classList.remove("hidden");
    console.log("✅ Logo loaded successfully");
  } else {
    logoPreview.classList.add("hidden");
    removeLogoBtn.classList.add("hidden");
    console.log("ℹ️ No logo found");
  }
}

function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;

  // التحقق من حجم الملف (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast("⚠️ حجم الصورة كبير جداً (الحد الأقصى 2MB)");
    return;
  }

  // التحقق من نوع الملف
  if (!file.type.startsWith("image/")) {
    showToast("⚠️ يرجى اختيار ملف صورة صحيح");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const imageData = e.target.result;
    appData.settings.restaurant.logo = imageData;
    appData.settings.restaurant.restaurant_logo = imageData;

    // عرض الصورة فوراً
    const logoPreview = document.getElementById("logoPreview");
    logoPreview.src = imageData;
    logoPreview.classList.remove("hidden");
    document.getElementById("removeLogoBtn").classList.remove("hidden");

    showToast("✅ تم رفع الشعار، اضغط حفظ الإعدادات");
  };
  reader.onerror = function () {
    showToast("❌ حدث خطأ في قراءة الملف");
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  appData.settings.restaurant.logo = "";
  appData.settings.restaurant.restaurant_logo = "";

  document.getElementById("logoPreview").src = "";
  document.getElementById("logoPreview").classList.add("hidden");
  document.getElementById("removeLogoBtn").classList.add("hidden");
  document.getElementById("restLogo").value = "";

  showToast("🗑️ تم حذف الشعار، اضغط حفظ الإعدادات");
}

async function saveSettings() {
  // حفظ الشعار الحالي
  const currentLogo =
    appData.settings.restaurant.restaurant_logo ||
    appData.settings.restaurant.logo ||
    "";

  const settings = {
    restaurant_name: document.getElementById("restName").value || "شواطئ عدن",
    restaurant_subtitle:
      document.getElementById("restSubtitle").value || "مطابخ ومطاعم",
    restaurant_phone: document.getElementById("restPhone").value || "",
    restaurant_delivery: document.getElementById("restDelivery").value || "",
    restaurant_address: document.getElementById("restAddress").value || "",
    restaurant_social: document.getElementById("restSocial").value || "",
    restaurant_logo: currentLogo,
  };

  const saved = await saveSettingsToAPI(settings);
  if (saved) {
    showToast("✅ تم حفظ الإعدادات");
    showScreen("screenHome");
  }
}

async function saveSettingsToAPI(settings) {
  const apiData = {
    restaurant_name: settings.restaurant_name || settings.name,
    restaurant_subtitle: settings.restaurant_subtitle || settings.subtitle,
    restaurant_phone: settings.restaurant_phone || settings.phone,
    restaurant_delivery: settings.restaurant_delivery || settings.delivery,
    restaurant_address: settings.restaurant_address || settings.address,
    restaurant_social: settings.restaurant_social || settings.social,
    restaurant_logo: settings.restaurant_logo || settings.logo || "",
  };

  console.log("📤 Sending settings to API:", apiData);

  const response = await apiRequest("/settings", {
    method: "PUT",
    body: JSON.stringify(apiData),
  });

  if (response?.success) {
    const data = response.data;
    console.log("📥 Settings saved successfully:", data);

    // تحديث البيانات محلياً بالتنسيق الصحيح
    appData.settings.restaurant = {
      name: data.restaurant_name || data.name || "شواطئ عدن",
      subtitle: data.restaurant_subtitle || data.subtitle || "",
      specialty: data.restaurant_specialty || data.specialty || "",
      phone: data.restaurant_phone || data.phone || "",
      delivery: data.restaurant_delivery || data.delivery || "",
      address: data.restaurant_address || data.address || "",
      social: data.restaurant_social || data.social || "",
      logo: data.restaurant_logo || data.logo || "",
      restaurant_name: data.restaurant_name || data.name,
      restaurant_subtitle: data.restaurant_subtitle || data.subtitle,
      restaurant_phone: data.restaurant_phone || data.phone,
      restaurant_delivery: data.restaurant_delivery || data.delivery,
      restaurant_address: data.restaurant_address || data.address,
      restaurant_social: data.restaurant_social || data.social,
      restaurant_logo: data.restaurant_logo || data.logo || "",
    };

    // تحديث واجهة الإعدادات
    fillSettings();

    return true;
  }
  return false;
}

async function saveSettings() {
  const currentLogo = appData.settings.restaurant.logo || "";
  const settings = {
    restaurant_name: document.getElementById("restName").value || "",
    restaurant_subtitle: document.getElementById("restSubtitle").value || "",
    restaurant_phone: document.getElementById("restPhone").value || "",
    restaurant_delivery: document.getElementById("restDelivery").value || "",
    restaurant_address: document.getElementById("restAddress").value || "",
    restaurant_social: document.getElementById("restSocial").value || "",
    restaurant_logo: currentLogo,
  };

  const saved = await saveSettingsToAPI(settings);
  if (saved) {
    // تحديث البيانات المحلية
    appData.settings.restaurant = {
      ...appData.settings.restaurant,
      ...settings,
    };
    showToast("تم حفظ الإعدادات");
    showScreen("screenHome");
  }
}

// ============================================================
// BACKUP (Local)
// ============================================================
function exportData() {
  const data = JSON.stringify(
    {
      settings: appData.settings,
      items: appData.items,
      bookings: appData.bookings,
    },
    null,
    2,
  );
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shawati_backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast("تم تصدير البيانات");
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.bookings) appData.bookings = data.bookings;
      if (data.items) appData.items = data.items;
      if (data.settings) appData.settings = data.settings;
      showToast("تم استيراد البيانات محلياً");
      showScreen("screenHome");
    } catch (err) {
      showToast("خطأ في ملف البيانات");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastText").textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove("show"), 2800);
}

// ============================================================
// START
// ============================================================
document.addEventListener("DOMContentLoaded", init);
