// ============================================================
//  شواطئ عدن - script.js (منظم بالكامل)
// ============================================================

// ============================================================
// 0. تجاهل أخطاء الصوت (AbortError)
// ============================================================
if (window.HTMLAudioElement) {
  const originalPlay = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function () {
    return originalPlay.call(this).catch(() => {});
  };
}

// ============================================================
// 1. CONFIGURATION
// ============================================================
const API_BASE = "https://cafe.technova.fun/api";
let authToken = localStorage.getItem("auth_token") || null;
let currentUser = null;

// ============================================================
// 2. APP STATE
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

let pendingBooking = null;

// ============================================================
// 3. API HELPERS
// ============================================================
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options.headers,
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const loginSuccess = await autoLogin();
        if (loginSuccess) return apiRequest(endpoint, options);
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
// 4. AUTHENTICATION
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
      await loadAllData();
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
    showToast("حدث خطأ في الاتصال بالخادم");
    return false;
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
      body: JSON.stringify({ email: savedEmail, password: savedPassword }),
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

async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!email || !password) {
    showToast("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    return;
  }
  const btn = document.querySelector("#screenLogin button");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري التسجيل...';
  btn.disabled = true;
  try {
    await login(email, password);
  } catch (error) {
    showToast("حدث خطأ في الاتصال بالخادم");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function logout() {
  if (authToken) await apiRequest("/logout", { method: "POST" });
  authToken = null;
  currentUser = null;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_password");
  showToast("تم تسجيل الخروج");
  showScreen("screenLogin");
}

// ============================================================
// 5. LOAD DATA
// ============================================================
async function loadAllData() {
  try {
    const settingsResponse = await apiRequest("/settings");
    if (settingsResponse?.success)
      appData.settings.restaurant = settingsResponse.data;

    const itemsResponse = await apiRequest("/items");
    if (itemsResponse?.success) appData.items = itemsResponse.data;
    else appData.items = JSON.parse(JSON.stringify(defaultItems));

    const bookingsResponse = await apiRequest("/bookings");
    if (bookingsResponse?.success) {
      appData.bookings = bookingsResponse.data.map((booking) => {
        let rawOrders = booking.side_orders || booking.sideOrders || [];
        if (!Array.isArray(rawOrders)) rawOrders = [];

        booking.sideOrders = rawOrders.map((item) => {
          let realItemId = item.itemId || item.item_id;
          let foundItem = appData.items.find((i) => i.id == realItemId);
          let finalName = foundItem ? foundItem.name : item.name || item.item_name || "صنف";
          let finalPrice = item.price || (foundItem ? foundItem.price : 0);

          return {
            id: item.id || null,
            item_id: realItemId,
            itemId: realItemId,
            name: finalName,
            price: finalPrice,
            quantity: item.quantity || item.qty || 1,
            total: finalPrice * (item.quantity || item.qty || 1),
          };
        });

        if (!booking.finance) booking.finance = {};
        const actualPaid = parseFloat(
            booking.paid_amount || 
            booking.deposit_paid || 
            booking.finance.deposit || 
            booking.finance.paid || 
            0
        );
        booking.finance.paid = actualPaid;
        booking.finance.deposit = actualPaid;

        return booking;
      });
    }

    appData.isLoaded = true;
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("حدث خطأ في تحميل البيانات");
    appData.items = JSON.parse(JSON.stringify(defaultItems));
    appData.bookings = [];
  }
}

// ============================================================
// 6. SAVE FUNCTIONS (API)
// ============================================================
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
  const response = await apiRequest("/settings", {
    method: "PUT",
    body: JSON.stringify(apiData),
  });
  if (response?.success) {
    const data = response.data;
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
    fillSettings();
    return true;
  }
  return false;
}

async function saveItemToAPI(item) {
  if (item.id) {
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
  const response = await apiRequest(`/items/${id}`, { method: "DELETE" });
  if (response?.success) {
    appData.items = appData.items.filter((i) => i.id !== id);
    return true;
  }
  return false;
}

async function saveBookingToAPI(booking) {
  let bookingDate = booking.booking?.date || "";
  if (bookingDate && bookingDate.includes("T")) bookingDate = bookingDate.split("T")[0];
  if (bookingDate && bookingDate.includes("/")) {
    const parts = bookingDate.split("/");
    if (parts.length === 3) bookingDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (!bookingDate) bookingDate = new Date().toISOString().split("T")[0];

  let bookingTime = booking.booking?.time || "12:00";

  const sideOrdersPayload = booking.sideOrders.map((so) => {
    const payload = {
      item_id: so.item_id || so.id,
      quantity: so.quantity || 1,
      price: so.price || 0,
    };
    if (so.id && so.id.toString().length > 0) payload.id = so.id;
    return payload;
  });

  const apiData = {
    customer_name: booking.customer.name,
    customer_phone: booking.customer.phone || "",
    customer_location: booking.customer.location || "",
    booking_date: bookingDate,
    booking_time: bookingTime,
    delivery_time: booking.booking?.deliveryTime || "ظهراً",
    mark: booking.booking?.mark || "",
    notes: booking.notes || "",
    plates_deposit: booking.platesDeposit || 0,
    paid_amount: booking.finance.paid || 0,
    deposit_paid: booking.finance.paid || 0, 
    payment_method: booking.payment?.method || "نقدي",
    side_orders: sideOrdersPayload,
  };

  let response;
  if (booking.id && booking.id.toString().length < 10) {
    response = await apiRequest(`/bookings/${booking.id}`, {
      method: "PUT",
      body: JSON.stringify(apiData),
    });
  } else {
    response = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(apiData),
    });
  }

  if (response?.success) {
    let savedBooking = response.data;
    
    const finalPaid = parseFloat(savedBooking.paid_amount || savedBooking.deposit_paid || savedBooking.finance?.deposit || booking.finance.paid || 0);
    if (!savedBooking.finance) savedBooking.finance = {};
    savedBooking.finance.paid = finalPaid;
    savedBooking.finance.deposit = finalPaid;

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
  const response = await apiRequest(`/bookings/${id}`, { method: "DELETE" });
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
    if (idx !== -1) {
      const oldBooking = appData.bookings[idx];
      const newData = response.data;

      if (!newData.platesDeposit && oldBooking.platesDeposit !== undefined) {
        newData.platesDeposit = oldBooking.platesDeposit;
      }
      if (!newData.plates_deposit && oldBooking.plates_deposit !== undefined) {
        newData.plates_deposit = oldBooking.plates_deposit;
      }
      if (!newData.finance) newData.finance = {};
      if (!newData.finance.platesDeposit && oldBooking.finance?.platesDeposit) {
        newData.finance.platesDeposit = oldBooking.finance.platesDeposit;
      }

      appData.bookings[idx] = newData;
    }
    return true;
  }
  return false;
}

// دالة تسليم الصحون وتصفير التأمين
async function confirmReturnPlates(id) {
  appData.tempBookingId = id;
  document.getElementById("confirmText").textContent = "سيتم إرجاع مبلغ التأمين للعميل وإقفال الحجز كلياً وتحويله إلى (مكتمل). هل أنت متأكد؟";
  
  document.getElementById("confirmBtn").onclick = async function () {
    closeModal();
    showToast("جاري تصفير التأمين وإقفال الحجز...");
    
    const b = appData.bookings.find((x) => x.id == id);
    if (!b) return;

    let bookingDate = b.booking?.date || b.booking_date || "";
    if (bookingDate && bookingDate.includes("T")) bookingDate = bookingDate.split("T")[0];
    if (!bookingDate) bookingDate = new Date().toISOString().split("T")[0];

    let bookingTime = b.booking?.time || b.booking_time || "12:00";
    
    let rawOrders = b.sideOrders || b.side_orders || b.items || [];
    const sideOrdersPayload = rawOrders.map((so) => {
      const payload = {
        item_id: so.item_id || so.itemId || so.id,
        quantity: so.quantity || so.qty || 1,
        price: so.price || 0,
      };
      if (so.id && so.id.toString().length > 0) payload.id = so.id;
      return payload;
    });

    const paidAmount = parseFloat(b.finance?.paid || b.paid_amount || b.deposit_paid || 0);

    const apiData = {
      customer_name: b.customer?.name || b.customer_name || "عميل",
      customer_phone: b.customer?.phone || b.customer_phone || "",
      customer_location: b.customer?.location || b.customer_location || "",
      booking_date: bookingDate,
      booking_time: bookingTime,
      delivery_time: b.booking?.deliveryTime || b.delivery_time || "ظهراً",
      mark: b.booking?.mark || b.mark || "",
      notes: b.notes || "",
      plates_deposit: 0,
      paid_amount: paidAmount,
      deposit_paid: paidAmount, 
      payment_method: b.payment?.method || b.payment_method || "نقدي",
      side_orders: sideOrdersPayload,
    };

    const response = await apiRequest(`/bookings/${id}`, {
      method: "PUT",
      body: JSON.stringify(apiData),
    });

    if (response?.success) {
      await updateBookingStatus(id, "completed");
      showToast("✅ تم استلام الصحون وإقفال الحجز بنجاح");
      await loadAllData();
      renderAllBookings();
      updateStats();
    } else {
      showToast("❌ حدث خطأ أثناء تنفيذ العملية");
    }
  };
  
  document.getElementById("confirmModal").classList.add("active");
}

// دالة تسديد المتبقي بعد الإكمال
let tempPaymentBookingId = null;

function showPaymentModal(id) {
  const b = appData.bookings.find(x => x.id == id);
  if (!b) {
    showToast("❌ الحجز غير موجود");
    return;
  }

  const remaining = parseFloat(b.finance?.remaining || b.remaining || 0);
  if (remaining <= 0) {
    showToast("✅ لا يوجد مبلغ متبقي لتسديده");
    return;
  }

  tempPaymentBookingId = id;
  document.getElementById("paymentCustName").textContent = b.customer?.name || "غير معروف";
  document.getElementById("paymentRemaining").textContent = remaining.toFixed(2);
  document.getElementById("paymentInput").value = remaining.toFixed(2);
  document.getElementById("paymentInput").max = remaining.toFixed(2);
  document.getElementById("paymentMaxDisplay").textContent = remaining.toFixed(2);
  document.getElementById("paymentModal").classList.add("active");
}

function closePaymentModal() {
  document.getElementById("paymentModal").classList.remove("active");
  tempPaymentBookingId = null;
}

async function confirmPayment() {
  const input = document.getElementById("paymentInput").value.trim();
  const payment = parseFloat(input);

  if (isNaN(payment) || payment <= 0) {
    showToast("⚠️ يرجى إدخال مبلغ صحيح");
    return;
  }

  const id = tempPaymentBookingId;
  const b = appData.bookings.find(x => x.id == id);
  if (!b) {
    showToast("❌ الحجز غير موجود");
    return;
  }

  const remaining = parseFloat(b.finance?.remaining || b.remaining || 0);
  const actualPayment = Math.min(payment, remaining);
  const total = parseFloat(b.finance?.total || b.total_amount || 0);
  const oldPaid = parseFloat(b.finance?.paid || b.paid_amount || 0);
  const newPaid = oldPaid + actualPayment;
  const newRemaining = Math.max(0, total - newPaid);

  const bookingToUpdate = {
    id: b.id,
    customer: b.customer,
    booking: b.booking,
    notes: b.notes,
    sideOrders: b.sideOrders || b.side_orders || b.items || [],
    platesDeposit: parseFloat(b.platesDeposit || b.plates_deposit || 0),
    finance: {
      ...b.finance,
      total: total,
      paid: newPaid,
      remaining: newRemaining
    },
    payment: { method: b.payment?.method || b.payment_method || "نقدي" },
    status: b.status
  };

  const saved = await saveBookingToAPI(bookingToUpdate);
  if (saved) {
    showToast(`✅ تم تسجيل دفعة بقيمة ${actualPayment.toFixed(2)} ر.س بنجاح`);
    closePaymentModal();
    await loadAllData();
    renderAllBookings();
    updateStats();
  } else {
    showToast("❌ حدث خطأ في تسجيل الدفعة");
  }
}

// ============================================================
// 7. NAVIGATION & APP BAR
// ============================================================
const APP_BAR_CONFIG = {
  screenHome: {
    title: "شواطئ عدن",
    showBack: false,
    showLogout: true,
    showSettings: true,
  },
  screenBookings: {
    title: "الحجوزات",
    showBack: true,
    showLogout: false,
    showSettings: false,
  },
  screenNewBooking: {
    title: "حجز جديد",
    showBack: true,
    showLogout: false,
    showSettings: false,
  },
  screenItems: {
    title: "الأصناف",
    showBack: true,
    showLogout: false,
    showSettings: false,
  },
  screenSettings: {
    title: "الإعدادات",
    showBack: true,
    showLogout: false,
    showSettings: false,
  },
  screenLogin: {
    title: "تسجيل الدخول",
    showBack: false,
    showLogout: false,
    showSettings: false,
  },
  screenSplash: {
    title: "شواطئ عدن",
    showBack: false,
    showLogout: false,
    showSettings: false,
  },
};

let previousScreen = "screenHome";

function updateAppBar(screenId) {
  const config = APP_BAR_CONFIG[screenId] || APP_BAR_CONFIG.screenHome;
  const titleEl = document.getElementById("appBarTitle");
  if (titleEl) titleEl.textContent = config.title;

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    if (config.showBack) backBtn.classList.add("show");
    else backBtn.classList.remove("show");
  }

  const logoutBtn = document.getElementById("appBarLogout");
  if (logoutBtn) logoutBtn.style.display = config.showLogout ? "flex" : "none";

  const settingsBtn = document.getElementById("appBarSettings");
  if (settingsBtn)
    settingsBtn.style.display = config.showSettings ? "flex" : "none";
}

