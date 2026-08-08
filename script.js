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
    showToast(
      "المتصفح لا يدعم التثبيت التلقائي، يمكنك الإضافة يدوياً من قائمة المتصفح",
    );
  }
});

// ============================================================
// DATA
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
    logo: "", // تم إضافة حقل الشعار
  },
};

const defaultItems = [
  { id: 1, name: "أرز بسمتي", price: 25, category: "side" },
  { id: 2, name: "سلطة خضراء", price: 15, category: "side" },
  { id: 3, name: "تبولة", price: 12, category: "side" },
  { id: 4, name: "حمص", price: 10, category: "side" },
  { id: 5, name: "مشاوي مشكلة", price: 80, category: "side" },
  { id: 6, name: "دجاج مشوي", price: 45, category: "side" },
  { id: 7, name: "خبز", price: 2, category: "side" },
  { id: 8, name: "ماء", price: 1, category: "side" },
  { id: 9, name: "عصير برتقال", price: 8, category: "side" },
  { id: 10, name: "فحم", price: 15, category: "other" },
];

let appData = {
  settings: JSON.parse(JSON.stringify(defaultSettings)),
  items: JSON.parse(JSON.stringify(defaultItems)),
  bookings: [],
  currentFilter: "all",
  editingId: null,
  tempBookingId: null,
  currentInvoiceId: null,
};

// ============================================================
// INIT
// ============================================================
function init() {
  loadData();
  setTimeout(() => {
    showScreen("screenHome");
    updateStats();
    renderTodayBookings();
    renderUpcomingBookings();
    renderAllBookings();
    renderItems();
    fillSettings();
  }, 1500);
}

function loadData() {
  const saved = localStorage.getItem("shawatiApp");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appData.settings = parsed.settings || appData.settings;
      appData.items = parsed.items || appData.items;
      appData.bookings = parsed.bookings || [];
    } catch (e) {
      console.warn("Load error", e);
    }
  }
}

function saveData() {
  localStorage.setItem(
    "shawatiApp",
    JSON.stringify({
      settings: appData.settings,
      items: appData.items,
      bookings: appData.bookings,
    }),
  );
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
    '.nav-btn[data-screen="' + screenId + '"]',
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
  const allBookings = appData.bookings;
  const todayCount = allBookings.filter(
    (b) => b.booking.date === today && b.status !== "cancelled",
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
    totalRevenue += b.finance.total || 0;
    totalDeposits += b.finance.deposit || 0;
    totalRemaining += b.finance.remaining || 0;
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
  [
    "custName",
    "custPhone",
    "custLocation",
    "bookingMark",
    "bookingNotes",
    "depositAmount",
    "platesDeposit",
  ].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("bookingDate").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("bookingTime").value = "12:00";
  document.getElementById("deliveryTime").value = "ظهراً";
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
  let total = 0;
  document.querySelectorAll("#sideOrdersContainer > div").forEach((row) => {
    const sel = row.querySelector(".side-item-select");
    const qty = parseInt(row.querySelector(".side-item-qty").value) || 0;
    const price = parseFloat(row.querySelector(".side-item-price").value) || 0;
    total += price * qty;
  });
  const depositPaid =
    parseFloat(document.getElementById("depositAmount").value) || 0;
  const platesDeposit =
    parseFloat(document.getElementById("platesDeposit").value) || 0;
  const grandTotal = total + platesDeposit;
  document.getElementById("bookingTotalDisplay").textContent =
    grandTotal.toFixed(2) + " ر.س";
  document.getElementById("remainingDisplay").textContent =
    Math.max(0, grandTotal - depositPaid).toFixed(2) + " ر.س";
  return grandTotal;
}

function saveBooking() {
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

  const platesDeposit =
    parseFloat(document.getElementById("platesDeposit").value) || 0;
  const totalOrders = sideOrders.reduce((sum, s) => sum + s.total, 0);
  const grandTotal = totalOrders + platesDeposit;
  const depositPaid =
    parseFloat(document.getElementById("depositAmount").value) || 0;
  const existing = appData.editingId
    ? appData.bookings.find((b) => b.id == appData.editingId)
    : null;

  const booking = {
    id: appData.editingId || Date.now(),
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
      deposit: depositPaid,
      remaining: Math.max(0, grandTotal - depositPaid),
    },
    status: existing ? existing.status : "new",
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };

  if (appData.editingId) {
    const idx = appData.bookings.findIndex((b) => b.id == appData.editingId);
    if (idx !== -1) appData.bookings[idx] = booking;
    appData.editingId = null;
    showToast("تم تحديث الحجز");
  } else {
    appData.bookings.push(booking);
    showToast("تم حفظ الحجز");
  }
  saveData();
  showScreen("screenBookings");
}

