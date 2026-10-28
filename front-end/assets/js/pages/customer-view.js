/* =========================================================
 * customer-view.js
 * صفحة تفاصيل العميل:
 * - الحجوزات + المدفوعات + كشف الحساب (عادي/تفصيلي)
 * - إنشاء حجز/دفعة
 * - تغيير حالة الحجز مع تسجيل دفعة
 * - طباعة الحجز عبر invoice.html
 * ========================================================= */

(() => {
  'use strict';

  /* =========================================================
   * 1) الحالة
   * ========================================================= */

  const state = {
    customerId: 0,
    customer: null,
    bookings: [],
    payments: [],
    paymentMethods: [],
    items: [],
    mode: 'booking',
    editingBookingId: null,
    saving: false,
    loading: false,
    statementView: 'normal',
    statusBookingId: null,
    savingStatus: false
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ARABIC_DAYS = [
    'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
  ];

  const STATUS_MAP = {
    new:       { label: 'جديد',  cls: 'new' },
    confirmed: { label: 'مؤكد',  cls: 'confirmed' },
    completed: { label: 'مكتمل', cls: 'completed' },
    cancelled: { label: 'ملغي',  cls: 'cancelled' }
  };

  /* =========================================================
   * 2) أدوات مساعدة
   * ========================================================= */

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }

  function number(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function money(v) {
    const amount = number(v);
    if (window.API?.formatCurrency) return window.API.formatCurrency(amount);
    return amount.toLocaleString('ar-SA', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + ' ر.س';
  }

  function moneyShort(v) {
    const n = number(v);
    try {
      return new Intl.NumberFormat('ar-SA', {
        minimumFractionDigits: 0, maximumFractionDigits: 2
      }).format(n);
    } catch { return n.toFixed(2); }
  }

  function dateOnly(v) { return v ? String(v).slice(0, 10) : ''; }

  function dateTimeLocalNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function sqlDateTime(v) {
    if (!v) return null;
    return String(v).replace('T', ' ').slice(0, 19);
  }

  function nowSqlDateTime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateDisplay(v) {
    const s = dateOnly(v);
    if (!s) return '—';
    const p = s.split('-');
    return (p.length === 3 && p[0].length === 4) ? `${p[2]}/${p[1]}/${p[0]}` : s;
  }

  function getArabicDay(v) {
    if (!v) return '';
    const d = new Date(dateOnly(v));
    if (Number.isNaN(d.getTime())) return '';
    return ARABIC_DAYS[d.getDay()] || '';
  }

  function formatTime12(v) {
    if (!v) return '—';
    const m = String(v).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(v);
    let h = Number(m[1]);
    const mm = m[2];
    const period = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${h}:${mm} ${period}`;
  }

  function getStatus(v) {
    const s = String(v || 'new').toLowerCase().trim();
    return STATUS_MAP[s] ? s : 'new';
  }

  function initials(name) {
    const chars = String(name || '').trim().split(/\s+/)
      .filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
    return chars || 'ع';
  }

  function unwrap(v) {
    if (v && typeof v === 'object' && 'data' in v) return v.data;
    return v;
  }

  function arrayData(v) {
    const d = unwrap(v);
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.results)) return d.results;
    return [];
  }

  async function apiCall(names, ...args) {
    const api = window.API;
    if (!api) throw new Error('واجهة API غير متاحة');
    for (const name of names) {
      if (typeof api[name] === 'function') {
        return unwrap(await api[name](...args));
      }
    }
    throw new Error('دالة API غير متاحة: ' + names.join(' / '));
  }

  async function waitForApi(timeout = 10000) {
    const start = Date.now();
    while (!window.API && Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!window.API) throw new Error('تعذر تحميل API');
  }

  function toast(msg, type = 'info') {
    if (window.Layout?.showToast) { window.Layout.showToast(msg, type); return; }
    if (type === 'error') console.error(msg); else console.log(msg);
  }

  async function confirmAction(message) {
    if (window.Layout?.showConfirm) {
      return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(Boolean(v)); } };
        try {
          window.Layout.showConfirm({
            title: 'تأكيد العملية', message,
            confirmText: 'تأكيد', cancelText: 'إلغاء', danger: true,
            onConfirm: () => finish(true),
            onCancel: () => finish(false)
          });
        } catch { finish(window.confirm(message)); }
      });
    }
    return window.confirm(message);
  }

  /* =========================================================
   * تجهيز القيم بصيغة صحيحة للـ API
   * ========================================================= */

  function normalizeDeliveryTime(v) {
    if (!v) return '12:00';
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '12:00';
    const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, '0');
    return `${hh}:${m[2]}`;
  }

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

  function normalizeEventDate(v) {
    if (!v) return todayString();
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return todayString();
  }

  /* =========================================================
   * 3) حسابات محلية
   * ========================================================= */

  function bookingPaid(bookingId) {
    return state.payments
      .filter((p) => Number(p.booking_id ?? p.bookingId) === Number(bookingId))
      .reduce((sum, p) => sum + number(p.amount), 0);
  }

  function bookingTotal(b) {
    return number(b.total_amount ?? b.totalAmount ?? b.total);
  }

  function bookingRemaining(b) {
    return Math.max(0, bookingTotal(b) - bookingPaid(b.id));
  }

  function computeAccount() {
    let totalInvoices = 0;
    let totalPaid = 0;

    state.bookings.forEach((b) => {
      if (getStatus(b.status) !== 'cancelled') totalInvoices += bookingTotal(b);
    });

    state.payments.forEach((p) => {
      totalPaid += number(p.amount);
    });

    return {
      totalInvoices,
      totalPaid,
      balance: Math.max(0, totalInvoices - totalPaid)
    };
  }

  function paymentMethodName(payment) {
    if (payment?.payment_method?.name) return payment.payment_method.name;
    const pid = payment?.payment_method_id ?? payment?.paymentMethodId;
    const m = state.paymentMethods.find((x) => Number(x.id) === Number(pid));
    return m?.name || 'غير محددة';
  }

  /* =========================================================
   * 4) كشف الحساب
   * ========================================================= */

  function computeStatementRows() {
    const rows = [];

    state.bookings.forEach((b) => {
      if (getStatus(b.status) === 'cancelled') return;
      rows.push({
        type: 'booking',
        date: b.invoice_date || b.event_date || '',
        description: `حجز #${b.id}${b.mark ? ' - ' + b.mark : ''}`,
        debit: bookingTotal(b),
        credit: 0,
        booking: b
      });
    });

    state.payments.forEach((p) => {
      const bid = p.booking_id ?? p.bookingId;
      rows.push({
        type: 'payment',
        date: p.payment_date || '',
        description: bid ? `دفعة للحجز #${bid}` : 'دفعة عامة',
        debit: 0,
        credit: number(p.amount),
        payment: p
      });
    });

    return rows.sort((a, b) =>
      new Date(a.date || 0) - new Date(b.date || 0)
    );
  }

  /* =========================================================
   * 5) Skeleton Loading
   * ========================================================= */

  function renderSkeleton() {
    const container = $('customerViewContent');
    if (!container) return;

    container.innerHTML = `
      <div class="sk-card">
        <div class="sk-line w-60"></div>
        <div class="sk-line w-40"></div>
      </div>
      <div class="cv-summary">
        <div class="sk-card" style="margin:0;padding:14px 8px">
          <div class="sk-line w-80" style="margin:0 auto 6px"></div>
          <div class="sk-line w-40" style="margin:0 auto"></div>
        </div>
        <div class="sk-card" style="margin:0;padding:14px 8px">
          <div class="sk-line w-80" style="margin:0 auto 6px"></div>
          <div class="sk-line w-40" style="margin:0 auto"></div>
        </div>
        <div class="sk-card" style="margin:0;padding:14px 8px">
          <div class="sk-line w-80" style="margin:0 auto 6px"></div>
          <div class="sk-line w-40" style="margin:0 auto"></div>
        </div>
      </div>
      <div class="sk-card">
        <div class="sk-line w-40"></div>
        <div class="sk-line w-80"></div>
        <div class="sk-line w-60"></div>
      </div>
      <div class="sk-card">
        <div class="sk-line w-40"></div>
        <div class="sk-line w-80"></div>
        <div class="sk-line w-60"></div>
      </div>
    `;
  }

  /* =========================================================
   * 6) رأس العميل والملخص
   * ========================================================= */

  function renderHeader() {
    const c = state.customer;
    const a = computeAccount();
    const balance = Math.max(0, a.balance);

    let statusBadge = '';
    if (c.is_active === false) {
      statusBadge = `<span class="status-badge inactive"><i class="fas fa-circle" style="font-size:7px"></i> غير نشط</span>`;
    } else if (balance > 0) {
      statusBadge = `<span class="status-badge remaining"><i class="fas fa-circle" style="font-size:7px"></i> متبقي ${moneyShort(balance)}</span>`;
    } else {
      statusBadge = `<span class="status-badge paid"><i class="fas fa-circle" style="font-size:7px"></i> مسدد</span>`;
    }

    return `
      <div class="cv-back-row">
        <a href="customers.html" class="cv-back-btn">
          <i class="fas fa-arrow-right"></i> العملاء
        </a>
      </div>

      <section class="cv-header">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div class="info">
          <div class="name">${esc(c.name || 'بدون اسم')}</div>
          <div class="phone">${esc(c.phone || '—')}</div>
          ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
        </div>
        ${statusBadge}
      </section>

      <section class="cv-summary">
        <div class="stat">
          <span class="label">إجمالي الحجوزات</span>
          <span class="value">${state.bookings.length}</span>
        </div>
        <div class="stat">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">${moneyShort(a.totalPaid)}</span>
        </div>
        <div class="stat">
          <span class="label">الرصيد المستحق</span>
          <span class="value ${balance > 0 ? 'danger' : 'success'}">${moneyShort(balance)}</span>
        </div>
      </section>
    `;
  }

  /* =========================================================
   * 7) التابات
   * ========================================================= */

  function renderTabs() {
    return `
      <div class="cv-tabs" id="profileTabs">
        <button type="button" class="cv-tab active" data-tab="bookings">
          <i class="fas fa-calendar-check"></i> الحجوزات
        </button>
        <button type="button" class="cv-tab" data-tab="payments">
          <i class="fas fa-money-bill-wave"></i> المدفوعات
        </button>
        <button type="button" class="cv-tab" data-tab="statement">
          <i class="fas fa-file-invoice-dollar"></i> كشف الحساب
        </button>
      </div>
    `;
  }

  /* =========================================================
   * 8) بطاقة الحجز
   * ========================================================= */

  function renderBookingCard(booking) {
    const status = getStatus(booking.status);
    const statusInfo = STATUS_MAP[status];
    const paid = bookingPaid(booking.id);
    const total = bookingTotal(booking);
    const remaining = Math.max(0, total - paid);
    const deposit = number(booking.plate_deposit);

    const items = Array.isArray(booking.items) ? booking.items : [];
    let itemsPreview = '';
    if (items.length) {
      const names = items.slice(0, 2).map((it) =>
        esc(it.item_name ?? it.name ?? 'صنف')
      );
      itemsPreview = names.join(' · ');
      if (items.length > 2) itemsPreview += ` +${items.length - 2}`;
    }

    const isCompleted = status === 'completed';

    let lockedBanner = '';
    if (isCompleted) {
      lockedBanner = `<div class="cv-bk-locked"><i class="fas fa-lock"></i> الحجز مغلق</div>`;
    }

    let actions = '';
    if (isCompleted) {
      actions = `
        <div class="cv-bk-actions">
          ${remaining > 0 ? `
            <button class="cv-action warning" data-action="payRemaining" data-id="${booking.id}">
              <i class="fas fa-hand-holding-usd"></i> تسديد (${moneyShort(remaining)})
            </button>
          ` : ''}
          <button class="cv-action secondary" data-action="changeStatus" data-id="${booking.id}">
            <i class="fas fa-exchange-alt"></i> الحالة
          </button>
          <button class="cv-action primary" data-action="printBooking" data-id="${booking.id}">
            <i class="fas fa-receipt"></i> الفاتورة
          </button>
          <button class="cv-action danger" data-action="deleteBooking" data-id="${booking.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    } else {
      actions = `
        <div class="cv-bk-actions">
          <button class="cv-action primary" data-action="editBooking" data-id="${booking.id}">
            <i class="fas fa-pen"></i> تعديل
          </button>
          <button class="cv-action secondary" data-action="changeStatus" data-id="${booking.id}">
            <i class="fas fa-exchange-alt"></i> الحالة
          </button>
          <button class="cv-action secondary" data-action="printBooking" data-id="${booking.id}">
            <i class="fas fa-print"></i>
          </button>
          <button class="cv-action danger" data-action="deleteBooking" data-id="${booking.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }

    const dayName = getArabicDay(booking.event_date);

    return `
      <article class="cv-booking-card" data-id="${booking.id}">
        <div class="cv-bk-head">
          <div>
            <h4 class="cv-bk-title">
              حجز <span class="num">#${esc(booking.id)}</span>
            </h4>
            ${booking.mark ? `<span class="cv-bk-mark"><i class="fas fa-tag"></i> ${esc(booking.mark)}</span>` : ''}
          </div>
          <span class="cv-bk-status ${statusInfo.cls}">${statusInfo.label}</span>
        </div>

        <div class="cv-bk-datetime">
          <span><i class="far fa-calendar"></i> ${formatDateDisplay(booking.event_date)}${dayName ? ' - ' + dayName : ''}</span>
          <span><i class="far fa-clock"></i> ${formatTime12(booking.delivery_time)}${booking.delivery_period ? ' · ' + esc(booking.delivery_period) : ''}</span>
        </div>

        <div class="cv-bk-finance">
          <div class="cv-fin total">
            <div class="lbl">الإجمالي</div>
            <div class="val">${moneyShort(total)}</div>
          </div>
          <div class="cv-fin paid">
            <div class="lbl">المدفوع</div>
            <div class="val">${moneyShort(paid)}</div>
          </div>
          <div class="cv-fin remaining">
            <div class="lbl">المتبقي</div>
            <div class="val">${moneyShort(remaining)}</div>
          </div>
          <div class="cv-fin deposit">
            <div class="lbl">تأمين</div>
            <div class="val">${moneyShort(deposit)}</div>
          </div>
        </div>

        ${itemsPreview ? `<div class="cv-bk-items"><strong>الأصناف:</strong> ${itemsPreview}</div>` : ''}
        ${lockedBanner}
        ${actions}
      </article>
    `;
  }

  function renderBookingsList() {
    if (!state.bookings.length) {
      return `<div class="cv-empty">
        <i class="fas fa-calendar-xmark"></i>
        <h4>لا توجد حجوزات</h4>
        <p>ابدأ بإضافة حجز جديد</p>
      </div>`;
    }

    const sorted = [...state.bookings].sort((a, b) => {
      const dA = dateOnly(a.event_date || a.invoice_date);
      const dB = dateOnly(b.event_date || b.invoice_date);
      return dB.localeCompare(dA);
    });

    return sorted.map(renderBookingCard).join('');
  }

  /* =========================================================
   * 9) بطاقة الدفعة
   * ========================================================= */

  function renderPaymentCard(payment) {
    const bid = payment.booking_id ?? payment.bookingId;
    const methodName = paymentMethodName(payment);
    const dateStr = formatDateDisplay(payment.payment_date || payment.paymentDate);

    return `
      <article class="cv-payment-card" data-id="${payment.id}">
        <div class="cv-pay-icon"><i class="fas fa-money-bill-wave"></i></div>
        <div class="cv-pay-info">
          <div class="cv-pay-title">دفعة #${esc(payment.id)} · ${esc(methodName)}</div>
          <div class="cv-pay-sub">
            ${esc(dateStr)}
            ${bid ? ` · <a href="#" data-action="gotoBooking" data-id="${esc(bid)}" style="color:var(--primary);font-weight:700;text-decoration:none;">حجز #${esc(bid)}</a>` : ' · دفعة عامة'}
          </div>
          ${payment.notes ? `<div class="cv-pay-sub">${esc(payment.notes)}</div>` : ''}
        </div>
        <div class="cv-pay-amount">+${moneyShort(payment.amount)}</div>
        <button class="cv-pay-del" data-action="deletePayment" data-id="${payment.id}" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </article>
    `;
  }

  function renderPaymentsList() {
    if (!state.payments.length) {
      return `<div class="cv-empty">
        <i class="fas fa-money-bill-transfer"></i>
        <h4>لا توجد مدفوعات</h4>
        <p>لم يتم تسجيل أي دفعة لهذا العميل</p>
      </div>`;
    }

    const sorted = [...state.payments].sort((a, b) =>
      new Date(b.payment_date || 0) - new Date(a.payment_date || 0)
    );

    return sorted.map(renderPaymentCard).join('');
  }

  /* =========================================================
   * 10) كشف الحساب
   * ========================================================= */

  function renderStatementRows(rows, detailed) {
    if (!rows.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">
        لا توجد حركات
      </td></tr>`;
    }

    let balance = 0;

    return rows.map((row) => {
      balance += row.debit - row.credit;

      let detailHtml = '';
      if (detailed && row.type === 'booking' && row.booking) {
        const items = Array.isArray(row.booking.items) ? row.booking.items : [];
        const deposit = number(row.booking.plate_deposit);

        let detailRows = '';
        if (deposit > 0) {
          detailRows += `
            <div class="cv-stmt-detail-row" style="background:#fff7ed;border-radius:5px;padding:5px 8px;margin-bottom:2px;">
              <span class="name" style="color:#c2410c;">تأمين الصحون</span>
              <span class="num">1</span>
              <span class="num">${moneyShort(deposit)}</span>
              <span class="num" style="color:#c2410c;font-weight:800;">${moneyShort(deposit)}</span>
            </div>`;
        }
        if (items.length) {
          detailRows += items.map((it) => `
            <div class="cv-stmt-detail-row">
              <span class="name">${esc(it.item_name ?? it.name ?? 'صنف')}</span>
              <span class="num">${number(it.quantity)}</span>
              <span class="num">${moneyShort(it.unit_price ?? it.price)}</span>
              <span class="num">${moneyShort(it.total_price ?? (number(it.quantity) * number(it.unit_price ?? it.price)))}</span>
            </div>
          `).join('');
        }

        detailHtml = `
          <div class="cv-stmt-detail">
            <div class="cv-stmt-detail-title"><i class="fas fa-utensils"></i> تفاصيل الأصناف</div>
            ${detailRows || '<div style="color:var(--text-muted);font-size:11px;">لا توجد أصناف</div>'}
          </div>
        `;
      }

      if (detailed && row.type === 'payment' && row.payment) {
        const method = paymentMethodName(row.payment);
        detailHtml = `
          <div class="cv-stmt-detail">
            <div class="cv-stmt-detail-title"><i class="fas fa-credit-card"></i> تفاصيل الدفعة</div>
            <div class="cv-stmt-detail-row">
              <span class="name">طريقة الدفع</span>
              <span class="num" style="grid-column:2/-1;text-align:right;direction:rtl;">${esc(method)}</span>
            </div>
            ${row.payment.notes ? `
              <div class="cv-stmt-detail-row">
                <span class="name">ملاحظات</span>
                <span class="num" style="grid-column:2/-1;text-align:right;direction:rtl;">${esc(row.payment.notes)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      return `
        <tr>
          <td class="desc">
            ${esc(row.description)}
            <span class="date">${formatDateDisplay(row.date)}</span>
          </td>
          <td class="num debit">${row.debit ? moneyShort(row.debit) : '—'}</td>
          <td class="num credit">${row.credit ? moneyShort(row.credit) : '—'}</td>
          <td class="num balance">${moneyShort(balance)}</td>
        </tr>
        ${detailHtml ? `<tr><td colspan="4" style="padding:0 8px 8px;">${detailHtml}</td></tr>` : ''}
      `;
    }).join('');
  }

  function renderStatementContent() {
    const rows = computeStatementRows();
    const detailed = state.statementView === 'detailed';

    const toggle = `
      <div class="cv-stmt-toggle" id="stmtToggle">
        <button type="button" class="cv-stmt-btn ${!detailed ? 'active' : ''}" data-view="normal">
          <i class="fas fa-list"></i> كشف عادي
        </button>
        <button type="button" class="cv-stmt-btn ${detailed ? 'active' : ''}" data-view="detailed">
          <i class="fas fa-list-ul"></i> كشف تفصيلي
        </button>
      </div>
    `;

    if (!rows.length) {
      return `
        ${toggle}
        <div class="cv-empty">
          <i class="fas fa-receipt"></i>
          <h4>لا يوجد كشف حساب</h4>
          <p>لم يتم تسجيل أي حركة بعد</p>
        </div>
      `;
    }

    const table = `
      <div class="cv-stmt-card">
        <table class="cv-stmt-table">
          <thead>
            <tr>
              <th>البيان</th>
              <th class="num">مدين</th>
              <th class="num">دائن</th>
              <th class="num">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${renderStatementRows(rows, detailed)}
          </tbody>
        </table>
      </div>
    `;

    const printBtn = `
      <div style="display:flex;justify-content:flex-start;margin-top:12px;">
        <button type="button" class="btn btn-secondary" data-action="printStatement">
          <i class="fas fa-print"></i> طباعة الكشف
        </button>
      </div>
    `;

    return toggle + table + printBtn;
  }

  /* =========================================================
   * 11) العرض العام
   * ========================================================= */

  function renderProfile() {
    const container = $('customerViewContent');
    if (!container || !state.customer) return;

    container.innerHTML = `
      ${renderHeader()}
      ${renderTabs()}

      <section class="cv-tab-content active" id="tab-bookings">
        <div class="cv-section-head">
          <h3><i class="fas fa-calendar-check"></i> الحجوزات (${state.bookings.length})</h3>
          <button type="button" class="btn btn-primary btn-sm" data-action="newBooking">
            <i class="fas fa-plus"></i> حجز جديد
          </button>
        </div>
        <div id="bookingsList">${renderBookingsList()}</div>
      </section>

      <section class="cv-tab-content" id="tab-payments">
        <div class="cv-section-head">
          <h3><i class="fas fa-money-bill-wave"></i> المدفوعات (${state.payments.length})</h3>
          <button type="button" class="btn btn-primary btn-sm" data-action="newPayment">
            <i class="fas fa-plus"></i> دفعة جديدة
          </button>
        </div>
        <div id="paymentsList">${renderPaymentsList()}</div>
      </section>

      <section class="cv-tab-content" id="tab-statement">
        <div class="cv-section-head">
          <h3><i class="fas fa-file-invoice-dollar"></i> كشف الحساب</h3>
        </div>
        <div id="statementContent">${renderStatementContent()}</div>
      </section>
    `;

    bindTabs();
  }

  function bindTabs() {
    $$('#profileTabs .cv-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        $$('#profileTabs .cv-tab').forEach((t) => t.classList.toggle('active', t === tab));
        $$('.cv-tab-content').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `tab-${target}`);
        });
      });
    });

    const toggle = document.getElementById('stmtToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.cv-stmt-btn');
        if (!btn) return;
        state.statementView = btn.dataset.view === 'detailed' ? 'detailed' : 'normal';
        const content = document.getElementById('statementContent');
        if (content) content.innerHTML = renderStatementContent();
        bindTabs();
      });
    }
  }

  /* =========================================================
   * 12) تحميل البيانات
   * ========================================================= */

  async function ensureItemsLoaded() {
    if (state.items.length) return;
    try {
      const list = await apiCall(['getItems']);
      state.items = arrayData(list);
    } catch (e) {
      console.warn('items failed:', e);
      state.items = [];
    }
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true;
    renderSkeleton();

    try {
      await waitForApi();

      const customer = await apiCall(['getCustomer'], state.customerId);
      if (!customer) {
        renderFailure('العميل غير موجود', 'لم يتم العثور على العميل.');
        return;
      }
      state.customer = customer;

      const [bookingsRes, paymentsRes, methodsRes] = await Promise.allSettled([
        apiCall(['getBookings'], { customer_id: state.customerId }),
        apiCall(['getCustomerPayments'], { customer_id: state.customerId }),
        apiCall(['getPaymentMethods'])
      ]);

      state.bookings = bookingsRes.status === 'fulfilled' ? arrayData(bookingsRes.value) : [];
      state.payments = paymentsRes.status === 'fulfilled' ? arrayData(paymentsRes.value) : [];
      state.paymentMethods = methodsRes.status === 'fulfilled' ? arrayData(methodsRes.value) : [];

      renderProfile();
    } catch (error) {
      console.error('loadData failed:', error);
      renderFailure('فشل تحميل البيانات', error?.message || 'تعذر الاتصال بالخادم');
      toast(error?.message || 'فشل التحميل', 'error');
    } finally {
      state.loading = false;
    }
  }

  function renderFailure(title, message) {
    const container = $('customerViewContent');
    if (!container) return;
    container.innerHTML = `
      <div class="cv-empty">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>${esc(title)}</h4>
        <p>${esc(message)}</p>
        <a href="customers.html" class="btn btn-primary" style="margin-top:14px;display:inline-flex;">
          <i class="fas fa-arrow-right"></i> العودة إلى العملاء
        </a>
      </div>
    `;
  }

  /* =========================================================
   * 13) Modal الحجز/الدفعة
   * ========================================================= */

  function openModal() {
    const modal = $('transactionModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('transactionModal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    state.editingBookingId = null;
    setMode('booking');
  }

  function setMode(mode) {
    state.mode = mode === 'payment' ? 'payment' : 'booking';

    $$('.switch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    const bm = $('bookingMode');
    const pm = $('paymentMode');
    const title = $('transactionModalTitle');
    const save = $('transactionSaveBtn');

    if (bm) bm.style.display = state.mode === 'booking' ? 'block' : 'none';
    if (pm) pm.style.display = state.mode === 'payment' ? 'block' : 'none';

    if (title) {
      title.textContent = state.mode === 'booking'
        ? (state.editingBookingId ? 'تعديل الحجز' : 'حجز جديد')
        : 'تسجيل دفعة';
    }
    if (save && !state.saving) {
      save.textContent = state.mode === 'booking'
        ? (state.editingBookingId ? 'تحديث الحجز' : 'حفظ الحجز')
        : 'تسجيل الدفعة';
    }
  }

  function setField(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? '—';
  }

  /* --- طرق الدفع --- */
  function fillPaymentMethods(selectedId = '') {
    const bookingSelect = $('bookingPaymentMethod');
    const paymentBox = $('paymentMethodsContainer');
    const methods = state.paymentMethods.filter((m) => m.is_active !== false);

    if (bookingSelect) {
      bookingSelect.innerHTML = '<option value="">اختر طريقة الدفع</option>' +
        methods.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
      if (selectedId !== '') bookingSelect.value = String(selectedId);
    }

    if (paymentBox) {
      if (!methods.length) {
        paymentBox.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">لا توجد طرق دفع</span>';
        return;
      }
      paymentBox.innerHTML = methods.map((m, i) => `
        <label class="payment-method-option">
          <input type="radio" name="customerPaymentMethod" value="${esc(m.id)}"
            ${Number(selectedId) === Number(m.id) || (!selectedId && i === 0) ? 'checked' : ''}>
          <i class="fas fa-credit-card"></i> ${esc(m.name)}
        </label>
      `).join('');
    }
  }

  function fillPaymentBookings(selectedId = '') {
    const select = $('paymentBooking');
    if (!select) return;
    const openBookings = state.bookings.filter((b) => bookingRemaining(b) > 0);

    select.innerHTML = '<option value="">اختر الحجز المرتبط بالدفعة</option>' +
      openBookings.map((b) => `
        <option value="${esc(b.id)}">
          حجز #${esc(b.id)} · ${esc(formatDateDisplay(b.event_date) || b.mark || '—')} · متبقى ${esc(moneyShort(bookingRemaining(b)))} ر.س
        </option>
      `).join('');

    if (selectedId) select.value = String(selectedId);
  }

  /* --- أصناف الحجز --- */
  function itemId(it) { return it.item_id ?? it.itemId ?? it.id; }
  function itemName(it) { return it.name ?? it.item_name ?? it.itemName ?? ''; }
  function itemPrice(it) {
    return number(it.default_price ?? it.defaultPrice ?? it.price ?? it.unit_price ?? it.unitPrice);
  }

  function renderNewItemRow(data = {}) {
    const selectedId = data.item_id ?? data.itemId ?? '';
    const quantity = number(data.quantity) || 1;
    const price = number(data.unit_price ?? data.unitPrice ?? data.price);

    const options = state.items.map((it) => `
      <option value="${esc(itemId(it))}"
              data-name="${esc(itemName(it))}"
              data-price="${esc(itemPrice(it))}"
              ${Number(selectedId) === Number(itemId(it)) ? 'selected' : ''}>
        ${esc(itemName(it))} · ${esc(moneyShort(itemPrice(it)))} ر.س
      </option>
    `).join('');

    return `
      <div class="item-row">
        <select class="form-input item-select">
          <option value="">اختر الصنف</option>
          ${options}
        </select>
        <input type="number" class="form-input item-qty" min="1" step="1" value="${esc(quantity)}" placeholder="الكمية">
        <input type="number" class="form-input item-price" min="0" step="0.01" value="${esc(price || '')}" placeholder="السعر">
        <button type="button" class="btn-icon-sm btn-icon-danger remove-item-btn" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
  }

  function renderBookingItems(items = []) {
    const box = $('bookingItemsContainer');
    if (!box) return;
    const source = Array.isArray(items) ? items : [];
    if (!source.length) {
      box.innerHTML = renderNewItemRow();
    } else {
      box.innerHTML = source.map(renderNewItemRow).join('');
    }
    updateBookingPreview();
  }

  function collectBookingItems() {
    return $$('#bookingItemsContainer .item-row').map((row) => {
      const select = row.querySelector('.item-select');
      const option = select?.options[select.selectedIndex];
      const quantity = number(row.querySelector('.item-qty')?.value);
      const unitPrice = number(row.querySelector('.item-price')?.value);
      return {
        item_id: Number(select?.value) || null,
        item_name: option?.dataset.name || '',
        quantity,
        unit_price: unitPrice,
        total_price: Number((quantity * unitPrice).toFixed(2))
      };
    }).filter((it) => it.item_name && it.quantity > 0 && it.unit_price >= 0);
  }

  function updateBookingPreview() {
    const items = collectBookingItems();
    const total = items.reduce((s, it) => s + number(it.total_price), 0);
    const deposit = number($('bookingPlateDeposit')?.value);
    const initialPayment = number($('bookingInitialPayment')?.value);

    setText('bookingItemsTotal', moneyShort(total));
    setText('bookingPlateDisplay', moneyShort(deposit));
    setText('bookingGrandTotal', moneyShort(total));
    setText('bookingRemainingPreview', moneyShort(Math.max(0, total - initialPayment)));
  }

  function resetBookingForm(booking = null) {
    state.editingBookingId = booking ? Number(booking.id) : null;
    setText('bookingCustomerName', state.customer?.name || '—');
    setText('bookingCustomerPhone', state.customer?.phone || '—');

    setField('bookingEventDate', dateOnly(booking?.event_date) || todayString());
    setField('bookingDeliveryTime', String(booking?.delivery_time || '').slice(0, 5));
    setField('bookingDeliveryPeriod', booking?.delivery_period || 'ظهراً');
    setField('bookingAddress', booking?.delivery_address || '');
    setField('bookingMark', booking?.mark || '');
    setField('bookingPlateDeposit', booking ? booking.plate_deposit : '');
    setField('bookingNotes', booking?.notes || '');
    setField('bookingInitialPayment', '');

    fillPaymentMethods();
    renderBookingItems(booking?.items || []);
    updateBookingPreview();
    setMode('booking');
  }

  async function openBookingModal(booking = null) {
    if (!state.customer) return;
    await ensureItemsLoaded();
    resetBookingForm(booking);
    openModal();
  }

  function openPaymentModal(preselectedBookingId = '') {
    if (!state.customer) return;
    state.editingBookingId = null;
    setText('paymentCustomerName', state.customer.name || '—');
    setText('paymentCustomerPhone', state.customer.phone || '—');
    setField('paymentAmount', '');
    setField('paymentDate', dateTimeLocalNow());
    setField('paymentNotes', '');

    fillPaymentBookings(preselectedBookingId);
    fillPaymentMethods();
    updatePaymentPreview();
    setMode('payment');
    openModal();
  }

  function updatePaymentPreview() {
    const bid = Number($('paymentBooking')?.value) || 0;
    const booking = state.bookings.find((b) => Number(b.id) === bid);
    const current = booking ? bookingRemaining(booking) : Math.max(0, computeAccount().balance);
    const amount = number($('paymentAmount')?.value);
    const after = Math.max(0, current - amount);
    setText('paymentCurrentBalance', moneyShort(current));
    setText('paymentAfterBalance', moneyShort(after));
  }

  function validateBooking() {
    const eventDate = $('bookingEventDate')?.value;
    const deliveryTime = $('bookingDeliveryTime')?.value;
    const deliveryPeriod = $('bookingDeliveryPeriod')?.value;
    const address = $('bookingAddress')?.value.trim();
    const deposit = number($('bookingPlateDeposit')?.value);
    const initialPayment = number($('bookingInitialPayment')?.value);
    const items = collectBookingItems();
    const total = items.reduce((s, it) => s + number(it.total_price), 0);

    if (!eventDate) throw new Error('تاريخ المناسبة مطلوب');
    if (!deliveryTime) throw new Error('وقت التسليم مطلوب');
    if (!deliveryPeriod) throw new Error('الفترة مطلوبة');
    if (!address) throw new Error('عنوان التوصيل مطلوب');
    if (!items.length) throw new Error('أضف صنفًا واحدًا على الأقل');
    if (initialPayment > total) throw new Error('الدفعة الأولى تتجاوز الإجمالي');

    return {
      eventDate, deliveryTime, deliveryPeriod, address,
      deposit, initialPayment, items,
      total: Number(total.toFixed(2))
    };
  }

  function bookingPayload(data) {
    const payload = {
      customer_id: Number(state.customerId),
      invoice_date: nowSqlDateTime(),
      event_date: normalizeEventDate(data.eventDate),
      delivery_time: normalizeDeliveryTime(data.deliveryTime),
      delivery_period: data.deliveryPeriod,
      delivery_address: data.address,
      mark: $('bookingMark')?.value.trim() || null,
      total_amount: data.total,
      plate_deposit: data.deposit || null,
      status: state.editingBookingId
        ? (state.bookings.find((b) => Number(b.id) === Number(state.editingBookingId))?.status || 'new')
        : 'new',
      notes: $('bookingNotes')?.value.trim() || null,
      items: data.items
    };

    if (!state.editingBookingId && data.initialPayment > 0) {
      const methodId = number($('bookingPaymentMethod')?.value);
      if (!methodId) throw new Error('اختر طريقة الدفع للدفعة الأولى');
      payload.initial_payment = data.initialPayment;
      payload.payment_method_id = methodId;
      payload.payment_date = nowSqlDateTime();
      payload.payment_notes = $('bookingNotes')?.value.trim() || null;
    }

    return payload;
  }

  async function saveBooking() {
    if (state.saving) return;
    try {
      const data = validateBooking();
      const payload = bookingPayload(data);

      state.saving = true;
      setSaveButton(true, state.editingBookingId ? 'جاري التحديث...' : 'جاري الحفظ...');

      if (state.editingBookingId) {
        await apiCall(['updateBooking'], Number(state.editingBookingId), payload);
        toast('تم تحديث الحجز', 'success');
      } else {
        await apiCall(['createBooking', 'addBooking'], payload);
        toast('تم إضافة الحجز', 'success');
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('saveBooking:', error);
      toast(error?.message || 'تعذر حفظ الحجز', 'error');
    } finally {
      state.saving = false;
      setSaveButton(false);
    }
  }

  function validatePayment() {
    const amount = number($('paymentAmount')?.value);
    const paymentDate = $('paymentDate')?.value;
    const methodId = number(document.querySelector('input[name="customerPaymentMethod"]:checked')?.value);
    const bookingId = number($('paymentBooking')?.value) || null;

    if (amount <= 0) throw new Error('أدخل مبلغًا صحيحًا');
    if (!paymentDate) throw new Error('حدد تاريخ الدفع');
    if (!methodId) throw new Error('اختر طريقة الدفع');
    if (!bookingId) throw new Error('اختر الحجز');

    const booking = state.bookings.find((b) => Number(b.id) === bookingId);
    if (!booking) throw new Error('الحجز غير موجود');

    const remaining = bookingRemaining(booking);
    if (amount > remaining) {
      throw new Error(`المبلغ يتجاوز المتبقي (${moneyShort(remaining)} ر.س)`);
    }

    return {
      amount: Number(amount.toFixed(2)),
      bookingId, methodId,
      paymentDate: sqlDateTime(paymentDate),
      notes: $('paymentNotes')?.value.trim() || null
    };
  }

  async function savePayment() {
    if (state.saving) return;
    try {
      const data = validatePayment();
      state.saving = true;
      setSaveButton(true, 'جاري الحفظ...');

      await apiCall(['createCustomerPayment', 'addCustomerPayment'], {
        customer_id: Number(state.customerId),
        booking_id: Number(data.bookingId),
        amount: data.amount,
        payment_method_id: data.methodId,
        payment_date: data.paymentDate,
        notes: data.notes
      });

      toast('تم تسجيل الدفعة', 'success');
      closeModal();
      await loadData();
    } catch (error) {
      console.error('savePayment:', error);
      toast(error?.message || 'تعذر حفظ الدفعة', 'error');
    } finally {
      state.saving = false;
      setSaveButton(false);
    }
  }

  function setSaveButton(saving, text = '') {
    const button = $('transactionSaveBtn');
    if (!button) return;
    button.disabled = saving;
    if (saving) {
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${esc(text)}`;
      return;
    }
    button.textContent = state.mode === 'payment'
      ? 'تسجيل الدفعة'
      : (state.editingBookingId ? 'تحديث الحجز' : 'حفظ الحجز');
  }

  /* =========================================================
   * 14) Modal تغيير الحالة
   * ========================================================= */

  function openStatusModal(bookingId) {
    const booking = state.bookings.find((b) => Number(b.id) === Number(bookingId));
    if (!booking) return;

    state.statusBookingId = booking.id;
    setText('statusModalTitle', `حالة الحجز #${booking.id}`);

    $$('input[name="newStatus"]').forEach((r) => {
      r.checked = r.value === getStatus(booking.status);
    });

    const payBox = $('paymentSectionX');
    if (payBox) payBox.classList.remove('show');

    const methodSelect = $('paymentMethodX');
    if (methodSelect) {
      methodSelect.innerHTML = state.paymentMethods.map((m, i) =>
        `<option value="${esc(m.id)}" ${i === 0 ? 'selected' : ''}>${esc(m.name)}</option>`
      ).join('');
    }

    $$('input[name="newStatus"]').forEach((radio) => {
      radio.onchange = () => onStatusChange(booking);
    });
// ✅ ضمان تفعيل الراديو عند النقر على الـ label
$$('.cv-status-opt').forEach((label) => {
  label.onclick = (e) => {
    e.preventDefault();
    const radio = label.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      onStatusChange(booking);
    }
  };
});
    onStatusChange(booking);
    $('statusModal')?.classList.add('active');
  }

  function onStatusChange(booking) {
    const selectedRadio = document.querySelector('input[name="newStatus"]:checked');
    if (!selectedRadio) return;
    const newStatus = selectedRadio.value;
    const payBox = $('paymentSectionX');
    const amountInput = $('paymentAmountX');
    const hint = $('paymentHintX');

    if (newStatus === 'completed' && bookingRemaining(booking) > 0) {
      if (payBox) payBox.classList.add('show');
      if (amountInput) {
        amountInput.value = bookingRemaining(booking).toFixed(2);
        amountInput.max = bookingRemaining(booking).toFixed(2);
      }
      if (hint) hint.textContent = `سيتم تسجيل دفعة بقيمة ${money(bookingRemaining(booking))} مرتبطة بالحجز #${booking.id}.`;
    } else if (newStatus === 'completed') {
      if (payBox) payBox.classList.add('show');
      if (amountInput) { amountInput.value = '0'; amountInput.max = '0'; }
      if (hint) hint.textContent = 'لا يوجد متبقي على هذا الحجز.';
    } else {
      if (payBox) payBox.classList.remove('show');
    }
  }

  function closeStatusModal() {
    $('statusModal')?.classList.remove('active');
    state.statusBookingId = null;
    state.savingStatus = false;
  }

  async function confirmStatusChange() {
    if (state.savingStatus) return;

    const booking = state.bookings.find((b) => Number(b.id) === Number(state.statusBookingId));
    if (!booking) return;

    const selectedRadio = document.querySelector('input[name="newStatus"]:checked');
    if (!selectedRadio) return;

    const newStatus = selectedRadio.value;
    const oldStatus = getStatus(booking.status);

    if (newStatus === oldStatus && !(newStatus === 'completed' && bookingRemaining(booking) > 0)) {
      toast('لم تتغير الحالة', 'info');
      return;
    }

    const btn = $('confirmStatusBtn');
    state.savingStatus = true;
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

    try {
      /* ✅ 1) جلب الحجز الكامل (يحتوي الأصناف) */
      let fullBooking = booking;
      try {
        const res = await apiCall(['getBooking'], booking.id);
        const fb = res?.data || res;
        if (fb?.id) fullBooking = fb;
      } catch (e) {
        console.warn('getBooking failed, using list data:', e);
      }

      /* ✅ 2) تسجيل دفعة إن كانت "مكتمل" + يوجد متبقي */
      if (newStatus === 'completed' && bookingRemaining(booking) > 0) {
        const amount = number($('paymentAmountX')?.value);
        const methodId = Number($('paymentMethodX')?.value);

        if (amount <= 0) throw new Error('أدخل مبلغًا صحيحًا');
        if (amount > bookingRemaining(booking)) throw new Error('المبلغ يتجاوز المتبقي');
        if (!methodId) throw new Error('اختر طريقة الدفع');

        await apiCall(['createCustomerPayment', 'addCustomerPayment'], {
          customer_id: fullBooking.customer_id ?? state.customerId,
          booking_id: fullBooking.id,
          amount: amount,
          payment_method_id: methodId,
          payment_date: nowSqlDateTime(),
          notes: 'دفعة إكمال الحجز'
        });
      }

      /* ✅ 3) تجهيز الأصناف بصيغة صحيحة */
      const items = (fullBooking.items || []).map((it) => {
        const qty = number(it.quantity);
        const unit = number(it.unit_price ?? it.price);
        const total = number(it.total_price) || qty * unit;
        return {
          item_id: it.item_id ?? null,
          item_name: it.item_name ?? it.name ?? 'صنف',
          quantity: qty,
          unit_price: unit,
          total_price: Number(total.toFixed(2))
        };
      });

      /* ✅ 4) بناء payload بصيغ صحيحة */
      const payload = {
        customer_id: fullBooking.customer_id ?? state.customerId,
        invoice_date: normalizeInvoiceDate(fullBooking.invoice_date),
        event_date: normalizeEventDate(fullBooking.event_date),
        delivery_time: normalizeDeliveryTime(fullBooking.delivery_time),
        delivery_period: fullBooking.delivery_period || 'ظهراً',
        delivery_address: fullBooking.delivery_address || '',
        mark: fullBooking.mark || null,
        total_amount: number(fullBooking.total_amount || bookingTotal(fullBooking)),
        plate_deposit: fullBooking.plate_deposit ?? null,
        notes: fullBooking.notes || null,
        status: newStatus,
        items
      };

      /* ✅ 5) plate_deposit_returned فقط لو له قيمة */
      if (fullBooking.plate_deposit_returned !== null &&
          fullBooking.plate_deposit_returned !== undefined) {
        payload.plate_deposit_returned = number(fullBooking.plate_deposit_returned);
      }

      await apiCall(['updateBooking'], fullBooking.id, payload);

      toast(
        newStatus === 'completed' && bookingRemaining(booking) > 0
          ? 'تم إكمال الحجز وتسجيل الدفعة'
          : 'تم تغيير الحالة',
        'success'
      );

      closeStatusModal();
      await loadData();
    } catch (error) {
      console.error('status change failed:', error);
      toast(error?.message || 'تعذر تحديث الحالة', 'error');
    } finally {
      state.savingStatus = false;
      if (btn) { btn.disabled = false; btn.textContent = 'تأكيد'; }
    }
  }

  /* =========================================================
   * 15) حذف
   * ========================================================= */

  async function deleteBooking(id) {
    const booking = state.bookings.find((b) => Number(b.id) === Number(id));
    if (!booking) return;

    const ok = await confirmAction(
      `سيتم حذف الحجز #${id} وكل الدفعات المرتبطة به. هل تريد المتابعة؟`
    );
    if (!ok) return;

    try {
      await apiCall(['deleteBooking'], Number(id));
      toast('تم حذف الحجز', 'success');
      await loadData();
    } catch (error) {
      toast(error?.message || 'تعذر الحذف', 'error');
    }
  }

  async function deletePayment(id) {
    const p = state.payments.find((x) => Number(x.id) === Number(id));
    if (!p) return;

    const ok = await confirmAction(`حذف دفعة بقيمة ${money(p.amount)}؟`);
    if (!ok) return;

    try {
      await apiCall(['deleteCustomerPayment'], Number(id));
      toast('تم حذف الدفعة', 'success');
      await loadData();
    } catch (error) {
      toast(error?.message || 'تعذر الحذف', 'error');
    }
  }

  /* =========================================================
   * 16) طباعة الحجز → invoice.html
   * ========================================================= */

  async function printBooking(id) {
    try {
      let booking = state.bookings.find((b) => Number(b.id) === Number(id));
      if (!booking) return;

      try {
        const res = await apiCall(['getBooking'], id);
        const fb = res?.data || res;
        if (fb?.id) booking = fb;
      } catch (e) { console.warn('getBooking failed:', e); }

      let restaurant = { name: 'شواطئ عدن', subtitle: 'مطابخ ومطاعم', phone: '', delivery: '', address: '', social: '', logo: '' };
      try {
        const r = await apiCall(['getRestaurant']);
        const rr = r?.data || r || {};
        restaurant = {
          name: rr.name || restaurant.name,
          subtitle: rr.description || restaurant.subtitle,
          phone: rr.phone || '',
          delivery: rr.whatsapp || rr.phone || '',
          address: rr.address || '',
          social: rr.instagram || rr.facebook || '',
          logo: rr.logo || ''
        };
      } catch (e) { console.warn('restaurant failed:', e); }

      const API_BASE = window.API?.BASE_URL || 'http://127.0.0.1:8000/api';
      const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');
      const STORAGE_BASE = SERVER_BASE + '/storage/';
      const buildLogo = (logo) => {
        if (!logo) return '';
        if (/^https?:\/\//i.test(logo)) return logo;
        if (String(logo).startsWith('data:')) return logo;
        return STORAGE_BASE + String(logo).replace(/^\/+/, '');
      };

      const timeInfo = (() => {
        const v = booking.delivery_time;
        if (!v) return { time: '', period: '' };
        const m = String(v).match(/^(\d{1,2}):(\d{2})/);
        if (!m) return { time: String(v), period: '' };
        let h = Number(m[1]);
        const mm = m[2];
        const period = h >= 12 ? 'مساءً' : 'صباحاً';
        h = h % 12 || 12;
        return { time: `${h}:${mm}`, period };
      })();

      const items = (booking.items || []).map((it) => ({
        name: it.item_name || it.name || 'صنف',
        qty: number(it.quantity) || 1,
        price: number(it.unit_price ?? it.price),
        total: number(it.total_price) || number(it.quantity) * number(it.unit_price ?? it.price)
      }));

      let paid = 0;
      if (Array.isArray(booking.payments) && booking.payments.length) {
        paid = booking.payments.reduce((s, p) => s + number(p.amount), 0);
      } else {
        paid = bookingPaid(booking.id);
      }

      const totalAmount = number(booking.total_amount || bookingTotal(booking));
      const remaining = Math.max(0, totalAmount - paid);

      const paymentMethod = (() => {
        const p1 = Array.isArray(booking.payments) ? booking.payments[0] : null;
        if (!p1) return 'نقدي';
        if (p1.payment_method?.name) return p1.payment_method.name;
        return paymentMethodName(p1);
      })();

      const invoiceData = {
        id: booking.id,
        status: getStatus(booking.status),
        customer: {
          name: booking.customer?.name || booking.customer_name || '',
          phone: booking.customer?.phone || booking.customer_phone || '',
          location: booking.delivery_address || ''
        },
        booking: {
          date: formatDateDisplay(booking.event_date),
          time: timeInfo.time,
          day: getArabicDay(booking.event_date),
          mark: booking.mark || '',
          deliveryTime: booking.delivery_period || timeInfo.period || 'ظهراً'
        },
        paymentMethod,
        items,
        total: totalAmount,
        deposit: paid,
        remaining,
        platesDeposit: number(booking.plate_deposit || 0),
        notes: booking.notes || '',
        restaurant: { ...restaurant, logo: buildLogo(restaurant.logo) }
      };

      localStorage.setItem('preview_invoice_data', JSON.stringify(invoiceData));
      window.location.href = 'invoice.html';
    } catch (error) {
      console.error('printBooking failed:', error);
      toast('تعذر فتح الفاتورة', 'error');
    }
  }

  /* =========================================================
   * 17) طباعة كشف الحساب
   * ========================================================= */

  function printStatement() {
    const rows = computeStatementRows();
    const detailed = state.statementView === 'detailed';

    let balance = 0;
    const body = rows.map((row) => {
      balance += row.debit - row.credit;

      let detailHtml = '';
      if (detailed && row.type === 'booking' && row.booking) {
        const items = Array.isArray(row.booking.items) ? row.booking.items : [];
        if (items.length) {
          detailHtml = `
            <tr style="background:#f9fafb;">
              <td colspan="5" style="padding:8px 12px;">
                <table style="width:100%;border-collapse:collapse;font-size:11px;">
                  <thead>
                    <tr style="background:#f3f4f6;">
                      <th style="border:1px solid #ddd;padding:4px;text-align:right;">الصنف</th>
                      <th style="border:1px solid #ddd;padding:4px;text-align:center;">الكمية</th>
                      <th style="border:1px solid #ddd;padding:4px;text-align:center;">السعر</th>
                      <th style="border:1px solid #ddd;padding:4px;text-align:center;">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((it) => `
                      <tr>
                        <td style="border:1px solid #ddd;padding:4px;">${esc(it.item_name ?? it.name ?? '')}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:center;">${number(it.quantity)}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:center;">${money(it.unit_price ?? it.price)}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:center;">${money(it.total_price ?? (number(it.quantity) * number(it.unit_price ?? it.price)))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </td>
            </tr>`;
        }
      }

      return `
        <tr>
          <td>${esc(dateOnly(row.date))}</td>
          <td>${esc(row.description)}</td>
          <td>${row.debit ? money(row.debit) : '—'}</td>
          <td>${row.credit ? money(row.credit) : '—'}</td>
          <td>${money(balance)}</td>
        </tr>
        ${detailHtml}
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب - ${esc(state.customer?.name || '')}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#222}
          h1{font-size:20px}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:13px}
          th{background:#f5f5f5}
        </style>
      </head>
      <body>
        <h1>كشف حساب ${detailed ? 'تفصيلي' : ''} - ${esc(state.customer?.name || '')}</h1>
        <div>الجوال: ${esc(state.customer?.phone || '—')}</div>
        <div>التاريخ: ${todayString()}</div>
        <table>
          <thead>
            <tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (!win) { toast('تعذر فتح نافذة الطباعة', 'error'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  /* =========================================================
   * 18) الأحداث
   * ========================================================= */

  function bindContainer() {
    const container = $('customerViewContent');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);

      switch (action) {
        case 'newBooking': openBookingModal(); break;
        case 'newPayment': openPaymentModal(); break;
        case 'editBooking': {
          const booking = state.bookings.find((b) => Number(b.id) === id);
          if (booking) openBookingModal(booking);
          break;
        }
        case 'changeStatus': openStatusModal(id); break;
        case 'payRemaining': openStatusModal(id); break;
        case 'printBooking': printBooking(id); break;
        case 'deleteBooking': deleteBooking(id); break;
        case 'deletePayment': deletePayment(id); break;
        case 'printStatement': printStatement(); break;
        case 'gotoBooking': {
          e.preventDefault();
          const tab = document.querySelector('#profileTabs .cv-tab[data-tab="bookings"]');
          if (tab) tab.click();
          break;
        }
        default: break;
      }
    });
  }

  function bindModal() {
    $$('.switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    $('transactionSaveBtn')?.addEventListener('click', () => {
      if (state.mode === 'booking') saveBooking();
      else savePayment();
    });

    $('addBookingItemBtn')?.addEventListener('click', () => {
      $('bookingItemsContainer')?.insertAdjacentHTML('beforeend', renderNewItemRow());
      updateBookingPreview();
    });

    $('bookingItemsContainer')?.addEventListener('change', (e) => {
      if (e.target.matches('.item-select')) {
        const row = e.target.closest('.item-row');
        const price = row?.querySelector('.item-price');
        const sel = e.target.options[e.target.selectedIndex];
        if (price && !price.dataset.manual && sel) {
          price.value = sel.dataset.price || '';
        }
        updateBookingPreview();
      }
    });

    $('bookingItemsContainer')?.addEventListener('input', (e) => {
      if (e.target.matches('.item-price')) e.target.dataset.manual = 'true';
      if (e.target.matches('.item-qty,.item-price')) updateBookingPreview();
    });

    $('bookingItemsContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-item-btn');
      if (!btn) return;
      const row = btn.closest('.item-row');
      if (!row) return;
      const box = $('bookingItemsContainer');
      const rows = box.querySelectorAll('.item-row');
      if (rows.length > 1) {
        row.remove();
      } else {
        row.querySelectorAll('input').forEach((i) => i.value = '');
        const sel = row.querySelector('select');
        if (sel) sel.value = '';
      }
      updateBookingPreview();
    });

    ['bookingPlateDeposit', 'bookingInitialPayment'].forEach((id) => {
      $(id)?.addEventListener('input', updateBookingPreview);
    });

    $('paymentAmount')?.addEventListener('input', updatePaymentPreview);
    $('paymentBooking')?.addEventListener('change', updatePaymentPreview);

    $$('[data-close="transactionModal"]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });

    $$('[data-close="statusModal"]').forEach((btn) => {
      btn.addEventListener('click', closeStatusModal);
    });
    $('confirmStatusBtn')?.addEventListener('click', confirmStatusChange);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ($('transactionModal')?.classList.contains('active')) closeModal();
        if ($('statusModal')?.classList.contains('active')) closeStatusModal();
      }
    });
  }

  function bindFab() {
    $('fab')?.addEventListener('click', () => {
      if (state.customer) openBookingModal();
    });
  }

  /* =========================================================
   * 19) التهيئة
   * ========================================================= */

  function init() {
    const params = new URLSearchParams(window.location.search);
    state.customerId = Number(params.get('id')) || 0;

    bindContainer();
    bindModal();
    bindFab();

    if (!state.customerId) {
      renderFailure('معرف العميل غير صحيح', 'افتح الصفحة من قائمة العملاء');
      return;
    }

    loadData();
  }

  window.setTransactionMode = setMode;
  window.openBookingModal = openBookingModal;
  window.openPaymentModal = openPaymentModal;
  window.closeModal = closeModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();