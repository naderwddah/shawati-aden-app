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

  const statusModal = document.getElementById('statusModal');
  const statusModalTitle = document.getElementById('statusModalTitle');
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
    const d = new Date(String(dateValue).slice(0, 10));
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

  /* =========================================================
   * تطبيع الحجز
   * ========================================================= */

  function normalizeBooking(booking) {
    const customer = booking.customer || {};
    const items = Array.isArray(booking.items) ? booking.items : [];

    // إجمالي الأصناف من items لو موجودة
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

    // حساب المدفوع من payments أو من الحقول المباشرة
    let paid = number(
      booking.paid_amount ?? booking.paidAmount ??
      booking.payments_sum_amount ?? booking.payments_total ??
      booking.deposit_paid
    );

    if (!paid && Array.isArray(booking.payments)) {
      paid = booking.payments.reduce((s, p) => s + number(p.amount), 0);
    }

    const remaining = Math.max(0, total - paid);

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
      createdAt: booking.created_at ?? booking.createdAt ?? ''
    };
  }

  /* =========================================================
   * الملخص والفلاتر
   * ========================================================= */

  function todayString() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function updateSummary() {
    if (totalBookingsEl) totalBookingsEl.textContent = allBookings.length.toLocaleString('ar-SA');

    const today = todayString();
    const todayCount = allBookings.filter(
      (b) => String(b.eventDate).slice(0, 10) === today
    ).length;
    if (todayBookingsEl) todayBookingsEl.textContent = todayCount.toLocaleString('ar-SA');

    const totalValue = allBookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.totalAmount, 0);
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

    const total = formatCurrencyShort(booking.totalAmount);
    const paid = formatCurrencyShort(booking.paidAmount);
    const remaining = formatCurrencyShort(booking.remaining);
    const deposit = formatCurrencyShort(booking.plateDeposit || 0);

    // معاينة الأصناف
    let itemsPreview = '';
    if (booking.items.length) {
      const names = booking.items.slice(0, 2).map((it) =>
        escapeHtml(it.item_name ?? it.name ?? 'صنف')
      );
      itemsPreview = names.join(' • ');
      if (booking.items.length > 2) itemsPreview += ` +${booking.items.length - 2}`;
    }

    // الأزرار
    const isCompleted = booking.status === 'completed';
    const isCancelled = booking.status === 'cancelled';

    let actionButtons = '';

    if (isCompleted) {
      actionButtons = `
        <div class="booking-locked">
          <i class="fas fa-lock"></i> الحجز مغلق
        </div>
        <div class="booking-actions">
          ${booking.remaining > 0 ? `
            <button class="btn-action warning" data-action="pay-remaining" data-id="${booking.id}">
              <i class="fas fa-hand-holding-usd"></i> تسديد (${remaining})
            </button>
          ` : ''}
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
          <button class="btn-action primary" data-action="edit" data-id="${booking.id}">
            <i class="fas fa-pen"></i> تعديل
          </button>
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
            <div class="fin-value">${deposit}</div>
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
    bookingList.innerHTML = filteredBookings.map(renderBookingCard).join('');
  }

  function applyFiltersAndRender() {
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

    // ✅ الترتيب: الأحدث أولًا حسب تاريخ المناسبة
    filteredBookings.sort((a, b) => {
      const dateA = String(a.eventDate || '').slice(0, 10);
      const dateB = String(b.eventDate || '').slice(0, 10);

      // الأحدث أولًا
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // لو نفس اليوم: الأحدث وقتًا أولًا
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
      // نجلب كل شيء بالتوازي
      if (!paymentMethods.length) {
        await loadPaymentMethods();
      }

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

  function openStatusModal(bookingId) {
    const booking = allBookings.find((b) => Number(b.id) === Number(bookingId));
    if (!booking) return;

    currentStatusBookingId = booking.id;

    statusModalTitle.textContent = `حالة الحجز #${booking.id}`;

    // إعادة تعيين الخيارات
    $$('input[name="newStatus"]', statusModal).forEach((r) => {
      r.checked = r.value === booking.status;
    });

    // إخفاء قسم الدفع مبدئيًا
    paymentSectionX.classList.remove('show');
    paymentAmountX.value = '';
    fillPaymentMethodsSelect();

    // أحداث التغيير
    $$('input[name="newStatus"]', statusModal).forEach((radio) => {
      radio.onchange = () => onStatusChange(booking);
    });

    // تشغيل حالة الحالة الحالية
    onStatusChange(booking);

    statusModal.classList.add('active');
  }

  function onStatusChange(booking) {
    const selected = $('input[name="newStatus"]:checked', statusModal);
    if (!selected) return;

    const newStatus = selected.value;

    // إظهار قسم الدفع فقط عند اختيار "مكتمل" + يوجد متبقي
    if (newStatus === 'completed' && booking.remaining > 0) {
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

  function closeStatusModal() {
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

    if (newStatus === oldStatus && !(newStatus === 'completed' && booking.remaining > 0)) {
      showToast('لم تتغير الحالة', 'info');
      return;
    }

    savingStatus = true;
    confirmStatusBtn.disabled = true;
    confirmStatusBtn.textContent = 'جاري الحفظ...';

    try {
      // 1) إذا كانت الحالة الجديدة "مكتمل" وهناك متبقي → سجل دفعة أولًا
      if (newStatus === 'completed' && booking.remaining > 0) {
        const amount = number(paymentAmountX.value);
        const methodId = Number(paymentMethodX.value);

        if (amount <= 0) throw new Error('أدخل مبلغًا صحيحًا للدفعة');
        if (amount > booking.remaining) {
          throw new Error(`المبلغ يتجاوز المتبقي (${formatCurrency(booking.remaining)})`);
        }
        if (!methodId) throw new Error('اختر طريقة دفع');

        if (typeof window.API.createCustomerPayment !== 'function') {
          throw new Error('واجهة تسجيل الدفعات غير متاحة');
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const paymentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        await window.API.createCustomerPayment({
          customer_id: booking.customerId,
          booking_id: booking.id,
          amount: amount,
          payment_method_id: methodId,
          payment_date: paymentDate,
          notes: 'دفعة إكمال الحجز'
        });
      }

      // 2) تحديث حالة الحجز
      const fullPayload = {
        customer_id: booking.customerId,
        invoice_date: booking.invoiceDate || todayString(),
        event_date: booking.eventDate,
        delivery_time: booking.deliveryTime,
        delivery_period: booking.deliveryPeriod,
        delivery_address: booking.deliveryAddress,
        mark: booking.mark || null,
        total_amount: booking.totalAmount,
        plate_deposit: booking.plateDeposit,
        plate_deposit_returned: booking.plateDepositReturned,
        notes: booking.notes || null,
        status: newStatus,
        items: booking.items.map((it) => ({
          item_id: it.item_id ?? null,
          item_name: it.item_name ?? it.name ?? '',
          quantity: number(it.quantity),
          unit_price: number(it.unit_price ?? it.price),
          total_price: number(it.total_price) || number(it.quantity) * number(it.unit_price ?? it.price)
        }))
      };

      await window.API.updateBooking(booking.id, fullPayload);

      showToast(
        newStatus === 'completed' && booking.remaining > 0
          ? 'تم إكمال الحجز وتسجيل الدفعة'
          : 'تم تغيير الحالة',
        'success'
      );

      closeStatusModal();
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
   * تعديل / حذف / طباعة
   * ========================================================= */

  function editBooking(id) {
    window.location.href = `booking-form.html?id=${encodeURIComponent(id)}`;
  }

  async function confirmDelete(booking) {
    const msg = `هل تريد حذف الحجز #${booking.id} للعميل "${booking.customerName}"؟\n\nسيتم حذف كل الدفعات المرتبطة به.`;

    let confirmed = false;
    if (window.Layout?.showConfirm) {
      confirmed = await new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        try {
          window.Layout.showConfirm({
            title: 'حذف الحجز',
            message: msg,
            confirmText: 'حذف',
            danger: true,
            onConfirm: () => finish(true),
            onCancel: () => finish(false)
          });
        } catch { finish(confirm(msg)); }
      });
    } else {
      confirmed = confirm(msg);
    }

    if (!confirmed) return;

    try {
      await window.API.deleteBooking(booking.id);
      showToast('تم حذف الحجز', 'success');
      await loadBookings();
    } catch (error) {
      showToast(error?.message || 'تعذر حذف الحجز', 'error');
    }
  }
  /* =========================================================
   * طباعة الفاتورة - نقل إلى invoice.html
   * ========================================================= */

  async function printBooking(booking) {
    try {
      // ✅ 1) جلب الحجز الكامل من الـ API (لأن القائمة لا تُرجع items)
      let fullBooking = booking;

      try {
        if (window.API && typeof window.API.getBooking === 'function') {
          const res = await window.API.getBooking(booking.id);
          const fb = (res && res.data) ? res.data : res;
          if (fb && fb.id) {
            fullBooking = fb;
            console.log('✅ تم جلب الحجز الكامل:', fullBooking);
          }
        }
      } catch (e) {
        console.warn('⚠️ تعذر جلب تفاصيل الحجز الكاملة:', e);
      }

      // ✅ 2) جلب إعدادات المطعم
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

      // ✅ 3) بناء رابط اللوجو الكامل
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

      // ✅ 4) اسم يوم الأسبوع
      const ARABIC_DAYS = [
        'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
      ];
      const getDayName = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(String(dateStr).slice(0, 10));
        if (Number.isNaN(d.getTime())) return '';
        return ARABIC_DAYS[d.getDay()] || '';
      };

      // ✅ 5) صيغة التاريخ DD/MM/YYYY
      const formatDateForInvoice = (v) => {
        if (!v) return '';
        const s = String(v).slice(0, 10);
        const p = s.split('-');
        return (p.length === 3 && p[0].length === 4)
          ? `${p[2]}/${p[1]}/${p[0]}`
          : s;
      };

      // ✅ 6) صيغة الوقت 12 ساعة
      const formatTime12 = (v) => {
        if (!v) return { time: '', period: '' };
        const m = String(v).match(/^(\d{1,2}):(\d{2})/);
        if (!m) return { time: String(v), period: '' };
        let h = Number(m[1]);
        const mm = m[2];
        const period = h >= 12 ? 'مساءً' : 'صباحاً';
        h = h % 12 || 12;
        return { time: `${h}:${mm}`, period };
      };

      const timeInfo = formatTime12(fullBooking.delivery_time);

      // ✅ 7) تجهيز الأصناف من الحجز الكامل
      const rawItems = Array.isArray(fullBooking.items) ? fullBooking.items : [];
      console.log('📦 عدد الأصناف من API:', rawItems.length);

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

      // ✅ 8) حساب المدفوع من payments
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

      const totalAmount = Number(fullBooking.total_amount ?? 0);
      const remaining = Math.max(0, totalAmount - paidAmount);

      // ✅ 9) اسم طريقة الدفع
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

      // ✅ 10) بناء كائن الفاتورة
      const invoiceData = {
        id: fullBooking.id,
        status: fullBooking.status,

        customer: {
          name: fullBooking.customer?.name || '',
          phone: fullBooking.customer?.phone || '',
          location: fullBooking.delivery_address || ''
        },

        booking: {
          date: formatDateForInvoice(fullBooking.event_date),
          time: timeInfo.time,
          day: getDayName(fullBooking.event_date),
          mark: fullBooking.mark || '',
          deliveryTime: fullBooking.delivery_period || timeInfo.period || 'ظهراً'
        },

        paymentMethod: paymentMethodName,

        items: items,

        total: totalAmount,
        deposit: paidAmount,
        remaining: remaining,

        platesDeposit: Number(fullBooking.plate_deposit || 0),

        notes: fullBooking.notes || '',

        restaurant: {
          ...restaurant,
          logo: buildLogoUrl(restaurant.logo)
        }
      };

      console.log('📋 بيانات الفاتورة النهائية:', invoiceData);

      // ✅ 11) الحفظ والانتقال
      localStorage.setItem('preview_invoice_data', JSON.stringify(invoiceData));
      window.location.href = 'invoice.html';

    } catch (error) {
      console.error('❌ printBooking failed:', error);
      showToast('تعذر فتح الفاتورة', 'error');
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
    else if (action === 'pay-remaining') openStatusModal(id);
  }

  function bindEvents() {
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

    // إغلاق الـ Modal
    $$('[data-close="statusModal"]').forEach((el) => {
      el.addEventListener('click', closeStatusModal);
    });

    // تأكيد الحالة
    confirmStatusBtn?.addEventListener('click', confirmStatusChange);

    // Escape
    document.addEventListener('keydown', (e) => {
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