function getDayName(dateStr) {
  if (!dateStr) return "";
  const days = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return days[new Date(dateStr).getDay()];
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

function renderBookingCard(b, showActions) {
  let html = `<div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50/80" data-id="${b.id}">`;
  html += `<div class="flex items-start justify-between"><div><h3 class="font-bold text-base">${b.customer.name}</h3><p class="text-xs text-gray-400">${b.customer.phone || "لا يوجد رقم"}</p></div>`;
  html += `<span class="${getStatusClass(b.status)} px-3 py-1 rounded-full text-[10px] font-bold">${getStatusLabel(b.status)}</span></div>`;
  html += `<div class="flex items-center gap-4 text-xs text-gray-500 mt-2.5 bg-gray-50 rounded-xl px-3 py-2">`;
  html += `<span><i class="far fa-calendar ml-1 text-blue-500"></i>${b.booking.date}</span>`;
  html += `<span><i class="far fa-clock ml-1 text-purple-500"></i>${b.booking.time}</span>`;
  html += `<span class="font-bold text-green-600"><i class="fas fa-money-bill ml-1"></i>${b.finance.total.toFixed(0)} ر.س</span></div>`;
  if (showActions) {
    html += `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">`;
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
  const list = appData.bookings
    .filter((b) => b.booking.date === today && b.status !== "cancelled")
    .sort((a, b) => a.booking.time.localeCompare(b.booking.time));
  const el = document.getElementById("todayBookingsList");
  if (!list.length) {
    el.innerHTML = `<div class="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><i class="fas fa-calendar-day text-3xl mb-2 opacity-40"></i><p class="text-sm font-medium">لا توجد حجوزات اليوم</p></div>`;
  } else {
    el.innerHTML = list.map((b) => renderBookingCard(b, false)).join("");
  }
}

function renderUpcomingBookings() {
  const today = new Date().toISOString().split("T")[0];
  const list = appData.bookings
    .filter((b) => b.booking.date > today && b.status !== "cancelled")
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date))
    .slice(0, 5);
  const el = document.getElementById("upcomingBookingsList");
  if (!list.length) {
    el.innerHTML = `<div class="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><i class="fas fa-calendar-alt text-3xl mb-2 opacity-40"></i><p class="text-sm font-medium">لا توجد حجوزات قادمة</p></div>`;
  } else {
    el.innerHTML = list.map((b) => renderBookingCard(b, false)).join("");
  }
}