function goBack() {
  if (previousScreen) showScreen(previousScreen);
  else showScreen("screenHome");
}

// ============================================================
// 8. STATS
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
  let totalRevenue = 0,
    totalDeposits = 0,
    totalRemaining = 0;
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
// 9. RENDER FUNCTIONS
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
    el.innerHTML = list.map((b) => renderBookingCard(b, true)).join("");
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
    el.innerHTML = list.map((b) => renderBookingCard(b, true)).join("");
  }
}

function renderAllBookings() {
  let list = [...(appData.bookings || [])].sort((a, b) => {
    const statusOrder = { 'new': 1, 'confirmed': 2, 'completed': 3, 'cancelled': 4 };
    const weightA = statusOrder[a.status] || 5;
    const weightB = statusOrder[b.status] || 5;

    if (weightA !== weightB) {
        return weightA - weightB;
    }

    const dateA = a.booking?.date || "";
    const dateB = b.booking?.date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const timeA = a.booking?.time || "";
    const timeB = b.booking?.time || "";
    return timeA.localeCompare(timeB);
  });

  if (appData.currentFilter !== "all")
    list = list.filter((b) => b.status === appData.currentFilter);
    
  const search = (
    document.getElementById("searchBookings")?.value || ""
  ).toLowerCase();
  if (search) {
    list = list.filter(
      (b) =>
        (b.customer?.name || "").toLowerCase().includes(search) ||
        (b.customer?.phone || "").includes(search) ||
        (b.booking?.date || "").includes(search),
    );
  }
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

function renderBookingCard(b, showActions) {
  if (!b || !b.customer) return "";
  const bookingDate = b.booking?.date || "";
  const formattedDate = formatDateForDisplay(bookingDate);
  const dayName = getDayName(bookingDate);
  const time12 = convertTimeTo12H(b.booking?.time || "");

  const total = (b.finance?.total || b.total_amount || b.total_orders || 0).toFixed(0);
  const paid = (b.finance?.deposit || b.finance?.paid || b.paid_amount || b.deposit_paid || 0).toFixed(0);
  const remaining = (b.finance?.remaining || b.remaining || 0).toFixed(0);

  let pDeposit = 0;
  if (b.platesDeposit !== undefined && b.platesDeposit !== null) {
      pDeposit = parseFloat(b.platesDeposit);
  } else if (b.plates_deposit !== undefined && b.plates_deposit !== null) {
      pDeposit = parseFloat(b.plates_deposit);
  } else if (b.finance && b.finance.platesDeposit !== undefined) {
      pDeposit = parseFloat(b.finance.platesDeposit);
  }
  if (isNaN(pDeposit) || pDeposit < 0) pDeposit = 0;

  let html = `<div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50/80" data-id="${b.id}">`;
  
  html += `<div class="flex items-start justify-between">`;
  html += `<div><h3 class="font-bold text-base">${b.customer.name || ""}</h3>`;
  html += `<p class="text-xs text-gray-400">${b.customer.phone || "لا يوجد رقم"}</p></div>`;
  html += `<span class="${getStatusClass(b.status)} px-3 py-1 rounded-full text-[10px] font-bold">${getStatusLabel(b.status)}</span>`;
  html += `</div>`;

  html += `<div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2.5 bg-gray-50 rounded-xl px-3 py-2">`;
  html += `<span><i class="far fa-calendar ml-1 text-blue-500"></i>${formattedDate} ${dayName ? '- ' + dayName : ''}</span>`;
  html += `<span><i class="far fa-clock ml-1 text-purple-500"></i>${time12}</span>`;
  html += `</div>`;

  html += `<div class="grid grid-cols-4 gap-2 mt-2">
        <div class="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
            <p class="text-[9px] text-gray-500 font-bold mb-1">الإجمالي</p>
            <p class="text-xs font-black text-gray-800">${total}</p>
        </div>
        <div class="bg-green-50 rounded-xl p-2 text-center border border-green-100">
            <p class="text-[9px] text-green-600 font-bold mb-1">المدفوع</p>
            <p class="text-xs font-black text-green-700">${paid}</p>
        </div>
        <div class="bg-red-50 rounded-xl p-2 text-center border border-red-100">
            <p class="text-[9px] text-red-600 font-bold mb-1">المتبقي</p>
            <p class="text-xs font-black text-red-700">${remaining}</p>
        </div>
        <div class="bg-orange-50 rounded-xl p-2 text-center border border-orange-100">
            <p class="text-[9px] text-orange-600 font-bold mb-1">تأمين الصحون</p>
            <p class="text-xs font-black text-orange-700">${pDeposit}</p>
        </div>
      </div>`;

  if (showActions) {
    html += `<div class="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">`;
    
    if (b.status === 'completed') {
        const remainingNum = parseFloat(b.finance?.remaining || b.remaining || 0);
        html += `<div class="bg-green-50 border border-green-200 text-green-700 rounded-xl py-2 px-3 text-center text-xs font-bold mb-1">
                    <i class="fas fa-lock ml-1"></i> الحجز مغلق (تم تسليم الصحون)
                 </div>`;
        if (remainingNum > 0) {
            html += `<button onclick="showPaymentModal(${b.id})" class="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-xl py-2.5 text-xs font-bold btn-press transition-colors shadow-sm mb-1">
                        <i class="fas fa-hand-holding-usd ml-1"></i> تسديد المتبقي (${remainingNum.toFixed(2)} ر.س)
                     </button>`;
        }
        html += `<button onclick="viewInvoice(${b.id})" class="w-full bg-gray-800 text-white rounded-xl py-2.5 text-xs font-bold btn-press"><i class="fas fa-receipt ml-1"></i> عرض الفاتورة النهائية</button>`;
    } else {
        if (pDeposit > 0 && b.status === 'confirmed') {
            html += `<button onclick="confirmReturnPlates(${b.id})" class="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl py-2.5 text-xs font-bold btn-press transition-colors shadow-sm mb-1"><i class="fas fa-undo-alt ml-1"></i> تسليم الصحون (إرجاع التأمين وإقفال الحجز)</button>`;
        }

        html += `<div class="flex gap-2 w-full">`;
        html += `<button onclick="viewInvoice(${b.id})" class="flex-1 bg-gray-800 text-white rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-receipt ml-1"></i> الفاتورة</button>`;
        html += `<button onclick="editBooking(${b.id})" class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-edit ml-1"></i> تعديل</button>`;
        html += `<button onclick="openStatusModal(${b.id})" class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-xs font-bold btn-press"><i class="fas fa-exchange-alt ml-1"></i> الحالة</button>`;
        html += `<button onclick="confirmDelete(${b.id})" class="w-10 bg-red-50 text-red-500 rounded-xl py-2 btn-press border border-red-100"><i class="fas fa-trash text-xs"></i></button>`;
        html += `</div>`;
    }
    
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ============================================================
// 10. HELPERS
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

function convertTimeTo12H(time24) {
  if (!time24) return "";
  if (time24.includes("T")) {
    try {
      const date = new Date(time24);
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "مساءً" : "صباحاً";
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return time24;
    }
  }
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0]);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "مساءً" : "صباحاً";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
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
    let cleanDate = dateStr.split("T")[0];
    let day, month, year;

    if (cleanDate.includes("-")) {
      const parts = cleanDate.split("-");
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      const date = new Date(cleanDate);
      if (isNaN(date.getTime())) return cleanDate;
      day = date.getDate().toString().padStart(2, "0");
      month = (date.getMonth() + 1).toString().padStart(2, "0");
      year = date.getFullYear();
    }

    return `\u200E${day} / ${month} / ${year}\u200E`;
  } catch {
    return dateStr;
  }
}

