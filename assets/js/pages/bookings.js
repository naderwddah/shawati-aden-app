(function () {
  'use strict';

  let allBookings = [];
  let filteredBookings = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let loading = false;

  const bookingList = document.getElementById('bookingList');
  const searchInput = document.getElementById('bookingSearch');
  const filterChips = document.getElementById('filterChips');
  const fab = document.getElementById('fab');

  const totalBookingsEl = document.getElementById('totalBookings');
  const todayBookingsEl = document.getElementById('todayBookings');
  const totalAmountEl = document.getElementById('totalAmount');

  const STATUS = {
    new: { label: 'جديد', className: 'booking-status-new' },
    confirmed: { label: 'مؤكد', className: 'booking-status-confirmed' },
    completed: { label: 'مكتمل', className: 'booking-status-completed' },
    cancelled: { label: 'ملغي', className: 'booking-status-cancelled' }
  };

  // ===== دوال مساعدة =====
  function showToast(message, type) {
    if (window.Layout && typeof window.Layout.showToast === 'function') {
      window.Layout.showToast(message, type || 'info');
      return;
    }
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
      window.showToast(message, type || 'info');
      return;
    }
    alert(message);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatCurrency(value) {
    if (window.API && typeof window.API.formatCurrency === 'function') {
      return window.API.formatCurrency(number(value));
    }
    return number(value).toLocaleString('ar-SA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }) + ' ر.س';
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

  function formatTime(value) {
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
    const status = String(value || 'new').toLowerCase().trim();
    if (status === 'جديد') return 'new';
    if (status === 'مؤكد') return 'confirmed';
    if (status === 'مكتمل') return 'completed';
    if (status === 'ملغي' || status === 'ملغى') return 'cancelled';
    return STATUS[status] ? status : 'new';
  }

  function getStatusLabel(value) {
    return STATUS[getStatus(value)].label;
  }

  function getStatusClass(value) {
    return STATUS[getStatus(value)].className;
  }

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.data && Array.isArray(payload.data.data)) return payload.data.data;
    if (payload && Array.isArray(payload.bookings)) return payload.bookings;
    if (payload && payload.result && Array.isArray(payload.result)) return payload.result;
    if (payload && payload.items && Array.isArray(payload.items)) return payload.items;
    if (payload && payload.data && payload.data.result && Array.isArray(payload.data.result)) return payload.data.result;
    console.warn('⚠️ شكل البيانات غير معروف:', payload);
    return [];
  }

  function normalizeBooking(booking) {
    const customer = booking.customer || {};
    const items = Array.isArray(booking.items) ? booking.items : [];

    let calculatedTotal = 0;
    items.forEach(item => {
      const quantity = number(item.quantity);
      const itemTotal = number(item.total_price ?? item.totalPrice);
      const unitPrice = number(item.unit_price ?? item.unitPrice ?? item.price);
      calculatedTotal += itemTotal > 0 ? itemTotal : quantity * unitPrice;
    });

    const total = number(booking.total_amount ?? booking.totalAmount ?? booking.total ?? calculatedTotal);
    let paid = number(booking.paid_amount ?? booking.paidAmount ?? booking.payments_sum_amount ?? booking.payments_total);
    if (!paid && Array.isArray(booking.payments)) {
      paid = booking.payments.reduce((sum, payment) => sum + number(payment.amount), 0);
    }

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
      plateDeposit: booking.plate_deposit == null ? null : number(booking.plate_deposit),
      plateDepositReturned: booking.plate_deposit_returned == null ? null : number(booking.plate_deposit_returned),
      status: getStatus(booking.status),
      notes: booking.notes ?? '',
      items,
      payments: Array.isArray(booking.payments) ? booking.payments : [],
      paidAmount: paid,
      remaining: Math.max(0, total - paid),
      createdAt: booking.created_at ?? booking.createdAt ?? ''
    };
  }

  function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function updateSummary() {
    if (totalBookingsEl) {
      totalBookingsEl.textContent = allBookings.length.toLocaleString('ar-SA');
    }
    const today = todayString();
    const todayCount = allBookings.filter(booking => String(booking.eventDate).slice(0, 10) === today).length;
    if (todayBookingsEl) {
      todayBookingsEl.textContent = todayCount.toLocaleString('ar-SA');
    }
    const total = allBookings
      .filter(booking => booking.status !== 'cancelled')
      .reduce((sum, booking) => sum + booking.totalAmount, 0);
    if (totalAmountEl) {
      totalAmountEl.textContent = formatCurrency(total);
    }
  }

  function updateFilterCounts() {
    if (!filterChips) return;
    const counts = {
      all: allBookings.length,
      new: allBookings.filter(b => b.status === 'new').length,
      confirmed: allBookings.filter(b => b.status === 'confirmed').length,
      completed: allBookings.filter(b => b.status === 'completed').length,
      cancelled: allBookings.filter(b => b.status === 'cancelled').length
    };
    filterChips.querySelectorAll('.filter-chip').forEach(chip => {
      const key = chip.dataset.filter;
      const count = chip.querySelector('.chip-count');
      if (count && counts.hasOwnProperty(key)) {
        count.textContent = counts[key].toLocaleString('ar-SA');
      }
    });
  }

  // ===== دوال العرض الرئيسية (مع تحسين التنسيق) =====
  function renderLoading() {
    if (!bookingList) return;
    bookingList.innerHTML = `
      <div class="bookings-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>جاري تحميل الحجوزات...</span>
      </div>
    `;
  }

  function renderError(message) {
    if (!bookingList) return;
    bookingList.innerHTML = `
      <div class="bookings-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>تعذر تحميل الحجوزات</h4>
        <p>${escapeHtml(message || 'حدث خطأ غير متوقع')}</p>
        <button type="button" id="retryBookingsBtn" class="btn btn-primary">إعادة المحاولة</button>
      </div>
    `;
    const retry = document.getElementById('retryBookingsBtn');
    if (retry) retry.addEventListener('click', loadBookings);
  }

  function renderEmpty() {
    if (!bookingList) return;
    const hasSearch = searchQuery.trim().length > 0;
    const hasFilter = currentFilter !== 'all';
    bookingList.innerHTML = `
      <div class="bookings-empty">
        <i class="fas ${hasSearch || hasFilter ? 'fa-search' : 'fa-calendar-plus'}"></i>
        <h4>${hasSearch || hasFilter ? 'لا توجد نتائج' : 'لا توجد حجوزات'}</h4>
        <p>${hasSearch || hasFilter ? 'لا توجد حجوزات مطابقة للبحث أو الفلتر المحدد' : 'لم يتم إضافة أي حجز بعد'}</p>
        ${hasSearch || hasFilter ? `
          <button type="button" class="btn btn-secondary" id="clearBookingFiltersBtn">مسح البحث والفلاتر</button>
        ` : `
          <a href="booking-form.html" class="btn btn-primary">إضافة حجز جديد</a>
        `}
      </div>
    `;
    const clear = document.getElementById('clearBookingFiltersBtn');
    if (clear) {
      clear.addEventListener('click', () => {
        searchQuery = '';
        currentFilter = 'all';
        if (searchInput) searchInput.value = '';
        if (filterChips) {
          filterChips.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === 'all');
          });
        }
        applyFiltersAndRender();
      });
    }
  }

  // ===== دالة عرض البطاقة (محسّنة للتجاوب والأرقام) =====
  function renderBookingCard(booking) {
    const statusLabel = getStatusLabel(booking.status);
    const statusClass = getStatusClass(booking.status);

    const deposit = booking.plateDeposit == null ? 0 : booking.plateDeposit;
    const returned = booking.plateDepositReturned == null ? 0 : booking.plateDepositReturned;
    const depositRemaining = Math.max(0, deposit - returned);

    const address = booking.deliveryAddress || 'غير محدد';
    const period = booking.deliveryPeriod ? ` · ${booking.deliveryPeriod}` : '';

    // تنسيق المبالغ بشكل مختصر على الجوال
    const totalFormatted = formatCurrency(booking.totalAmount);
    const paidFormatted = formatCurrency(booking.paidAmount);
    const remainingFormatted = formatCurrency(booking.remaining);
    const depositFormatted = formatCurrency(deposit);
    const depositRemainingFormatted = formatCurrency(depositRemaining);

    // الأصناف (عرض أول 2 فقط)
    const items = booking.items || [];
    let itemsPreview = '';
    if (items.length) {
      const names = items.slice(0, 2).map(item => escapeHtml(item.item_name ?? item.name ?? 'صنف'));
      itemsPreview = names.join(' • ');
      if (items.length > 2) itemsPreview += ` +${items.length - 2}`;
    }

    return `
      <article class="booking-card" data-id="${escapeHtml(booking.id)}">
        <!-- الأيقونة الجانبية -->
        <div class="booking-icon">
          ${escapeHtml(String(booking.customerName).trim().charAt(0) || 'ع')}
        </div>

        <!-- المحتوى الأساسي -->
        <div class="booking-main">
          <div class="booking-title-row">
            <h3 class="booking-title">${escapeHtml(booking.customerName)}</h3>
            <span class="booking-number">#${escapeHtml(booking.id)}</span>
          </div>

          <div class="booking-meta">
            <span><i class="fas fa-calendar-day"></i> ${formatDate(booking.eventDate)}</span>
            <span><i class="fas fa-clock"></i> ${formatTime(booking.deliveryTime)}${escapeHtml(period)}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(address)}</span>
          </div>

          ${booking.mark ? `
            <div class="booking-mark-tag">
              <i class="fas fa-tag"></i> ${escapeHtml(booking.mark)}
            </div>
          ` : ''}

          ${itemsPreview ? `
            <div class="booking-items-preview">
              <span class="items-label">الأصناف:</span>
              <span class="items-list">${itemsPreview}</span>
            </div>
          ` : ''}

          ${booking.notes ? `
            <div class="booking-notes">
              <i class="fas fa-sticky-note"></i> ${escapeHtml(booking.notes)}
            </div>
          ` : ''}
        </div>

        <!-- الجانب الأيمن (المبالغ والحالة) -->
        <div class="booking-side">
          <div class="booking-total">${totalFormatted} <small>ر.س</small></div>
          <span class="booking-status ${statusClass}">${statusLabel}</span>

          <div class="booking-payment-details">
            <span class="paid-amount">مدفوع: ${paidFormatted}</span>
            ${booking.remaining > 0 ? `<span class="remaining-amount">متبقي: ${remainingFormatted}</span>` : `<span class="paid-complete">✅ مدفوع بالكامل</span>`}
            ${deposit > 0 ? `<span class="deposit-amount">تأمين: ${depositFormatted} ${depositRemaining > 0 ? `· متبقي ${depositRemainingFormatted}` : '· مسترد'}</span>` : ''}
          </div>

          <div class="booking-actions">
            <button type="button" class="btn-icon-sm btn-icon-primary" data-action="edit" data-id="${escapeHtml(booking.id)}" title="تعديل"><i class="fas fa-pen"></i></button>
            <button type="button" class="btn-icon-sm btn-icon-danger" data-action="delete" data-id="${escapeHtml(booking.id)}" title="حذف"><i class="fas fa-trash"></i></button>
            <button type="button" class="btn-icon-sm" data-action="print" data-id="${escapeHtml(booking.id)}" title="طباعة"><i class="fas fa-print"></i></button>
          </div>
        </div>
      </article>
    `;
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
    filteredBookings = allBookings.filter(booking => {
      if (currentFilter !== 'all' && booking.status !== currentFilter) return false;
      if (!query) return true;
      const values = [booking.id, booking.customerName, booking.customerPhone, booking.mark, booking.deliveryAddress, booking.notes, booking.eventDate];
      return values.some(val => String(val ?? '').toLowerCase().includes(query));
    });
    updateSummary();
    updateFilterCounts();
    renderBookings();
  }

  // ===== تحميل البيانات من API =====
  async function loadBookings() {
    if (loading) return;
    if (!window.API || typeof window.API.getBookings !== 'function') {
      renderError('واجهة API غير متاحة. تأكد من تحميل api.js قبل bookings.js.');
      return;
    }
    loading = true;
    renderLoading();
    try {
      const response = await window.API.getBookings();
      console.log('📦 API response:', response);
      const raw = unwrap(response);
      console.log('📦 بعد unwrap:', raw);
      allBookings = raw.map(normalizeBooking).filter(booking => booking.id != null);
      console.log('📦 بعد normalize:', allBookings);
      applyFiltersAndRender();
    } catch (error) {
      console.error('فشل تحميل الحجوزات:', error);
      allBookings = [];
      filteredBookings = [];
      updateSummary();
      updateFilterCounts();
      renderError(error?.message || 'فشل تحميل الحجوزات');
      showToast(error?.message || 'فشل تحميل الحجوزات', 'error');
    } finally {
      loading = false;
    }
  }

  // ===== تأكيد الحذف =====
  function confirmDelete(booking) {
    const runDelete = async () => {
      try {
        if (!window.API || typeof window.API.deleteBooking !== 'function') {
          throw new Error('حذف الحجوزات غير متاح في API');
        }
        await window.API.deleteBooking(booking.id);
        allBookings = allBookings.filter(item => item.id !== booking.id);
        applyFiltersAndRender();
        showToast(`تم حذف الحجز #${booking.id} بنجاح`, 'success');
      } catch (error) {
        console.error('خطأ في حذف الحجز:', error);
        showToast(error?.message || 'تعذر حذف الحجز', 'error');
      }
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: 'حذف الحجز',
        message: `هل أنت متأكد من حذف الحجز رقم #${booking.id} للعميل "${booking.customerName}"؟`,
        confirmText: 'حذف',
        danger: true,
        onConfirm: runDelete
      });
      return;
    }
    if (window.Layout && typeof window.Layout.confirm === 'function') {
      if (window.Layout.confirm(`هل أنت متأكد من حذف الحجز رقم #${booking.id}؟`)) {
        runDelete();
      }
      return;
    }
    if (confirm(`هل أنت متأكد من حذف الحجز رقم #${booking.id} للعميل "${booking.customerName}"؟`)) {
      runDelete();
    }
  }

  // ===== طباعة الفاتورة =====
  function printBooking(booking) {
    const items = booking.items || [];
    const itemsRows = items.length ? items.map(item => {
      const quantity = number(item.quantity);
      const unitPrice = number(item.unit_price ?? item.unitPrice ?? item.price);
      const total = number(item.total_price ?? item.totalPrice) || quantity * unitPrice;
      return `
        <tr>
          <td>${escapeHtml(item.item_name ?? item.name ?? 'صنف')}</td>
          <td>${quantity}</td>
          <td>${formatCurrency(unitPrice)}</td>
          <td>${formatCurrency(total)}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="4">لا توجد أصناف</td></tr>`;

    const deposit = booking.plateDeposit == null ? 0 : booking.plateDeposit;
    const returned = booking.plateDepositReturned == null ? 0 : booking.plateDepositReturned;

    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>فاتورة حجز #${escapeHtml(booking.id)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Tahoma, sans-serif; margin: 0; padding: 30px; color: #222; background: #fff; }
          .invoice { max-width: 850px; margin: auto; }
          .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #222; padding-bottom: 18px; margin-bottom: 20px; }
          h1, h2, p { margin: 0 0 8px; }
          .title { text-align: right; }
          .meta { text-align: left; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
          .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f5f5f5; }
          .totals { margin-top: 20px; margin-right: auto; width: 320px; }
          .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #eee; }
          .grand { font-weight: 700; font-size: 18px; }
          .notes { margin-top: 20px; border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
          .print { margin-top: 20px; padding: 10px 18px; cursor: pointer; }
          @media print { .print { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="title">
              <h1>شواطئ عدن</h1>
              <p>فاتورة حجز رقم #${escapeHtml(booking.id)}</p>
            </div>
            <div class="meta">
              <p>تاريخ الفاتورة: ${formatDate(booking.invoiceDate)}</p>
              <p>حالة الحجز: ${getStatusLabel(booking.status)}</p>
            </div>
          </div>
          <div class="grid">
            <div class="box">
              <strong>العميل</strong>
              <p>${escapeHtml(booking.customerName)}</p>
              <p>${escapeHtml(booking.customerPhone || '—')}</p>
            </div>
            <div class="box">
              <strong>بيانات المناسبة</strong>
              <p>التاريخ: ${formatDate(booking.eventDate)}</p>
              <p>الوقت: ${formatTime(booking.deliveryTime)} ${escapeHtml(booking.deliveryPeriod || '')}</p>
              <p>الموقع: ${escapeHtml(booking.deliveryAddress || 'غير محدد')}</p>
            </div>
          </div>
          ${booking.mark ? `<div class="box"><strong>العلامة:</strong> ${escapeHtml(booking.mark)}</div>` : ''}
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="totals">
            <div class="row"><span>الإجمالي</span><strong>${formatCurrency(booking.totalAmount)}</strong></div>
            <div class="row"><span>المدفوع</span><strong>${formatCurrency(booking.paidAmount)}</strong></div>
            <div class="row"><span>المتبقي</span><strong>${formatCurrency(booking.remaining)}</strong></div>
            ${deposit > 0 ? `
              <div class="row"><span>تأمين الصحون</span><strong>${formatCurrency(deposit)}</strong></div>
              <div class="row"><span>المسترد</span><strong>${formatCurrency(returned)}</strong></div>
            ` : ''}
            <div class="row grand"><span>إجمالي الفاتورة</span><strong>${formatCurrency(booking.totalAmount)}</strong></div>
          </div>
          ${booking.notes ? `<div class="notes"><strong>ملاحظات:</strong><br>${escapeHtml(booking.notes)}</div>` : ''}
          <button class="print" onclick="window.print()">طباعة</button>
        </div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      showToast('تعذر فتح نافذة الطباعة', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  // ===== معالجة النقر على البطاقة =====
  function handleListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    const card = event.target.closest('.booking-card');

    if (actionButton) {
      const id = Number(actionButton.dataset.id);
      const booking = allBookings.find(item => Number(item.id) === id);
      if (!booking) return;
      const action = actionButton.dataset.action;
      if (action === 'edit') {
        window.location.href = `booking-form.html?id=${encodeURIComponent(id)}`;
      } else if (action === 'delete') {
        confirmDelete(booking);
      } else if (action === 'print') {
        printBooking(booking);
      }
      return;
    }

    if (card) {
      const id = card.dataset.id;
      window.location.href = `booking-form.html?id=${encodeURIComponent(id)}`;
    }
  }

  // ===== ربط الأحداث =====
  function bindEvents() {
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        searchQuery = event.target.value || '';
        applyFiltersAndRender();
      });
    }

    if (filterChips) {
      filterChips.addEventListener('click', event => {
        const chip = event.target.closest('.filter-chip');
        if (!chip) return;
        const filter = chip.dataset.filter;
        if (!filter) return;
        currentFilter = filter;
        filterChips.querySelectorAll('.filter-chip').forEach(item => {
          item.classList.toggle('active', item === chip);
        });
        applyFiltersAndRender();
      });
    }

    if (bookingList) {
      bookingList.addEventListener('click', handleListClick);
    }

    if (fab) {
      fab.addEventListener('click', () => {
        window.location.href = 'booking-form.html';
      });
    }

    window.handleDeleteBooking = id => {
      const booking = allBookings.find(item => Number(item.id) === Number(id));
      if (booking) confirmDelete(booking);
    };

    window.exportBooking = id => {
      const booking = allBookings.find(item => Number(item.id) === Number(id));
      if (booking) printBooking(booking);
    };

    window.reloadBookings = loadBookings;
  }

  // ===== التهيئة =====
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