function renderAllBookings() {
  let list = [...appData.bookings].sort((a, b) => b.id - a.id);
  if (appData.currentFilter !== "all")
    list = list.filter((b) => b.status === appData.currentFilter);
  const search = (
    document.getElementById("searchBookings")?.value || ""
  ).toLowerCase();
  if (search)
    list = list.filter(
      (b) =>
        b.customer.name.toLowerCase().includes(search) ||
        b.customer.phone.includes(search) ||
        b.booking.date.includes(search),
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
// EDIT / DELETE / STATUS
// ============================================================
function editBooking(id) {
  const b = appData.bookings.find((x) => x.id == id);
  if (!b) return;
  appData.editingId = id;
  showScreen("screenNewBooking");
  document.getElementById("bookingFormTitle").textContent = "تعديل حجز";
  document.getElementById("custName").value = b.customer.name;
  document.getElementById("custPhone").value = b.customer.phone;
  document.getElementById("custLocation").value = b.customer.location;
  document.getElementById("bookingDate").value = b.booking.date;
  document.getElementById("bookingTime").value = b.booking.time;
  document.getElementById("bookingMark").value = b.booking.mark;
  document.getElementById("deliveryTime").value =
    b.booking.deliveryTime || "ظهراً";
  document.getElementById("bookingNotes").value = b.notes;
  document.getElementById("platesDeposit").value = b.platesDeposit || 0;
  document.getElementById("depositAmount").value = b.finance.deposit;
  document.getElementById("sideOrdersContainer").innerHTML = "";
  b.sideOrders.forEach((so) => {
    const container = document.getElementById("sideOrdersContainer");
    const opts = appData.items
      .map(
        (i) =>
          `<option value="${i.id}" data-price="${i.price}" ${i.id == so.id ? "selected" : ""}>${i.name} - سعر: ${i.price} ر.س</option>`,
      )
      .join("");
    const row = document.createElement("div");
    row.className =
      "flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-xl";
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
  document.getElementById("confirmBtn").onclick = function () {
    appData.bookings = appData.bookings.filter(
      (b) => b.id != appData.tempBookingId,
    );
    saveData();
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

function changeStatus(status) {
  const b = appData.bookings.find((x) => x.id == appData.tempBookingId);
  if (b) {
    b.status = status;
    saveData();
    renderAllBookings();
    updateStats();
    showToast("تم تغيير الحالة");
  }
  closeModal();
}

function closeModal() {
  document
    .querySelectorAll(".modal-overlay")
    .forEach((m) => m.classList.remove("active"));
}

// ============================================================
// CONVERT TIME TO 12-HOUR FORMAT
// ============================================================
function convertTimeTo12H(time24) {
  if (!time24) return "";
  const parts = time24.split(":");
  let hours = parseInt(parts[0]);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "مساءً" : "صباحاً";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// ============================================================
// INVOICE
// ============================================================
function viewInvoice(id) {
  const b = appData.bookings.find((x) => x.id == id);
  if (!b) return;
  appData.tempBookingId = id;
  appData.currentInvoiceId = id;
  renderEditableInvoice(b);
  showScreen("screenInvoice");
}

function renderEditableInvoice(b) {
  const r = appData.settings.restaurant;

  let sideRows = "";
  b.sideOrders.forEach((s, index) => {
    sideRows += `
      <tr>
        <td class="border border-gray-200 px-2 py-1 text-center text-sm">${s.name}</td>
        <td class="border border-gray-200 px-2 py-1 text-center">
          <input type="number" class="invoice-editable-input inv-qty" data-index="${index}" value="${s.quantity}" min="1" onchange="updateInvoiceRow(${index})">
        </td>
        <td class="border border-gray-200 px-2 py-1 text-center">
          <input type="number" class="invoice-editable-input inv-price" data-index="${index}" value="${s.price}" min="0" step="0.5" onchange="updateInvoiceRow(${index})">
        </td>
        <td class="border border-gray-200 px-2 py-1 text-center font-bold inv-total" id="inv-total-${index}">${(s.price * s.quantity).toFixed(2)}</td>
      </tr>
    `;
  });

  const totalOrders = b.sideOrders.reduce(
    (sum, s) => sum + s.price * s.quantity,
    0,
  );
  const platesDeposit = b.platesDeposit || 0;
  const grandTotal = totalOrders + platesDeposit;
  const remaining = grandTotal - b.finance.deposit;

  const time12 = convertTimeTo12H(b.booking.time);

  // التحقق من وجود شعار مخصص للمطعم لعرضه بدلاً من الشعار الافتراضي
  let logoHtml = `<div class="w-14 h-14 rounded-2xl bg-black flex items-center justify-center"><i class="fas fa-utensils text-white text-xl"></i></div>`;
  if (r.logo) {
    logoHtml = `<div class="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"><img src="${r.logo}" alt="logo" class="w-full h-full object-contain"></div>`;
  }

  let html = `<div id="invoicePrintArea" class="invoice-paper" style="font-family:Cairo,sans-serif;">`;
  html += `<div class="flex items-center justify-between mb-4 border-b-2 border-black pb-3"><div class="text-right"><p class="text-[10px] text-gray-500">${r.subtitle}</p><h2 class="text-xl font-black">${r.name}</h2><p class="text-[10px] text-gray-500">${r.specialty}</p></div>${logoHtml}</div>`;
  html += `<div class="flex items-center justify-between mb-3 text-[11px] text-gray-500"><div>${r.social}</div><div class="bg-black text-white px-3 py-0.5 rounded-full text-[10px] font-bold">حجز وليمة</div><div><i class="fas fa-phone"></i> ${r.phone}</div></div>`;
  html += `<div class="flex items-center justify-between mb-3 text-sm font-bold"><span>التاريخ: ${b.booking.date}</span><span>اليوم: ${b.booking.day}</span><span>الساعة: ${time12}</span></div>`;
  html += `<div class="flex items-center justify-between mb-3 text-sm"><span class="font-bold">موعد التسليم: ${b.booking.deliveryTime || "ظهراً"}</span></div>`;
  html += `<div class="border-2 border-black rounded-xl p-3 mb-3"><div class="grid grid-cols-2 gap-1.5 text-sm"><div><span class="font-bold">العميل:</span> ${b.customer.name}</div><div><span class="font-bold">الجوال:</span> ${b.customer.phone || "-"}</div><div><span class="font-bold">الموقع:</span> ${b.customer.location || "-"}</div><div><span class="font-bold">العلامة:</span> ${b.booking.mark || "-"}</div></div></div>`;

  html += `<div class="mb-3"><div class="bg-black text-white text-center rounded-lg py-0.5 text-[10px] font-bold mb-1.5">الطلبات الجانبية (قابل للتعديل)</div><table class="w-full text-xs" style="border-collapse:collapse;"><thead><tr class="bg-black text-white"><th class="border border-gray-300 px-2 py-1">الصنف</th><th class="border border-gray-300 px-2 py-1">العدد</th><th class="border border-gray-300 px-2 py-1">السعر</th><th class="border border-gray-300 px-2 py-1">الإجمالي</th></tr></thead><tbody>${sideRows || '<tr><td colspan="4" class="border border-gray-200 px-2.5 py-1.5 text-center text-gray-400">لا توجد طلبات جانبية</td></tr>'}</tbody></table></div>`;

  html += `<div class="flex items-center justify-between mb-2 text-sm border-b border-gray-200 pb-1"><span class="font-bold">تأمين الصحون</span><span class="font-bold" id="invPlatesDeposit">${platesDeposit.toFixed(2)} ر.س</span></div>`;
  if (b.notes) {
    html += `<div class="border-2 border-black rounded-xl p-3 mb-3"><div class="bg-black text-white text-center rounded-lg py-0.5 text-[10px] font-bold mb-1.5">تفاصيل الوليمة</div><p class="text-sm whitespace-pre-wrap">${b.notes}</p></div>`;
  }
  html += `<div class="border-2 border-black rounded-xl p-3 mb-3"><div class="grid grid-cols-2 gap-1.5 text-sm"><div><span class="font-bold">إجمالي الطلبات:</span> <span id="invTotalOrders">${totalOrders.toFixed(2)}</span> ر.س</div><div><span class="font-bold">الإجمالي (مع التأمين):</span> <span id="invGrandTotal">${grandTotal.toFixed(2)}</span> ر.س</div><div><span class="font-bold">العربون:</span> ${b.finance.deposit.toFixed(2)} ر.س</div><div class="text-red-600 font-bold"><span>المتبقي:</span> <span id="invRemainingDisplay">${Math.max(0, remaining).toFixed(2)}</span> ر.س</div></div></div>`;

  // تذييل الفاتورة مع كود QR
  html += `<div class="border-t-2 border-black mt-4 pt-3 flex flex-col items-center text-[10px] text-gray-500">`;
  html += `<div class="w-full flex items-start justify-between mb-4">`;
  html += `<div class="text-center"><i class="fas fa-map-marker-alt block mb-1"></i><p>${r.address}</p></div>`;
  html += `<div class="text-center"><p>للحجز: ${r.phone}</p><p>للتوصيل: ${r.delivery}</p></div>`;
  html += `</div>`;
  // كود QR في المساحة الفارغة أسفل الفاتورة
  html += `<div class="flex flex-col items-center">`;
  html += `<div id="invoiceQR" class="qr-container"></div>`;
  html += `<p class="text-[9px] mt-1 text-gray-400">امسح للتواصل معنا</p>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;

  document.getElementById("invoiceContainer").innerHTML = html;

  // توليد كود QR (تم تصحيح مشكلة التكرار وحجم الكود)
  setTimeout(() => {
    try {
      const qrContainer = document.getElementById("invoiceQR");
      if (qrContainer) {
        qrContainer.innerHTML = ""; // مسح الكود السابق لتفادي تكراره
        let phoneNum = (r.phone || "000").replace(/\D/g, "");
        if (phoneNum.startsWith("0")) {
          phoneNum = "966" + phoneNum.substring(1);
        }
        const waLink = `https://wa.me/${phoneNum}`;
        new QRCode(qrContainer, {
          text: waLink,
          width: 72,
          height: 72,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H,
        });
      }
    } catch (e) {
      console.error("QR Generation Error", e);
    }
  }, 200);
}

function updateInvoiceRow(index) {
  const b = appData.bookings.find((x) => x.id == appData.tempBookingId);
  if (!b) return;
  const qtyInput = document.querySelector(`.inv-qty[data-index="${index}"]`);
  const priceInput = document.querySelector(
    `.inv-price[data-index="${index}"]`,
  );
  if (!qtyInput || !priceInput) return;
  const newQty = parseInt(qtyInput.value) || 1;
  const newPrice = parseFloat(priceInput.value) || 0;
  b.sideOrders[index].quantity = newQty;
  b.sideOrders[index].price = newPrice;
  b.sideOrders[index].total = newPrice * newQty;
  document.getElementById(`inv-total-${index}`).textContent = (
    newPrice * newQty
  ).toFixed(2);
  recalcInvoiceTotals(b);
}

function recalcInvoiceTotals(b) {
  const totalOrders = b.sideOrders.reduce(
    (sum, s) => sum + s.price * s.quantity,
    0,
  );
  const platesDeposit = b.platesDeposit || 0;
  const grandTotal = totalOrders + platesDeposit;
  const remaining = grandTotal - b.finance.deposit;
  b.finance.total = grandTotal;
  b.finance.remaining = Math.max(0, remaining);
  b.finance.totalOrders = totalOrders;
  document.getElementById("invTotalOrders").textContent =
    totalOrders.toFixed(2);
  document.getElementById("invGrandTotal").textContent = grandTotal.toFixed(2);
  document.getElementById("invRemainingDisplay").textContent = Math.max(
    0,
    remaining,
  ).toFixed(2);
  document.getElementById("invPlatesDeposit").textContent =
    platesDeposit.toFixed(2) + " ر.س";
}

function saveInvoiceChanges() {
  const b = appData.bookings.find((x) => x.id == appData.tempBookingId);
  if (!b) return;
  const idx = appData.bookings.findIndex((x) => x.id == appData.tempBookingId);
  if (idx !== -1) {
    appData.bookings[idx] = b;
    saveData();
    showToast("تم حفظ التعديلات بنجاح");
    renderEditableInvoice(b);
  } else {
    showToast("خطأ في حفظ التعديلات");
  }
}

// ============================================================
// PRINT & SHARE & PDF
// ============================================================
function printInvoice() {
  window.print();
}

async function shareInvoiceWhatsApp() {
  const b = appData.bookings.find((x) => x.id == appData.tempBookingId);
  if (!b) {
    showToast("لا توجد فاتورة");
    return;
  }

  try {
    showToast("جاري تجهيز الملف...");
    saveInvoiceChanges();
    const b2 = appData.bookings.find((x) => x.id == appData.tempBookingId);
    if (!b2) return;
    renderEditableInvoice(b2);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const blob = await generatePdfBlob();
    if (!blob) return;

    const file = new File(
      [blob],
      `فاتورة_${b2.customer.name}_${b2.booking.date}.pdf`,
      { type: "application/pdf" },
    );

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "فاتورة حجز - شواطئ عدن",
        text: `فاتورة حجز ${b2.customer.name}`,
        files: [file],
      });
      showToast("تمت المشاركة بنجاح");
      return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `فاتورة_${b2.customer.name}_${b2.booking.date}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);

    const r = appData.settings.restaurant;
    const totalOrders = b2.sideOrders.reduce(
      (sum, s) => sum + s.price * s.quantity,
      0,
    );
    const platesDeposit = b2.platesDeposit || 0;
    const grandTotal = totalOrders + platesDeposit;
    const time12 = convertTimeTo12H(b2.booking.time);
    const text =
      `*فاتورة حجز - ${r.name}*%0A%0A` +
      `*العميل:* ${b2.customer.name}%0A` +
      `*التاريخ:* ${b2.booking.date} ${time12}%0A` +
      `*موعد التسليم:* ${b2.booking.deliveryTime || "ظهراً"}%0A` +
      `*إجمالي الطلبات:* ${totalOrders.toFixed(2)} ر.س%0A` +
      `*تأمين الصحون:* ${platesDeposit.toFixed(2)} ر.س%0A` +
      `*الإجمالي الكلي:* ${grandTotal.toFixed(2)} ر.س%0A` +
      `*العربون:* ${b2.finance.deposit.toFixed(2)} ر.س%0A` +
      `*المتبقي:* ${Math.max(0, grandTotal - b2.finance.deposit).toFixed(2)} ر.س%0A%0A` +
      `*${r.name}* - ${r.phone}`;
    window.open(`https://wa.me/?text=${text}`, "_blank");
    showToast("تم تحميل الملف للمشاركة");
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ، حاول مرة أخرى");
  }
}

async function generatePdfBlob() {
  const element = document.getElementById("invoicePrintArea");
  if (!element) {
    showToast("لا توجد فاتورة");
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 400,
      height: element.scrollHeight,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById("invoicePrintArea");
        if (clonedEl) {
          clonedEl.style.transform = "none";
          clonedEl.style.opacity = "1";
        }
      },
    });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const xOffset = (210 - imgWidth) / 2;
    const yOffset = (297 - imgHeight) / 2;

    pdf.addImage(
      imgData,
      "PNG",
      xOffset,
      Math.max(0, yOffset),
      imgWidth,
      imgHeight,
    );
    return pdf.output("blob");
  } catch (e) {
    console.error("PDF error:", e);
    showToast("خطأ في إنشاء PDF");
    return null;
  }
}