// ============================================================
// 11. NAVIGATION
// ============================================================
function showScreen(screenId) {
  const currentActive = document.querySelector(".screen.active");
  if (currentActive) previousScreen = currentActive.id;

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

  updateAppBar(screenId);

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
// 12. BOOKING FORM
// ============================================================
function resetBookingForm() {
  [
    "custName",
    "custPhone",
    "custLocation",
    "bookingMark",
    "bookingNotes",
    "platesDeposit",
    "paidAmount",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("bookingDate").value = new Date()
    .toISOString()
    .split("T")[0];
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
  let totalOrders = 0;
  document.querySelectorAll("#sideOrdersContainer > div").forEach((row) => {
    const qty = parseInt(row.querySelector(".side-item-qty").value) || 0;
    const price = parseFloat(row.querySelector(".side-item-price").value) || 0;
    totalOrders += price * qty;
  });

  const grandTotal = totalOrders; 

  const paidAmount = parseFloat(document.getElementById("paidAmount").value) || 0;
  const remaining = Math.max(0, grandTotal - paidAmount);

  document.getElementById("bookingTotalDisplay").textContent = totalOrders.toFixed(2) + " ر.س";
  document.getElementById("grandTotalDisplay").textContent = grandTotal.toFixed(2) + " ر.س";
  document.getElementById("remainingDisplay").textContent = remaining.toFixed(2) + " ر.س";

  return grandTotal;
}

// ============================================================
// 13. SAVE BOOKING 
// ============================================================
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
      const rowId = row.dataset.id || "";
      sideOrders.push({
        id: rowId,
        item_id: itemId,
        name: item
          ? item.name
          : sel.options[sel.selectedIndex]?.text.split(" - ")[0] || "صنف",
        price: price,
        quantity: qty,
        total: price * qty,
      });
    }
  });

  if (sideOrders.length === 0) {
    showToast("⚠️ يرجى إضافة صنف واحد على الأقل");
    return;
  }

  const platesDeposit =
    parseFloat(document.getElementById("platesDeposit").value) || 0;
  const totalOrders = sideOrders.reduce((sum, s) => sum + s.total, 0);
  
  const grandTotal = totalOrders; 
  
  const paidAmount =
    parseFloat(document.getElementById("paidAmount").value) || 0;
  const paymentMethod =
    document.getElementById("paymentMethod").value || "نقدي";
  const remaining = Math.max(0, grandTotal - paidAmount);

  let bookingDate = document.getElementById("bookingDate").value;
  let bookingTime = document.getElementById("bookingTime").value;

  if (!bookingDate) {
    bookingDate = new Date().toISOString().split("T")[0];
  }
  if (!bookingTime) {
    bookingTime = "12:00";
  }

  pendingBooking = {
    id: appData.editingId,
    customer: {
      name: name,
      phone: document.getElementById("custPhone").value,
      location: document.getElementById("custLocation").value,
    },
    booking: {
      date: bookingDate,
      time: bookingTime,
      mark: document.getElementById("bookingMark").value,
      day: getDayName(bookingDate),
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
    payment: { method: paymentMethod },
    status: "new",
    createdAt: new Date().toISOString(),
  };

  showConfirmModal(pendingBooking);
}

