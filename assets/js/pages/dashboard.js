document.addEventListener("DOMContentLoaded", function () {
  const today = new Date().toISOString().slice(0, 10);

  const mockBookings = [
    {
      id: 1,
      customer: "أحمد محمد",
      eventDate: today,
      guests: 50,
      status: "مؤكد",
      total: 8500,
      paid: 6000,
    },
    {
      id: 2,
      customer: "سارة علي",
      eventDate: today,
      guests: 30,
      status: "جديد",
      total: 4200,
      paid: 0,
    },
    {
      id: 3,
      customer: "محمد العتيبي",
      eventDate: "2026-08-25",
      guests: 80,
      status: "مؤكد",
      total: 12500,
      paid: 5000,
    },
    {
      id: 4,
      customer: "نورة الحمد",
      eventDate: "2026-08-28",
      guests: 20,
      status: "جديد",
      total: 2800,
      paid: 0,
    },
    {
      id: 5,
      customer: "خالد السبيعي",
      eventDate: "2026-08-30",
      guests: 45,
      status: "مؤكد",
      total: 6700,
      paid: 6700,
    },
  ];

  function formatCurrency(amount) {
    if (window.API && typeof window.API.formatCurrency === "function") {
      return window.API.formatCurrency(amount);
    }
    return Number(amount || 0).toLocaleString("ar-SA") + " ر.س";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderDashboard() {
    const todayBookings = mockBookings.filter(
      (booking) => booking.eventDate === today,
    );
    const future = mockBookings.filter((booking) => {
      if (booking.eventDate === today) return false;
      const diff = new Date(booking.eventDate) - new Date(today);
      return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    });

    const receivables = mockBookings.filter(
      (booking) => booking.total - booking.paid > 0,
    );
    const totalReceivables = receivables.reduce(
      (sum, booking) => sum + (booking.total - booking.paid),
      0,
    );
    const todayRevenue = todayBookings.reduce(
      (sum, booking) => sum + booking.total,
      0,
    );

    const todayTotal = document.getElementById("todayTotal");
    const todayCount = document.getElementById("todayCount");
    const upcomingCount = document.getElementById("upcomingCount");
    const upcomingGuests = document.getElementById("upcomingGuests");
    const receivablesTotal = document.getElementById("receivablesTotal");
    const receivablesCount = document.getElementById("receivablesCount");
    const todayRevenueEl = document.getElementById("todayRevenue");
    const activeCustomers = document.getElementById("activeCustomers");
    const supplierCount = document.getElementById("supplierCount");
    const itemCount = document.getElementById("itemCount");

    if (todayTotal) todayTotal.textContent = mockBookings.length;
    if (todayCount) todayCount.textContent = todayBookings.length;
    if (upcomingCount) upcomingCount.textContent = future.length;
    if (upcomingGuests)
      upcomingGuests.textContent = future.reduce(
        (sum, booking) => sum + booking.guests,
        0,
      );
    if (receivablesTotal)
      receivablesTotal.textContent = formatCurrency(totalReceivables);
    if (receivablesCount) receivablesCount.textContent = receivables.length;
    if (todayRevenueEl)
      todayRevenueEl.textContent = formatCurrency(todayRevenue);
    if (activeCustomers)
      activeCustomers.textContent = new Set(
        mockBookings.map((b) => b.customer),
      ).size;
    if (supplierCount) supplierCount.textContent = 4;
    if (itemCount) itemCount.textContent = 12;

    const todayList = document.getElementById("todayBookingsList");
    if (todayList) {
      if (todayBookings.length === 0) {
        todayList.innerHTML =
          '<div class="empty-state-compact"><i class="fas fa-calendar-plus"></i><span>لا توجد حجوزات مسجلة اليوم</span></div>';
      } else {
        todayList.innerHTML = todayBookings
          .map(
            (booking) => `
          <div class="list-item">
            <div class="list-item-icon" style="background: var(--primary-soft); color: var(--primary);"><i class="fas fa-user"></i></div>
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(booking.customer)}</div>
              <div class="list-item-subtitle">${booking.guests} ضيف · ${booking.eventDate}</div>
            </div>
            <span class="badge ${booking.status === "مؤكد" ? "badge-confirmed" : "badge-new"}">${booking.status}</span>
          </div>
        `,
          )
          .join("");
      }
    }

    const upcomingList = document.getElementById("upcomingBookingsList");
    const upcomingBadge = document.getElementById("upcomingBadge");
    if (upcomingBadge) upcomingBadge.textContent = `${future.length} حجز`;
    if (upcomingList) {
      if (future.length === 0) {
        upcomingList.innerHTML =
          '<div class="empty-state-compact"><i class="fas fa-calendar-alt"></i><span>لا توجد حجوزات قادمة</span></div>';
      } else {
        upcomingList.innerHTML = future
          .slice(0, 4)
          .map(
            (booking) => `
          <div class="list-item">
            <div class="list-item-icon" style="background: var(--surface-soft); color: var(--text-secondary);"><i class="fas fa-calendar"></i></div>
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(booking.customer)}</div>
              <div class="list-item-subtitle">${booking.eventDate} · ${booking.guests} ضيف</div>
            </div>
            <span class="badge ${booking.status === "مؤكد" ? "badge-confirmed" : "badge-new"}">${booking.status}</span>
          </div>
        `,
          )
          .join("");
      }
    }

    const alertList = document.getElementById("paymentAlertsList");
    const alertBadge = document.getElementById("alertBadge");
    if (alertBadge) alertBadge.textContent = receivables.length;
    if (alertList) {
      if (receivables.length === 0) {
        alertList.innerHTML =
          '<div class="empty-state-compact"><i class="fas fa-check-circle"></i><span>لا توجد تنبيهات مالية</span></div>';
      } else {
        alertList.innerHTML = receivables
          .slice(0, 3)
          .map((booking) => {
            const remaining = booking.total - booking.paid;
            return `
            <div class="list-item">
              <div class="list-item-icon" style="background: var(--danger-soft); color: var(--danger);"><i class="fas fa-exclamation"></i></div>
              <div class="list-item-content">
                <div class="list-item-title">${escapeHtml(booking.customer)}</div>
                <div class="list-item-subtitle">متبقي ${formatCurrency(remaining)}</div>
              </div>
              <button class="btn btn-sm btn-primary" type="button" onclick="showToast('يتم تجهيز صفحة التسديد','info')">تسديد</button>
            </div>
          `;
          })
          .join("");
      }
    }
  }

  if (window.layoutReady) {
    renderDashboard();
  } else {
    document.addEventListener("layout:ready", renderDashboard);
  }
});