async function downloadPDF() {
  saveInvoiceChanges();
  const b = appData.bookings.find((x) => x.id == appData.tempBookingId);
  if (b) renderEditableInvoice(b);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const blob = await generatePdfBlob();
  if (!blob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `فاتورة_${b?.customer?.name || "حجز"}_${b?.booking?.date || ""}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  showToast("تم تحميل PDF");
}

// ============================================================
// ITEMS (بدون حقل النوع)
// ============================================================
function renderItems() {
  const search = (
    document.getElementById("searchItems")?.value || ""
  ).toLowerCase();
  let list = appData.items;
  if (search) list = list.filter((i) => i.name.toLowerCase().includes(search));
  const el = document.getElementById("itemsList");
  el.innerHTML = list
    .map(
      (i) =>
        `<div class="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-gray-50/80">
      <div>
        <p class="font-bold text-sm">${i.name}</p>
        <div class="flex gap-3 text-xs text-gray-500 mt-0.5">
          <span>السعر: ${i.price.toFixed(2)} ر.س</span>
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
    </div>`,
    )
    .join("");
}

function filterItems() {
  renderItems();
}

function addItem() {
  const name = document.getElementById("newItemName").value.trim();
  const price = parseFloat(document.getElementById("newItemPrice").value) || 0;
  if (!name || price <= 0) {
    showToast("يرجى إدخال الاسم والسعر");
    return;
  }
  appData.items.push({ id: Date.now(), name, price, category: "other" });
  saveData();
  document.getElementById("newItemName").value = "";
  document.getElementById("newItemPrice").value = "";
  renderItems();
  showToast("تم إضافة الصنف");
}

function deleteItem(id) {
  appData.tempDeleteId = id;
  document.getElementById("confirmText").textContent =
    "هل أنت متأكد من حذف هذا الصنف؟";
  document.getElementById("confirmBtn").onclick = function () {
    appData.items = appData.items.filter((i) => i.id != appData.tempDeleteId);
    saveData();
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

function updateItem() {
  const id = parseInt(document.getElementById("editItemId").value);
  const item = appData.items.find((i) => i.id == id);
  if (!item) {
    showToast("خطأ في التعديل");
    return;
  }
  const name = document.getElementById("editItemName").value.trim();
  const price = parseFloat(document.getElementById("editItemPrice").value) || 0;
  if (!name || price <= 0) {
    showToast("يرجى إدخال اسم وسعر صحيح");
    return;
  }
  item.name = name;
  item.price = price;
  saveData();
  renderItems();
  closeModal();
  showToast("تم تحديث الصنف");
}

// ============================================================
// SETTINGS (شاملة تعديل الشعار)
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

function fillSettings() {
  const r = appData.settings.restaurant;
  document.getElementById("restName").value = r.name;
  document.getElementById("restSubtitle").value = r.subtitle;
  document.getElementById("restPhone").value = r.phone;
  document.getElementById("restDelivery").value = r.delivery;
  document.getElementById("restAddress").value = r.address;
  document.getElementById("restSocial").value = r.social;

  if (r.logo) {
    document.getElementById("logoPreview").src = r.logo;
    document.getElementById("logoPreview").classList.remove("hidden");
    document.getElementById("removeLogoBtn").classList.remove("hidden");
  } else {
    document.getElementById("logoPreview").classList.add("hidden");
    document.getElementById("removeLogoBtn").classList.add("hidden");
  }
}

function saveSettings() {
  const currentLogo = appData.settings.restaurant.logo;
  appData.settings.restaurant = {
    name: document.getElementById("restName").value || "شواطئ عدن",
    subtitle: document.getElementById("restSubtitle").value || "مطابخ ومطاعم",
    specialty: appData.settings.restaurant.specialty,
    phone: document.getElementById("restPhone").value || "",
    delivery: document.getElementById("restDelivery").value || "",
    address: document.getElementById("restAddress").value || "",
    social: document.getElementById("restSocial").value || "",
    logo: currentLogo,
  };
  saveData();
  showToast("تم حفظ الإعدادات");
  showScreen("screenHome");
}

// ============================================================
// BACKUP
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
      saveData();
      showToast("تم استيراد البيانات");
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