function showConfirmModal(booking) {
  document.getElementById("confirmCustName").textContent = booking.customer.name;
  document.getElementById("confirmBookingDate").textContent = formatDateForDisplay(booking.booking.date);
  document.getElementById("confirmBookingTime").textContent = convertTimeTo12H(booking.booking.time);
  document.getElementById("confirmLocation").textContent = booking.customer.location || "-";
  document.getElementById("confirmMark").textContent = booking.booking.mark || "-";
  
  document.getElementById("confirmTotalOrders").textContent = booking.finance.totalOrders.toFixed(2) + " ر.س";
  document.getElementById("confirmPlatesDeposit").textContent = booking.platesDeposit.toFixed(2) + " ر.س";
  document.getElementById("confirmGrandTotal").textContent = booking.finance.total.toFixed(2) + " ر.س";
  
  document.getElementById("confirmPaymentMethod").textContent = booking.payment.method;
  document.getElementById("confirmPaidAmount").textContent = booking.finance.paid.toFixed(2) + " ر.س";
  document.getElementById("confirmRemaining").textContent = booking.finance.remaining.toFixed(2) + " ر.س";
  
  document.getElementById("confirmBookingModal").classList.add("active");
}

function closeConfirmModal() {
  document.getElementById("confirmBookingModal").classList.remove("active");
  pendingBooking = null;
}

