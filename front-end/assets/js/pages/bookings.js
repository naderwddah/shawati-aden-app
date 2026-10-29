/* =========================================================
 * Banquet Kitchen - Bookings List
 * =========================================================
 * - عرض الحجوزات ببطاقات مدمجة (4 مربعات مالية + تاريخ + وقت)
 * - بحث + فلترة + ملخص
 * - تغيير الحالة عبر Modal
 * - عند الإكمال: تسجيل دفعة مرتبطة بالحجز تلقائيًا
 * ========================================================= */

(function () {
  'use strict';

  /* =========================================================
   * الحالة
   * ========================================================= */

  let allBookings = [];
  let filteredBookings = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let loading = false;

  let paymentMethods = [];
  let currentStatusBookingId = null;
  let savingStatus = false;
  let statusModalMode = 'status';
  let visibleCount = 30;
  let deleteDialogResolve = null;
  let refundBookingId = null;
  let savingRefund = false;

  /* =========================================================
   * عناصر DOM
   * ========================================================= */

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const bookingList = document.getElementById('bookingList');
  const searchInput = document.getElementById('bookingSearch');
  const filterChips = document.getElementById('filterChips');
  const totalBookingsEl = document.getElementById('totalBookings');
  const todayBookingsEl = document.getElementById('todayBookings');
  const totalAmountEl = document.getElementById('totalAmount');

  const statusModal = document.getElementById('bookingStatusModal');
  const statusModalTitle = document.getElementById('bookingStatusModalTitle');
  const paymentSectionX = document.getElementById('paymentSectionX');
  const paymentAmountX = document.getElementById('paymentAmountX');
  const paymentMethodX = document.getElementById('paymentMethodX');
  const paymentHintX = document.getElementById('paymentHintX');
  const confirmStatusBtn = document.getElementById('confirmStatusBtn');

  /* =========================================================
   * ثوابت
   * ========================================================= */

  const STATUS = {
    new:       { label: 'جديد',   className: 'booking-status-new' },
    confirmed: { label: 'مؤكد',   className: 'booking-status-confirmed' },
    completed: { label: 'مكتمل',  className: 'booking-status-completed' },
    cancelled: { label: 'ملغي',   className: 'booking-status-cancelled' }
  };

  const ARABIC_DAYS = [
    'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
  ];

  /* =========================================================
   * أدوات مساعدة
   * ========================================================= */

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function number(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function formatCurrency(v) {
    if (window.API && typeof window.API.formatCurrency === 'function') {
      return window.API.formatCurrency(number(v));
    }
    return number(v).toLocaleString('ar-SA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }) + ' ر.س';
  }

  function formatCurrencyShort(v) {
    const n = number(v);
    try {
      return new Intl.NumberFormat('ar-SA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(n);
    } catch {
      return n.toFixed(2);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = String(value).slice(0, 10);
    const parts = date.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ar-SA');
    }
    return value;
  }

  function getArabicDay(dateValue) {
    if (!dateValue) return '';
    const d = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return ARABIC_DAYS[d.getDay()] || '';
  }

  function formatTime12(value) {
    if (!value) return '—';
    const text = String(value);
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return text;
    let hour = Number(match[1]);
    const minute = match[2];
    const period = hour >= 12 ? 'م' : 'ص';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
  }

  function getStatus(value) {
    const s = String(value || 'new').toLowerCase().trim();
    const map = {
      'جديد': 'new',
      'مؤكد': 'confirmed',
      'مكتمل': 'completed',
      'ملغي': 'cancelled',
      'ملغى': 'cancelled'
    };
    return map[s] || (STATUS[s] ? s : 'new');
  }

  function getStatusLabel(v) { return STATUS[getStatus(v)].label; }
  function getStatusClass(v) { return STATUS[getStatus(v)].className; }

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    if (payload?.data?.data && Array.isArray(payload.data.data)) return payload.data.data;
    if (payload?.bookings && Array.isArray(payload.bookings)) return payload.bookings;
    if (payload?.result && Array.isArray(payload.result)) return payload.result;
    if (payload?.items && Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function getPaymentMethodId(m) {
    if (!m) return null;
    return m.id ?? m.payment_method_id ?? null;
  }

  function getPaymentMethodName(m) {
    if (!m) return '';
    return m.name ?? m.title ?? '';
  }

  function todayString() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function nowSqlDateTime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /* =========================================================
   * تجهيز القيم بصيغة صحيحة للـ API
   * ========================================================= */

  /**
   * delivery_time بصيغة H:i فقط (مثل: "21:20")
   */
  function normalizeDeliveryTime(v) {
    if (!v) return '12:00';
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '12:00';
    const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, '0');
    return `${hh}:${m[2]}`;
  }

  /**
   * invoice_date بصيغة Y-m-d H:i:s
   */
  function normalizeInvoiceDate(v) {
    if (!v) return nowSqlDateTime();
    const s = String(v).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' 00:00:00';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s + ':00';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
      return s.replace('T', ' ').slice(0, 19);
    }

    return nowSqlDateTime();
  }

  /**
   * event_date بصيغة Y-m-d
   */
  function normalizeEventDate(v) {
    if (!v) return todayString();
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return todayString();
  }

  /* =========================================================
   * تطبيع الحجز
   * ========================================================= */

  function normalizeBooking(booking) {
    const customer = booking.customer || {};
    const items = Array.isArray(booking.items) ? booking.items : [];

    let itemsTotal = 0;
    items.forEach((it) => {
      const qty = number(it.quantity);
      const totalItem = number(it.total_price ?? it.totalPrice);
      const unit = number(it.unit_price ?? it.unitPrice ?? it.price);
      itemsTotal += totalItem > 0 ? totalItem : qty * unit;
    });

    const total = number(
      booking.total_amount ?? booking.totalAmount ?? booking.total ?? itemsTotal
    );

    let paid = number(
      booking.paid_amount ?? booking.paidAmount ??
      booking.payments_sum_amount ?? booking.payments_total ??
      booking.deposit_paid
    );

    if (!paid && Array.isArray(booking.payments)) {
      paid = booking.payments.reduce((s, p) => s + number(p.amount), 0);
    }

    const deposit = number(booking.plate_deposit ?? booking.plateDeposit);
    const returned = number(booking.plate_deposit_returned ?? booking.plateDepositReturned);
    const payable = number(booking.payable_total ?? total + deposit);
    const remaining = Math.max(0, payable - paid);

    const plateDeposit = booking.plate_deposit == null
      ? null
      : number(booking.plate_deposit);

    return {
      id: booking.id,
      customerId: booking.customer_id ?? booking.customerId ?? customer.id ?? null,
      customerName: booking.customer_name ?? booking.customerName ?? customer.name ?? 'غير معروف',
      customerPhone: booking.customer_phone ?? booking.customerPhone ?? customer.phone ?? '',
      invoiceDate: booking.invoice_date ?? booking.invoiceDate ?? '',
      eventDate: booking.event_date ?? booking.eventDate ?? '',
      deliveryTime: booking.delivery_time ?? booking.deliveryTime ?? '',
      deliveryPeriod: booking.delivery_period ?? booking.deliveryPeriod ?? '',
      deliveryAddress: booking.delivery_address ?? booking.deliveryAddress ?? booking.address ?? '',
      mark: booking.mark ?? '',
      totalAmount: total,
      payableTotal: payable,
      plateDeposit: plateDeposit,
      plateDepositReturned: booking.plate_deposit_returned == null
        ? null
        : number(booking.plate_deposit_returned),
      status: getStatus(booking.status),
      notes: booking.notes ?? '',
      items: items,
      payments: Array.isArray(booking.payments) ? booking.payments : [],
      paidAmount: paid,
      remaining: remaining,
      refundAmount: returned,
      createdAt: booking.created_at ?? booking.createdAt ?? ''
    };
  }

  /* =========================================================
   * الملخص والفلاتر
   * ========================================================= */

  function updateSummary() {
    if (totalBookingsEl) totalBookingsEl.textContent = allBookings.length.toLocaleString('ar-SA');

    const today = todayString();
    const todayCount = allBookings.filter(
      (b) => String(b.eventDate).slice(0, 10) === today
    ).length;
    if (todayBookingsEl) todayBookingsEl.textContent = todayCount.toLocaleString('ar-SA');

    const totalValue = allBookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.payableTotal, 0);
    if (totalAmountEl) {
      totalAmountEl.textContent = formatCurrencyShort(totalValue);
    }
  }

  function updateFilterCounts() {
    if (!filterChips) return;
    const counts = {
      all: allBookings.length,
      new: allBookings.filter((b) => b.status === 'new').length,
      confirmed: allBookings.filter((b) => b.status === 'confirmed').length,
      completed: allBookings.filter((b) => b.status === 'completed').length,
      cancelled: allBookings.filter((b) => b.status === 'cancelled').length
    };
    filterChips.querySelectorAll('.filter-chip').forEach((chip) => {
      const key = chip.dataset.filter;
      const c = chip.querySelector('.chip-count');
      if (c && key in counts) c.textContent = counts[key].toLocaleString('ar-SA');
    });
  }

  /* =========================================================
   * العرض
   * ========================================================= */

  function renderLoading() {
    if (!bookingList) return;
    bookingList.innerHTML = `
      <div class="bookings-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>جاري تحميل الحجوزات...</span>
      </div>`;
  }

  function renderError(message) {
    if (!bookingList) return;
    bookingList.innerHTML = `
      <div class="bookings-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>تعذر تحميل الحجوزات</h4>
        <p>${escapeHtml(message || 'حدث خطأ غير متوقع')}</p>
        <button type="button" id="retryBookingsBtn" class="btn btn-primary">إعادة المحاولة</button>
      </div>`;
    document.getElementById('retryBookingsBtn')?.addEventListener('click', loadBookings);
  }

  function renderEmpty() {
    if (!bookingList) return;
    const hasSearch = searchQuery.trim().length > 0;
    const hasFilter = currentFilter !== 'all';

    bookingList.innerHTML = `
      <div class="bookings-empty">
        <i class="fas ${hasSearch || hasFilter ? 'fa-search' : 'fa-calendar-plus'}"></i>
        <h4>${hasSearch || hasFilter ? 'لا توجد نتائج' : 'لا توجد حجوزات'}</h4>
        <p>${hasSearch || hasFilter ? 'جرّب تغيير البحث أو الفلتر' : 'ابدأ بإضافة حجز جديد'}</p>
      </div>`;
  }

  function renderBookingCard(booking) {
    const statusLabel = getStatusLabel(booking.status);
    const statusClass = getStatusClass(booking.status);

    const eventDateFormatted = formatDate(booking.eventDate);
    const dayName = getArabicDay(booking.eventDate);
    const timeFormatted = formatTime12(booking.deliveryTime);
    const period = booking.deliveryPeriod ? ` · ${booking.deliveryPeriod}` : '';

    const total = formatCurrencyShort(booking.payableTotal);
    const paid = formatCurrencyShort(booking.paidAmount);
    const remaining = formatCurrencyShort(booking.remaining);
    const deposit = formatCurrencyShort(booking.plateDeposit || 0);
    const refund = formatCurrencyShort(booking.refundAmount || 0);

    let itemsPreview = '';
    if (booking.items.length) {
      const names = booking.items.slice(0, 2).map((it) =>
        escapeHtml(it.item_name ?? it.name ?? 'صنف')
      );
      itemsPreview = names.join(' • ');
      if (booking.items.length > 2) itemsPreview += ` +${booking.items.length - 2}`;
    }

    const isCompleted = booking.status === 'completed';

    let actionButtons = '';

    if (isCompleted) {
      actionButtons = `
        <div class="booking-locked">
          <i class="fas fa-check-circle"></i> تم إكمال الحجز
        </div>
        <div class="booking-actions">
          ${booking.remaining > 0 ? `
            <button class="btn-action warning" data-action="pay-remaining" data-id="${booking.id}">
              <i class="fas fa-hand-holding-usd"></i> تسديد (${remaining})
            </button>
          ` : ''}
          ${(booking.plateDeposit || 0) > (booking.refundAmount || 0) && (booking.paidAmount || 0) > (booking.refundAmount || 0) ? `<button class="btn-action secondary" data-action="refund" data-id="${booking.id}"><i class="fas fa-undo"></i> إرجاع تأمين</button>` : ''}
          <button class="btn-action secondary" data-action="change-status" data-id="${booking.id}">
            <i class="fas fa-exchange-alt"></i> الحالة
          </button>
          <button class="btn-action primary" data-action="print" data-id="${booking.id}">
            <i class="fas fa-receipt"></i> الفاتورة
          </button>
          <button class="btn-action danger" data-action="delete" data-id="${booking.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    } else {
      actionButtons = `
        <div class="booking-actions">
          ${booking.remaining > 0 ? `<button class="btn-action warning" data-action="pay-remaining" data-id="${booking.id}" title="تسجيل دفعة"><i class="fas fa-money-bill-wave"></i> دفع</button>` : ''}
          <button class="btn-action primary" data-action="edit" data-id="${booking.id}">
            <i class="fas fa-pen"></i> تعديل
          </button>
          ${(booking.plateDeposit || 0) > (booking.refundAmount || 0) && (booking.paidAmount || 0) > (booking.refundAmount || 0) ? `<button class="btn-action secondary" data-action="refund" data-id="${booking.id}"><i class="fas fa-undo"></i> إرجاع تأمين</button>` : ''}
          <button class="btn-action secondary" data-action="change-status" data-id="${booking.id}">
            <i class="fas fa-exchange-alt"></i> الحالة
          </button>
          <button class="btn-action secondary" data-action="print" data-id="${booking.id}">
            <i class="fas fa-print"></i>
          </button>
          <button class="btn-action danger" data-action="delete" data-id="${booking.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }

    return `
      <article class="booking-card" data-id="${booking.id}">

        <div class="booking-head">
          <div class="booking-head-info">
            <h3 class="booking-name">${escapeHtml(booking.customerName)}</h3>
            ${booking.customerPhone ? `<div class="booking-phone">${escapeHtml(booking.customerPhone)}</div>` : ''}
          </div>
          <span class="booking-status ${statusClass}">${statusLabel}</span>
        </div>

        <div class="booking-datetime">
          <span><i class="far fa-calendar"></i> ${eventDateFormatted}${dayName ? ` - ${dayName}` : ''}</span>
          <span><i class="far fa-clock"></i> ${timeFormatted}${period}</span>
        </div>

        ${booking.mark ? `<div class="booking-mark"><i class="fas fa-tag"></i> ${escapeHtml(booking.mark)}</div>` : ''}

        <div class="booking-finance">
          <div class="fin-box total">
            <div class="fin-label">الإجمالي</div>
            <div class="fin-value">${total}</div>
          </div>
          <div class="fin-box paid">
            <div class="fin-label">المدفوع</div>
            <div class="fin-value">${paid}</div>
          </div>
          <div class="fin-box remaining">
            <div class="fin-label">المتبقي</div>
            <div class="fin-value">${remaining}</div>
          </div>
          <div class="fin-box deposit">
            <div class="fin-label">تأمين</div>
            <div class="fin-value">${deposit}${booking.refundAmount > 0 ? `<span class="deposit-refund-note">مُسترد: ${refund}</span>` : ''}</div>
          </div>
        </div>

        ${itemsPreview ? `<div class="booking-items"><strong>الأصناف:</strong> ${itemsPreview}</div>` : ''}

        ${actionButtons}

      </article>`;
  }

  function renderBookings() {
    if (!bookingList) return;
    if (!filteredBookings.length) {
      renderEmpty();
      return;
    }
    bookingList.innerHTML = filteredBookings.slice(0, visibleCount).map(renderBookingCard).join('');
    const more = document.getElementById('bookingsMoreContainer');
    if (more) more.innerHTML = filteredBookings.length > visibleCount
      ? `<button type="button" class="btn btn-secondary" id="showMoreBookings">عرض المزيد (${filteredBookings.length - visibleCount})</button>` : '';
    document.getElementById('showMoreBookings')?.addEventListener('click', () => {
      visibleCount += 30;
      renderBookings();
    });
  }

  function applyFiltersAndRender(resetPage = true) {
    if (resetPage) visibleCount = 30;
    const query = searchQuery.trim().toLowerCase();

    filteredBookings = allBookings.filter((b) => {
      if (currentFilter !== 'all' && b.status !== currentFilter) return false;
      if (!query) return true;

      const values = [
        b.id, b.customerName, b.customerPhone, b.mark,
        b.deliveryAddress, b.notes, b.eventDate
      ];
      return values.some((v) => String(v ?? '').toLowerCase().includes(query));
    });

    filteredBookings.sort((a, b) => {
      const dateA = String(a.eventDate || '').slice(0, 10);
      const dateB = String(b.eventDate || '').slice(0, 10);

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      const timeA = String(a.deliveryTime || '00:00');
      const timeB = String(b.deliveryTime || '00:00');
      return timeB.localeCompare(timeA);
    });

    updateSummary();
    updateFilterCounts();
    renderBookings();
  }

  /* =========================================================
   * تحميل البيانات
   * ========================================================= */

  async function loadPaymentMethods() {
    try {
      const list = await window.API.getPaymentMethods();
      paymentMethods = Array.isArray(list) ? list : (list?.data || []);
      if (statusModal?.classList.contains('active')) fillPaymentMethodsSelect();
    } catch (e) {
      console.warn('payment methods load failed:', e);
      paymentMethods = [];
    }
  }

  async function loadBookings() {
    if (loading) return;
    if (!window.API || typeof window.API.getBookings !== 'function') {
      renderError('واجهة API غير متاحة.');
      return;
    }

    loading = true;
    renderLoading();

    try {
      // Payment methods are optional for listing; don't block fetching bookings.
      if (!paymentMethods.length) void loadPaymentMethods();
      const response = await window.API.getBookings();
      const raw = unwrap(response);

      allBookings = raw.map(normalizeBooking).filter((b) => b.id != null);

      applyFiltersAndRender();
    } catch (error) {
      console.error('فشل تحميل الحجوزات:', error);
      allBookings = [];
      filteredBookings = [];
      updateSummary();
      updateFilterCounts();
      renderError(error?.message || 'فشل تحميل الحجوزات');
    } finally {
      loading = false;
    }
  }

  /* =========================================================
   * نافذة تغيير الحالة
   * ========================================================= */

  function fillPaymentMethodsSelect() {
    if (!paymentMethodX) return;

    if (!paymentMethods.length) {
      paymentMethodX.innerHTML = '<option value="">لا توجد طرق دفع</option>';
      return;
    }

    paymentMethodX.innerHTML = paymentMethods.map((m, i) => {
      const id = getPaymentMethodId(m);
      const name = getPaymentMethodName(m);
      return `<option value="${escapeHtml(id)}" ${i === 0 ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('');
  }

  function openStatusModal(bookingId, paymentOnly = false) {
    statusModalMode = paymentOnly ? 'payment' : 'status';
    const booking = allBookings.find((b) => Number(b.id) === Number(bookingId));
    if (!booking) return;

    currentStatusBookingId = booking.id;

    statusModalTitle.textContent = paymentOnly ? `تسجيل دفعة للحجز #${booking.id}` : `حالة الحجز #${booking.id}`;

    $$('input[name="newStatus"]', statusModal).forEach((r) => {
      r.checked = r.value === booking.status;
    });

    paymentSectionX.classList.remove('show');
    paymentAmountX.value = '';
    fillPaymentMethodsSelect();

    $$('input[name="newStatus"]', statusModal).forEach((radio) => {
      radio.onchange = () => onStatusChange(booking);
    });

    const options = document.getElementById('bookingStatusOptions');
    if (options) options.style.display = paymentOnly ? 'none' : '';
    onStatusChange(booking);
    statusModal.classList.add('active');
  }

  function onStatusChange(booking) {
    const selected = $('input[name="newStatus"]:checked', statusModal);
    if (!selected) return;

    const newStatus = selected.value;

    if ((statusModalMode === 'payment' || newStatus === 'completed') && booking.remaining > 0) {
      paymentSectionX.classList.add('show');
      paymentAmountX.value = booking.remaining.toFixed(2);
      paymentAmountX.max = booking.remaining.toFixed(2);
      paymentHintX.textContent =
        `سيتم تسجيل دفعة بقيمة المتبقي (${formatCurrency(booking.remaining)}) وربطها بالحجز #${booking.id}.`;
    } else if (newStatus === 'completed' && booking.remaining <= 0) {
      paymentSectionX.classList.add('show');
      paymentAmountX.value = '0';
      paymentAmountX.max = '0';
      paymentHintX.textContent = 'لا يوجد مبلغ متبقي على هذا الحجز.';
    } else {
      paymentSectionX.classList.remove('show');
    }
  }

  function closeStatusModal(force = false) {
    if (savingStatus && force !== true) return;
    statusModal.classList.remove('active');
    currentStatusBookingId = null;
    savingStatus = false;
  }

  async function confirmStatusChange() {
    if (savingStatus) return;

    const booking = allBookings.find(
      (b) => Number(b.id) === Number(currentStatusBookingId)
    );
    if (!booking) return;

    const selected = $('input[name="newStatus"]:checked', statusModal);
    if (!selected) {
      showToast('اختر الحالة الجديدة', 'error');
      return;
    }

    const newStatus = selected.value;
    const oldStatus = booking.status;

    if (statusModalMode !== 'payment' && newStatus === oldStatus) {
      showToast('لم تتغير الحالة', 'info');
      return;
    }

    savingStatus = true;
    confirmStatusBtn.disabled = true;
    confirmStatusBtn.textContent = 'جاري الحفظ...';

    try {
      if (statusModalMode === 'payment') {
        const amount = number(paymentAmountX.value);
        const methodId = Number(paymentMethodX.value);
        if (!(amount > 0 && amount <= booking.remaining)) throw new Error('الدفعة غير صالحة أو تتجاوز المتبقي');
        if (!methodId) throw new Error('اختر طريقة دفع');
        await window.API.createCustomerPayment({
          customer_id: booking.customerId,
          booking_id: booking.id,
          amount, payment_method_id: methodId,
          payment_date: nowSqlDateTime(), notes: 'دفعة على الحجز'
        });
      } else if (newStatus === 'completed') {
        const amount = booking.remaining > 0 ? number(paymentAmountX.value) : 0;
        const methodId = amount > 0 ? Number(paymentMethodX.value) : null;
        if (amount < 0 || amount > booking.remaining) throw new Error('مبلغ الدفعة غير صحيح');
        if (amount > 0 && !methodId) throw new Error('اختر طريقة الدفع');
        // Only ONE API call: backend updates status + creates payment atomically.
        await window.API.completeBooking(booking.id, {
          payment_amount: amount,
          ...(methodId ? { payment_method_id: methodId } : {})
        });
      } else {
        // Never resend the items / original invoice when changing only status.
        await window.API.updateBooking(booking.id, { status: newStatus });
      }

      showToast(
        statusModalMode === 'payment' ? 'تم تسجيل الدفعة' :
        newStatus === 'completed' ? 'تم إكمال الحجز بنجاح' : 'تم تغيير الحالة',
        'success'
      );

      closeStatusModal(true);
      await loadBookings();
    } catch (error) {
      console.error('Status change failed:', error);
      showToast(error?.message || 'تعذر تحديث الحالة', 'error');
    } finally {
      savingStatus = false;
      confirmStatusBtn.disabled = false;
      confirmStatusBtn.textContent = 'تأكيد';
    }
  }

  /* =========================================================
   * تعديل / حذف
   * ========================================================= */

  function editBooking(id) {
    window.location.href = `booking-form.html?id=${encodeURIComponent(id)}`;
  }

  function openRefundModal(booking) {
    refundBookingId = booking.id;
    const max = Math.max(0, Math.min(booking.plateDeposit || 0, booking.paidAmount || 0) - (booking.refundAmount || 0));
    if (max <= 0) {
      showToast('لا توجد قيمة تأمين محصلة قابلة للإرجاع', 'info');
      return;
    }
    document.getElementById('bookingRefundInfo').textContent =
      `الحجز #${booking.id} — التأمين ${formatCurrency(booking.plateDeposit)}، المسترد سابقًا ${formatCurrency(booking.refundAmount)}، الحد المتاح الآن ${formatCurrency(max)}.`;
    const input = document.getElementById('bookingRefundAmount');
    input.value = max.toFixed(2);
    input.max = max.toFixed(2);
    document.getElementById('bookingRefundModal').classList.add('active');
    input.focus();
  }

  function closeRefundModal() {
    if (savingRefund) return;
    document.getElementById('bookingRefundModal')?.classList.remove('active');
    refundBookingId = null;
  }

  async function confirmRefund() {
    if (savingRefund || refundBookingId == null) return;
    const booking = allBookings.find(b => Number(b.id) === Number(refundBookingId));
    if (!booking) return;
    const amount = Number(document.getElementById('bookingRefundAmount').value);
    const max = Math.max(0, Math.min(booking.plateDeposit || 0, booking.paidAmount || 0) - (booking.refundAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
      showToast('أدخل مبلغًا ضمن حد التأمين المحصل القابل للإرجاع', 'error');
      return;
    }
    const totalReturned = Math.round(((booking.refundAmount || 0) + amount) * 100) / 100;
    const button = document.getElementById('bookingRefundConfirmBtn');
    savingRefund = true;
    button.disabled = true;
    try {
      // Stored as cumulative plate_deposit_returned, not a negative customer payment.
      await window.API.updateBooking(booking.id, { plate_deposit_returned: totalReturned });
      showToast('تم تسجيل إرجاع التأمين', 'success');
      document.getElementById('bookingRefundModal').classList.remove('active');
      refundBookingId = null;
      await loadBookings();
    } catch (error) {
      showToast(error?.message || 'تعذر تسجيل الإرجاع', 'error');
    } finally {
      savingRefund = false;
      button.disabled = false;
    }
  }

  function askDeleteConfirmation(message) {
    const modal = document.getElementById('bookingDeleteModal');
    const text = document.getElementById('bookingDeleteMessage');
    const confirmBtn = document.getElementById('bookingDeleteConfirmBtn');
    if (!modal || !text || !confirmBtn) return Promise.resolve(window.confirm(message));
    if (deleteDialogResolve) return Promise.resolve(false);
    text.textContent = message;
    modal.classList.add('active');
    return new Promise(resolve => { deleteDialogResolve = resolve; });
  }

  function finishDeleteDialog(confirmed) {
    document.getElementById('bookingDeleteModal')?.classList.remove('active');
    if (deleteDialogResolve) {
      const resolve = deleteDialogResolve;
      deleteDialogResolve = null;
      resolve(confirmed);
    }
  }

  async function confirmDelete(booking) {
    const message = `هل تريد حذف الحجز #${booking.id} للعميل «${booking.customerName}»؟\n\nسيتم حذف جميع الدفعات المرتبطة بهذا الحجز فقط، ولا يمكن التراجع.`;
    const confirmed = await askDeleteConfirmation(message);
    if (!confirmed) return;
    try {
      await window.API.deleteBooking(booking.id);
      showToast('تم حذف الحجز ودفعاته المرتبطة', 'success');
      await loadBookings();
    } catch (error) {
      showToast(error?.message || 'تعذر حذف الحجز', 'error');
    }
  }

  /* =========================================================
   * طباعة الفاتورة → invoice.html
   * ========================================================= */

  async function printBooking(booking) {
    try {
      if (!window.API || typeof window.API.getBooking !== 'function') {
        throw new Error('واجهة تفاصيل الحجوزات غير متاحة');
      }
      const fullBooking = await window.API.getBooking(booking.id);
      if (!fullBooking || !Array.isArray(fullBooking.items)) {
        throw new Error('تعذر تحميل تفاصيل الأصناف اللازمة لطباعة الفاتورة');
      }

      let restaurant = {
        name: 'شواطئ عدن',
        subtitle: 'مطابخ ومطاعم',
        phone: '',
        delivery: '',
        address: '',
        social: '',
        logo: ''
      };

      try {
        if (window.API && typeof window.API.getRestaurant === 'function') {
          const res = await window.API.getRestaurant();
          const r = (res && res.data) ? res.data : (res || {});
          restaurant = {
            name: r.name || restaurant.name,
            subtitle: r.description || restaurant.subtitle,
            phone: r.phone || '',
            delivery: r.whatsapp || r.phone || '',
            address: r.address || '',
            social: r.instagram || r.facebook || '',
            logo: r.logo || ''
          };
        }
      } catch (e) {
        console.warn('⚠️ تعذر جلب إعدادات المطعم:', e);
      }

      const API_BASE = (window.API && window.API.BASE_URL)
        ? window.API.BASE_URL
        : 'http://127.0.0.1:8000/api';
      const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');
      const STORAGE_BASE = SERVER_BASE + '/storage/';

      const buildLogoUrl = (logo) => {
        if (!logo) return '';
        if (/^https?:\/\//i.test(logo)) return logo;
        if (String(logo).startsWith('data:')) return logo;
        return STORAGE_BASE + String(logo).replace(/^\/+/, '');
      };

      const getDayName = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(d.getTime())) return '';
        return ARABIC_DAYS[d.getDay()] || '';
      };

      const formatDateForInvoice = (v) => {
        if (!v) return '';
        const s = String(v).slice(0, 10);
        const p = s.split('-');
        return (p.length === 3 && p[0].length === 4)
          ? `${p[2]}/${p[1]}/${p[0]}`
          : s;
      };

      const formatTime12Short = (v) => {
        if (!v) return { time: '', period: '' };
        const m = String(v).match(/^(\d{1,2}):(\d{2})/);
        if (!m) return { time: String(v), period: '' };
        let h = Number(m[1]);
        const mm = m[2];
        const period = h >= 12 ? 'مساءً' : 'صباحاً';
        h = h % 12 || 12;
        return { time: `${h}:${mm}`, period };
      };

      const timeInfo = formatTime12Short(fullBooking.delivery_time);

      const rawItems = Array.isArray(fullBooking.items) ? fullBooking.items : [];

      const items = rawItems.map((it) => {
        const qty = Number(it.quantity) || 1;
        const unit = Number(it.unit_price ?? it.price ?? 0);
        const total = Number(it.total_price) || qty * unit;
        return {
          name: it.item_name || it.name || 'صنف',
          qty: qty,
          price: unit,
          total: total
        };
      });

      let paidAmount = 0;
      if (Array.isArray(fullBooking.payments) && fullBooking.payments.length) {
        paidAmount = fullBooking.payments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        );
      } else {
        paidAmount = Number(
          fullBooking.paid_amount ?? fullBooking.deposit_paid ?? 0
        );
      }

      const totalAmount = Number(fullBooking.payable_total ?? (Number(fullBooking.total_amount ?? 0) + Number(fullBooking.plate_deposit ?? 0)));
      const remaining = Math.max(0, totalAmount - paidAmount);

      const paymentMethodName = (() => {
        const firstPayment = Array.isArray(fullBooking.payments)
          ? fullBooking.payments[0]
          : null;

        if (!firstPayment) return 'نقدي';

        if (firstPayment.payment_method && firstPayment.payment_method.name) {
          return firstPayment.payment_method.name;
        }

        const pid = firstPayment.payment_method_id;
        if (!pid) return 'نقدي';

        const m = paymentMethods.find(
          (x) => Number(getPaymentMethodId(x)) === Number(pid)
        );
        return m ? getPaymentMethodName(m) : 'نقدي';
      })();

      const invoiceData = {
        id: fullBooking.id,
        status: fullBooking.status,
        invoiceDate: fullBooking.invoice_date || null,
        generatedAt: new Date().toISOString(),

        customer: {
          name: fullBooking.customer?.name || fullBooking.customer_name || '',
          phone: fullBooking.customer?.phone || fullBooking.customer_phone || '',
          location: fullBooking.delivery_address || ''
        },

        booking: {
          date: formatDateForInvoice(fullBooking.event_date),
          time: timeInfo.time,
          day: getDayName(fullBooking.event_date),
          mark: fullBooking.mark || '',
          deliveryTime: fullBooking.delivery_period || timeInfo.period || 'ظهراً'
        },

        paymentMethod: (() => {
          const labels = (Array.isArray(fullBooking.payments) ? fullBooking.payments : [])
            .map(p => p.payment_method?.name || paymentMethods.find(m => Number(getPaymentMethodId(m)) === Number(p.payment_method_id))?.name)
            .filter(Boolean);
          return [...new Set(labels)].join(' / ') || (paidAmount ? paymentMethodName : 'لم يتم الدفع');
        })(),

        items: items,

        total: totalAmount,
        deposit: paidAmount,
        paidTotal: paidAmount,
        remaining: remaining,

        platesDeposit: Number(fullBooking.plate_deposit || 0),
        platesDepositReturned: Number(fullBooking.plate_deposit_returned || 0),

        notes: fullBooking.notes || '',

        restaurant: {
          ...restaurant,
          logo: buildLogoUrl(restaurant.logo)
        }
      };

      sessionStorage.setItem('preview_invoice_data', JSON.stringify(invoiceData));
      sessionStorage.setItem('invoice_return_to', 'bookings.html');
      localStorage.removeItem('preview_invoice_data');
      window.location.href = 'invoice.html';

    } catch (error) {
      console.error('❌ printBooking failed:', error);
      showToast(error?.message || 'تعذر فتح الفاتورة', 'error');
    }
  }

  /* =========================================================
   * Toast
   * ========================================================= */

  function showToast(msg, type = 'info') {
    if (window.Layout?.showToast) {
      window.Layout.showToast(msg, type);
      return;
    }
    const container = document.getElementById('toastContainer');
    if (!container) { console.log(msg); return; }

    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    el.style.cssText =
      'padding:12px 16px;border-radius:10px;background:#111827;color:#fff;font-size:13px;font-weight:700;margin-top:8px;box-shadow:0 8px 20px rgba(0,0,0,.2);';
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  /* =========================================================
   * الأحداث
   * ========================================================= */

  function handleListClick(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const booking = allBookings.find((b) => Number(b.id) === id);
    if (!booking) return;

    const action = btn.dataset.action;

    if (action === 'edit') editBooking(id);
    else if (action === 'delete') confirmDelete(booking);
    else if (action === 'print') printBooking(booking);
    else if (action === 'change-status') openStatusModal(id);
    else if (action === 'pay-remaining') openStatusModal(id, true);
    else if (action === 'refund') openRefundModal(booking);
  }

  function bindEvents() {
    document.getElementById('bookingRefundConfirmBtn')?.addEventListener('click', confirmRefund);
    document.querySelectorAll('[data-close="bookingRefundModal"]').forEach(el => el.addEventListener('click', closeRefundModal));
    document.getElementById('bookingDeleteConfirmBtn')?.addEventListener('click', () => finishDeleteDialog(true));
    document.querySelectorAll('[data-close="bookingDeleteModal"]').forEach(el => el.addEventListener('click', () => finishDeleteDialog(false)));
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value || '';
        applyFiltersAndRender();
      });
    }

    if (filterChips) {
      filterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        currentFilter = chip.dataset.filter || 'all';
        filterChips.querySelectorAll('.filter-chip').forEach((c) =>
          c.classList.toggle('active', c === chip)
        );
        applyFiltersAndRender();
      });
    }

    if (bookingList) {
      bookingList.addEventListener('click', handleListClick);
    }

    $$('[data-close="bookingStatusModal"]').forEach((el) => {
      el.addEventListener('click', closeStatusModal);
    });

    confirmStatusBtn?.addEventListener('click', confirmStatusChange);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('bookingRefundModal')?.classList.contains('active')) { closeRefundModal(); return; }
      if (e.key === 'Escape' && deleteDialogResolve) { finishDeleteDialog(false); return; }
      if (e.key === 'Escape' && statusModal?.classList.contains('active')) {
        closeStatusModal();
      }
    });
  }

  /* =========================================================
   * التهيئة
   * ========================================================= */

  function init() {
    bindEvents();
    loadBookings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();