async function confirmAndSave() {
  if (!pendingBooking) {
    showToast("❌ لا توجد بيانات للحفظ");
    return;
  }

  const bookingToSave = pendingBooking;
  closeConfirmModal();
  const saved = await saveBookingToAPI(bookingToSave);

  if (saved) {
    appData.editingId = null;
    showToast("✅ تم حفظ الحجز بنجاح");
    showScreen("screenBookings");
  } else {
    showToast("❌ حدث خطأ في حفظ الحجز");
  }

  pendingBooking = null;
}

// ============================================================
// 14. EDIT BOOKING 
// ============================================================
function editBooking(id) {
  const b = appData.bookings.find((x) => x.id == id);
  if (!b) {
    showToast("❌ الحجز غير موجود");
    return;
  }
  
  appData.editingId = id;
  showScreen("screenNewBooking");
  document.getElementById("bookingFormTitle").textContent = "تعديل حجز";

  document.getElementById("custName").value =
    b.customer?.name || b.customer_name || "";
  document.getElementById("custPhone").value =
    b.customer?.phone || b.customer_phone || "";
  document.getElementById("custLocation").value =
    b.customer?.location || b.customer_location || "";

  let dateVal = b.booking?.date || b.booking_date || "";
  if (dateVal && dateVal.includes("T")) {
    dateVal = dateVal.split("T")[0];
  }
  if (dateVal && dateVal.includes("/")) {
    const parts = dateVal.split("/");
    if (parts.length === 3) {
      dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  document.getElementById("bookingDate").value = dateVal;

  let timeVal = b.booking?.time || b.booking_time || "";
  if (timeVal && timeVal.includes("T")) {
    try {
      const date = new Date(timeVal);
      timeVal = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    } catch {
      /* تجاهل */
    }
  }
  if (timeVal && timeVal.includes(" ")) {
    const parts = timeVal.split(" ");
    if (parts.length === 2) {
      const t = parts[0].split(":");
      let h = parseInt(t[0]);
      const m = t[1] || "00";
      if (parts[1] === "مساءً" && h < 12) h += 12;
      if (parts[1] === "صباحاً" && h === 12) h = 0;
      timeVal = `${String(h).padStart(2, "0")}:${m}`;
    }
  }
  document.getElementById("bookingTime").value = timeVal;

  document.getElementById("bookingMark").value =
    b.booking?.mark || b.mark || "";
  document.getElementById("deliveryTime").value =
    b.booking?.deliveryTime || b.delivery_time || "ظهراً";
  document.getElementById("bookingNotes").value = b.notes || "";

  const paidAmount =
    b.finance?.paid || b.paid_amount || b.finance?.deposit || 0;
  document.getElementById("platesDeposit").value =
    b.platesDeposit || b.plates_deposit || 0;
  document.getElementById("paidAmount").value = paidAmount;
  document.getElementById("paymentMethod").value =
    b.payment?.method || b.payment_method || "نقدي";

  document.getElementById("sideOrdersContainer").innerHTML = "";

  let sideOrders = [];
  if (b.sideOrders && Array.isArray(b.sideOrders) && b.sideOrders.length > 0) {
    sideOrders = b.sideOrders;
  } else if (
    b.side_orders &&
    Array.isArray(b.side_orders) &&
    b.side_orders.length > 0
  ) {
    sideOrders = b.side_orders.map((item) => ({
      id: item.id || null,
      item_id: item.item_id || item.id,
      name: item.item_name || item.name || "صنف",
      price: item.price || 0,
      quantity: item.quantity || item.qty || 1,
      total: (item.price || 0) * (item.quantity || item.qty || 1),
    }));
  } else if (b.items && Array.isArray(b.items) && b.items.length > 0) {
    sideOrders = b.items;
  }

  sideOrders.forEach((so) => {
    const container = document.getElementById("sideOrdersContainer");

    const itemId = so.itemId || so.item_id || 0;
    const foundItem = appData.items.find((i) => i.id == itemId);
    const price = so.price || (foundItem ? foundItem.price : 0);
    const qty = so.quantity || so.qty || 1;
    const rowId = so.id || "";

    const opts = appData.items
      .map(
        (i) =>
          `<option value="${i.id}" data-price="${i.price}" ${i.id == itemId ? "selected" : ""}>${i.name} - سعر: ${i.price} ر.س</option>`,
      )
      .join("");

    const row = document.createElement("div");
    row.className =
      "flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-xl";
    row.dataset.id = rowId;
    row.innerHTML = `
      <select class="side-item-select flex-1 min-w-[120px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-black" onchange="updateSidePrice(this)">
        <option value="">اختر الصنف</option>${opts}
      </select>
      <input type="number" class="side-item-price w-20 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" placeholder="سعر" value="${price}" min="0" step="0.5" oninput="calcBookingTotal()">
      <input type="number" class="side-item-qty w-16 border-2 border-gray-200 rounded-xl px-2 py-2 text-center text-sm bg-white focus:border-black" value="${qty}" min="1" oninput="calcBookingTotal()">
      <button onclick="this.parentElement.remove();calcBookingTotal();" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center btn-press">
        <i class="fas fa-times text-xs"></i>
      </button>
    `;
    container.appendChild(row);
  });

  calcBookingTotal();

  if (sideOrders.length === 0) {
    addSideOrderRow();
  }
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

function viewInvoice(id) {
  const b = appData.bookings.find((x) => x.id == id);
  if (!b) {
    showToast("❌ لا توجد بيانات للفاتورة");
    return;
  }

  function getItemName(item) {
    if (item.name && item.name !== "صنف") return item.name;
    const itemId = item.itemId || item.item_id;
    if (itemId) {
      const found = appData.items.find((i) => i.id == itemId);
      if (found) return found.name;
    }
    return "صنف";
  }

  const invoiceData = {
    id: b.id,
    status: b.status,
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
      name: getItemName(item),
      qty: item.quantity || 1,
      price: item.price || 0,
      total: (item.price || 0) * (item.quantity || 1),
    })),
    total: (b.finance?.total || 0).toFixed(2),
    platesDeposit: (b.platesDeposit || b.plates_deposit || 0).toFixed(2),
    notes: b.notes || "",
    deposit: (b.finance?.deposit || b.finance?.paid || b.paid_amount || 0).toFixed(2),
    remaining: Math.max(
      0,
      (b.finance?.total || 0) - (b.finance?.deposit || b.finance?.paid || b.paid_amount || 0),
    ).toFixed(2),
    restaurant: appData.settings.restaurant || defaultSettings.restaurant,
  };

  localStorage.setItem("preview_invoice_data", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

// ============================================================
// 16. ITEMS (CRUD)
// ============================================================
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
// 17. SETTINGS
// ============================================================
function fillSettings() {
  const restName = document.getElementById("restName");
  if (!restName) return;

  const r = appData.settings.restaurant || defaultSettings.restaurant;

  restName.value = r.restaurant_name || r.name || "";
  const restSubtitle = document.getElementById("restSubtitle");
  if (restSubtitle)
    restSubtitle.value = r.restaurant_subtitle || r.subtitle || "";
  const restPhone = document.getElementById("restPhone");
  if (restPhone) restPhone.value = r.restaurant_phone || r.phone || "";
  const restDelivery = document.getElementById("restDelivery");
  if (restDelivery)
    restDelivery.value = r.restaurant_delivery || r.delivery || "";
  const restAddress = document.getElementById("restAddress");
  if (restAddress) restAddress.value = r.restaurant_address || r.address || "";
  const restSocial = document.getElementById("restSocial");
  if (restSocial) restSocial.value = r.restaurant_social || r.social || "";

  const logo = r.restaurant_logo || r.logo || "";
  const logoPreview = document.getElementById("logoPreview");
  const logoPlaceholder = document.getElementById("logoPlaceholder");
  const removeLogoBtn = document.getElementById("removeLogoBtn");

  if (
    logoPreview &&
    logo &&
    (logo.startsWith("data:image") || logo.startsWith("http"))
  ) {
    logoPreview.src = logo;
    logoPreview.classList.remove("hidden");
    if (logoPlaceholder) logoPlaceholder.classList.add("hidden");
    if (removeLogoBtn) removeLogoBtn.classList.remove("hidden");
  } else {
    if (logoPreview) logoPreview.classList.add("hidden");
    if (logoPlaceholder) logoPlaceholder?.classList.remove("hidden");
    if (removeLogoBtn) removeLogoBtn?.classList.add("hidden");
  }

  disableEditing();
  updateInstallButton();
}

function enableEditing() {
  document
    .querySelectorAll(".settings-field")
    .forEach((el) => (el.disabled = false));
  document
    .querySelectorAll(".settings-action")
    .forEach((el) => (el.style.display = "block"));
  const editBtn = document.getElementById("editSettingsBtn");
  const saveBtn = document.getElementById("saveSettingsBtn");
  if (editBtn) editBtn.style.display = "none";
  if (saveBtn) saveBtn.style.display = "flex";
  showToast("📝 يمكنك تعديل البيانات الآن");
}

function disableEditing() {
  document
    .querySelectorAll(".settings-field")
    .forEach((el) => (el.disabled = true));
  document
    .querySelectorAll(".settings-action")
    .forEach((el) => (el.style.display = "none"));
  const editBtn = document.getElementById("editSettingsBtn");
  const saveBtn = document.getElementById("saveSettingsBtn");
  if (editBtn) editBtn.style.display = "flex";
  if (saveBtn) saveBtn.style.display = "none";
}

function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("⚠️ حجم الصورة كبير جداً (الحد الأقصى 2MB)");
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast("⚠️ يرجى اختيار ملف صورة صحيح");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    const imageData = e.target.result;
    appData.settings.restaurant.logo = imageData;
    appData.settings.restaurant.restaurant_logo = imageData;
    const logoPreview = document.getElementById("logoPreview");
    if (logoPreview) {
      logoPreview.src = imageData;
      logoPreview.classList.remove("hidden");
    }
    const placeholder = document.getElementById("logoPlaceholder");
    if (placeholder) placeholder.classList.add("hidden");
    const removeBtn = document.getElementById("removeLogoBtn");
    if (removeBtn) removeBtn.classList.remove("hidden");
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
  const logoPreview = document.getElementById("logoPreview");
  if (logoPreview) {
    logoPreview.src = "";
    logoPreview.classList.add("hidden");
  }
  const placeholder = document.getElementById("logoPlaceholder");
  if (placeholder) placeholder.classList.remove("hidden");
  const removeBtn = document.getElementById("removeLogoBtn");
  if (removeBtn) removeBtn.classList.add("hidden");
  document.getElementById("restLogo").value = "";
  showToast("🗑️ تم حذف الشعار، اضغط حفظ الإعدادات");
}

async function saveSettings() {
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
    disableEditing();
    fillSettings();
  } else {
    showToast("❌ حدث خطأ في حفظ الإعدادات");
  }
}

// ============================================================
// 18. BACKUP (Local)
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
// 19. TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastText").textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove("show"), 2800);
}

// ============================================================
// 20. PWA INSTALL – تحكم كامل
// ============================================================
let deferredPrompt;
const installBanner = document.getElementById("installBanner");

let pwaInstalled = localStorage.getItem("pwaInstalled") === "true";
let installBannerDismissed =
  localStorage.getItem("installBannerDismissed") === "true";

function updateInstallButton() {
  const section = document.getElementById("installAppSection");
  const btn = document.getElementById("installAppBtn");
  const status = document.getElementById("installAppStatus");
  if (!section || !btn || !status) return;

  if (pwaInstalled) {
    btn.style.display = "none";
    status.style.display = "block";
    status.textContent = "✅ التطبيق مثبت بالفعل";
  } else if (deferredPrompt) {
    btn.style.display = "flex";
    status.style.display = "none";
  } else {
    btn.style.display = "none";
    status.style.display = "block";
    status.textContent = "⚠️ التثبيت غير متاح حالياً (تأكد من HTTPS)";
  }
}

function dismissInstallBanner() {
  installBanner.classList.remove("show");
  installBannerDismissed = true;
  localStorage.setItem("installBannerDismissed", "true");
  updateInstallButton();
}

document.getElementById("installBtn").addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      showToast("تم تثبيت التطبيق 🎉");
      pwaInstalled = true;
      localStorage.setItem("pwaInstalled", "true");
    } else {
      showToast("تم إلغاء التثبيت");
      installBannerDismissed = true;
      localStorage.setItem("installBannerDismissed", "true");
    }
    deferredPrompt = null;
    installBanner.classList.remove("show");
    updateInstallButton();
  } else {
    showToast(
      "⚠️ تأكد من فتح الموقع عبر HTTPS أو localhost، أو استخدم زر 'إضافة للشاشة الرئيسية' في متصفحك",
    );
  }
});

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((result) => {
      if (result.outcome === "accepted") {
        pwaInstalled = true;
        localStorage.setItem("pwaInstalled", "true");
        showToast("تم تثبيت التطبيق 🎉");
      } else {
        installBannerDismissed = true;
        localStorage.setItem("installBannerDismissed", "true");
        showToast("تم إلغاء التثبيت");
      }
      deferredPrompt = null;
      installBanner.classList.remove("show");
      updateInstallButton();
    });
  } else {
    showToast("⚠️ لا يمكن تثبيت التطبيق حالياً، تأكد من فتح الموقع عبر HTTPS");
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!pwaInstalled && !installBannerDismissed) {
    installBanner.classList.add("show");
  }
  updateInstallButton();
});

window.addEventListener("appinstalled", () => {
  pwaInstalled = true;
  localStorage.setItem("pwaInstalled", "true");
  installBanner.classList.remove("show");
  showToast("تم تثبيت التطبيق بنجاح");
  updateInstallButton();
});

setTimeout(updateInstallButton, 1000);

// ============================================================
// 21. INIT
// ============================================================
async function init() {
  if (document.getElementById("invoicePrintArea")) {
    return;
  }

  const token = localStorage.getItem("auth_token");
  if (token) {
    authToken = token;
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
    showScreen("screenLogin");
    document.getElementById("screenSplash").classList.remove("active");
  }
}

document.addEventListener("DOMContentLoaded", init);