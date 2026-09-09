(() => {
  'use strict';

  /*
   * customer-view.js
   * صفحة تفاصيل العميل:
   * - الحجوزات الخاصة بالعميل
   * - المدفوعات الخاصة بالعميل
   * - كشف الحساب
   *
   * ملاحظات مهمة:
   * 1) لا توجد قائمة فواتير مستقلة؛ كل فاتورة هي فاتورة حجزها.
   * 2) لا يوجد حقل "المرتجع من التأمين" في نموذج الحجز.
   * 3) الدفعة الأولى تُرسل مع إنشاء الحجز ليقوم الـ API بربطها بالحجز الجديد.
   * 4) الدفعات المسجلة يدويًا يمكن ربطها بحجز محدد.
   */

  const state = {
    customerId: 0,
    customer: null,
    bookings: [],
    payments: [],
    paymentMethods: [],
    items: [],
    account: null,
    statement: null,
    mode: 'booking',
    editingBookingId: null,
    saving: false,
    loading: false
  };

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch]));
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const amount = number(value);
    if (window.API && typeof window.API.formatCurrency === 'function') {
      return window.API.formatCurrency(amount);
    }
    return amount.toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ر.س';
  }

  function dateOnly(value) {
    return value ? String(value).slice(0, 10) : '';
  }

  function dateTimeLocalNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate())
    ].join('-') + 'T' + [
      pad(d.getHours()),
      pad(d.getMinutes())
    ].join(':');
  }

  function sqlDateTime(value) {
    if (!value) return null;
    return String(value).replace('T', ' ').slice(0, 19);
  }

  function unwrap(value) {
    if (value && typeof value === 'object' &&
        Object.prototype.hasOwnProperty.call(value, 'data')) {
      return value.data;
    }
    return value;
  }

  function arrayData(value) {
    const data = unwrap(value);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

  async function apiCall(names, ...args) {
    const api = window.API;
    if (!api) throw new Error('واجهة API لم تُحمّل بعد.');

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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.API) throw new Error('تعذر تحميل واجهة API.');
  }

  function toast(message, type = 'info') {
    if (window.Layout && typeof window.Layout.showToast === 'function') {
      window.Layout.showToast(message, type);
      return;
    }
    if (type === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  async function confirmAction(message) {
    if (window.Layout && typeof window.Layout.showConfirm === 'function') {
      return new Promise((resolve) => {
        let finished = false;
        const done = (value) => {
          if (finished) return;
          finished = true;
          resolve(Boolean(value));
        };

        try {
          window.Layout.showConfirm({
            title: 'تأكيد العملية',
            message,
            confirmText: 'تأكيد',
            cancelText: 'إلغاء',
            danger: true,
            onConfirm: () => done(true),
            onCancel: () => done(false)
          });
        } catch (error) {
          console.warn('showConfirm failed:', error);
          done(window.confirm(message));
        }
      });
    }
    return window.confirm(message);
  }

  function initials(name) {
    const chars = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2);
    return chars || 'ع';
  }

  function statusText(status) {
    return ({
      new: 'جديد',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      cancelled: 'ملغي'
    })[status] || status || 'جديد';
  }

  function statusClass(status) {
    return ({
      new: 'badge-status badge-new',
      confirmed: 'badge-status badge-confirmed',
      completed: 'badge-status badge-completed',
      cancelled: 'badge-status badge-cancelled'
    })[status] || 'badge-status';
  }

  function accountData() {
    const source = unwrap(state.account) || state.customer?.account || {};

    const totalInvoices = number(
      source.total_invoices ??
      source.totalInvoices ??
      source.invoices_total ??
      source.invoicesTotal
    );

    const totalPaid = number(
      source.total_paid ??
      source.totalPaid ??
      source.payments_total ??
      source.paymentsTotal
    );

    let balance = number(
      source.balance ??
      source.total_remaining ??
      source.totalRemaining ??
      source.remaining ??
      source.amount_due
    );

    if (!balance && (totalInvoices || totalPaid)) {
      balance = Math.max(0, totalInvoices - totalPaid);
    }

    return {
      totalInvoices,
      totalPaid,
      balance,
      balanceType: source.balance_type ?? source.balanceType ?? ''
    };
  }

  function bookingPaid(bookingId) {
    return state.payments
      .filter((payment) => Number(
        payment.booking_id ?? payment.bookingId
      ) === Number(bookingId))
      .reduce((sum, payment) => sum + number(payment.amount), 0);
  }

  function bookingTotal(booking) {
    return number(
      booking.total_amount ??
      booking.totalAmount ??
      booking.total ??
      booking.grand_total
    );
  }

  function bookingRemaining(booking) {
    return Math.max(0, bookingTotal(booking) - bookingPaid(booking.id));
  }

  function paymentMethodName(payment) {
    const relation = payment.payment_method ?? payment.paymentMethod;
    if (relation && typeof relation === 'object' && relation.name) {
      return relation.name;
    }

    const methodId = payment.payment_method_id ?? payment.paymentMethodId;
    const found = state.paymentMethods.find(
      (method) => Number(method.id) === Number(methodId)
    );

    return found?.name || 'غير محددة';
  }

  function renderFailure(title, message) {
    const container = $('customerViewContent');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-slash"></i>
        <h4>${esc(title)}</h4>
        <p>${esc(message)}</p>
        <button type="button" class="btn btn-primary" data-action="backCustomers">
          العودة إلى العملاء
        </button>
      </div>`;
  }

  function renderProfile() {
    const container = $('customerViewContent');
    if (!container || !state.customer) return;

    const c = state.customer;
    const a = accountData();
    const balance = Math.max(0, a.balance);

    container.innerHTML = `
      <section class="customer-profile-header">
        <div class="avatar">${esc(initials(c.name))}</div>

        <div class="info">
          <div class="name">${esc(c.name || 'بدون اسم')}</div>
          <div class="phone">${esc(c.phone || '—')}</div>
          ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
        </div>

        <div class="status-badge">
          <span class="badge ${
            c.is_active === false
              ? 'badge-danger'
              : balance > 0
                ? 'badge-danger'
                : 'badge-success'
          }">
            ${
              c.is_active === false
                ? 'غير نشط'
                : balance > 0
                  ? `متبقي ${money(balance)}`
                  : 'مسدد'
            }
          </span>
        </div>
      </section>

      <section class="profile-summary">
        <div class="stat">
          <span class="label">إجمالي الحجوزات</span>
          <span class="value">${state.bookings.length}</span>
        </div>
        <div class="stat">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">${money(a.totalPaid)}</span>
        </div>
        <div class="stat">
          <span class="label">الرصيد المستحق</span>
          <span class="value ${balance > 0 ? 'danger' : 'success'}">${money(balance)}</span>
        </div>
      </section>

      <div class="tabs" id="profileTabs" role="tablist">
        <button type="button" class="tab active" data-tab="bookings" role="tab" aria-selected="true">
          الحجوزات
        </button>
        <button type="button" class="tab" data-tab="payments" role="tab" aria-selected="false">
          المدفوعات
        </button>
        <button type="button" class="tab" data-tab="statement" role="tab" aria-selected="false">
          كشف الحساب
        </button>
      </div>

      <section class="tab-content active" id="tab-bookings" role="tabpanel">
        <div style="display:flex;justify-content:flex-start;margin-bottom:12px;">
          <button type="button" class="btn btn-primary" data-action="newBooking">
            <i class="fas fa-calendar-plus"></i>
            إضافة حجز
          </button>
        </div>
        <div id="bookingsList">${renderBookingsHtml()}</div>
      </section>

      <section class="tab-content" id="tab-payments" role="tabpanel">
        <div style="display:flex;justify-content:flex-start;margin-bottom:12px;">
          <button type="button" class="btn btn-primary" data-action="newPayment">
            <i class="fas fa-money-bill-wave"></i>
            تسجيل دفعة
          </button>
        </div>
        <div id="paymentsList">${renderPaymentsHtml()}</div>
      </section>

      <section class="tab-content" id="tab-statement" role="tabpanel">
        <div id="statementList">${renderStatementHtml()}</div>
      </section>
    `;

    bindProfileTabs();
  }

  function renderBookingsHtml() {
    if (!state.bookings.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-calendar-xmark"></i>
          <h4>لا توجد حجوزات</h4>
          <p>لا توجد حجوزات مسجلة لهذا العميل.</p>
        </div>`;
    }

    return [...state.bookings]
      .sort((a, b) =>
        new Date(b.event_date || b.invoice_date || 0) -
        new Date(a.event_date || a.invoice_date || 0)
      )
      .map((booking) => {
        const paid = bookingPaid(booking.id);
        const total = bookingTotal(booking);
        const remaining = Math.max(0, total - paid);
        const deposit = number(booking.plate_deposit);

        return `
          <article class="booking-item" data-id="${Number(booking.id)}">
            <div class="info">
              <div class="title">
                حجز #${esc(booking.id)}
                ${booking.mark ? ` · ${esc(booking.mark)}` : ''}
              </div>

              <div class="sub invoice-meta">
                <span>
                  <i class="fas fa-calendar"></i>
                  ${esc(dateOnly(booking.event_date) || '—')}
                </span>
                <span>
                  <i class="fas fa-clock"></i>
                  ${esc(String(booking.delivery_time || '').slice(0, 5) || '—')}
                </span>
                <span>${esc(booking.delivery_period || '—')}</span>
                <span class="${statusClass(booking.status)}">
                  ${esc(statusText(booking.status))}
                </span>
              </div>

              <div class="sub">
                <i class="fas fa-location-dot"></i>
                ${esc(booking.delivery_address || '—')}
                ${deposit > 0 ? ` · تأمين الصحون: ${money(deposit)}` : ''}
              </div>

              ${booking.notes ? `<div class="sub">${esc(booking.notes)}</div>` : ''}

              <div class="actions">
                <button type="button" class="btn-icon-sm btn-icon-primary" data-action="editBooking" title="تعديل">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn-icon-sm" data-action="printBooking" title="طباعة">
                  <i class="fas fa-print"></i>
                </button>
                <button type="button" class="btn-icon-sm btn-icon-danger" data-action="deleteBooking" title="حذف">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="amount-section">
              <span class="total">${money(total)}</span>
              <span class="paid">مدفوع ${money(paid)}</span>
              ${
                remaining > 0
                  ? `<span class="remaining">متبقي ${money(remaining)}</span>`
                  : `<span class="paid">مسدد</span>`
              }
            </div>
          </article>`;
      }).join('');
  }

  function renderPaymentsHtml() {
    if (!state.payments.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-money-bill-transfer"></i>
          <h4>لا توجد مدفوعات</h4>
          <p>لا توجد مدفوعات مسجلة لهذا العميل.</p>
        </div>`;
    }

    return [...state.payments]
      .sort((a, b) =>
        new Date(b.payment_date || 0) -
        new Date(a.payment_date || 0)
      )
      .map((payment) => {
        const bookingId = payment.booking_id ?? payment.bookingId;

        return `
          <article class="payment-item" data-id="${Number(payment.id)}">
            <div class="info">
              <div class="title">
                دفعة #${esc(payment.id)}
                · ${esc(paymentMethodName(payment))}
              </div>

              <div class="sub">
                ${esc(dateOnly(payment.payment_date || payment.paymentDate) || '—')}
                · ${
                  bookingId
                    ? `مرتبطة بالحجز #${esc(bookingId)}`
                    : 'دفعة عامة'
                }
              </div>

              ${payment.notes ? `<div class="sub">${esc(payment.notes)}</div>` : ''}

              <div class="actions">
                <button type="button" class="btn-icon-sm btn-icon-danger" data-action="deletePayment" title="حذف">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="amount">+${money(payment.amount)}</div>
          </article>`;
      }).join('');
  }

  function statementRows() {
    const source = unwrap(state.statement);

    if (Array.isArray(source?.transactions)) {
      return source.transactions.map((row) => ({
        date: row.date ?? row.transaction_date ?? row.created_at ?? '',
        description: row.description ?? row.reference ?? row.notes ?? row.type ?? '',
        debit: number(row.debit ?? row.amount_debit),
        credit: number(row.credit ?? row.amount_credit)
      }));
    }

    const rows = [];

    state.bookings.forEach((booking) => {
      rows.push({
        date: booking.invoice_date || booking.event_date || '',
        description: `حجز #${booking.id}${booking.mark ? ` - ${booking.mark}` : ''}`,
        debit: bookingTotal(booking),
        credit: 0
      });
    });

    state.payments.forEach((payment) => {
      const bookingId = payment.booking_id ?? payment.bookingId;
      rows.push({
        date: payment.payment_date || '',
        description: bookingId
          ? `دفعة للحجز #${bookingId}`
          : 'دفعة عامة',
        debit: 0,
        credit: number(payment.amount)
      });
    });

    return rows.sort((a, b) =>
      new Date(a.date || 0) - new Date(b.date || 0)
    );
  }

  function renderStatementHtml() {
    const rows = statementRows();

    if (!rows.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-receipt"></i>
          <h4>لا يوجد كشف حساب</h4>
          <p>ستظهر حركات الحساب هنا.</p>
        </div>`;
    }

    let balance = 0;

    const content = rows.map((row) => {
      balance += row.debit - row.credit;

      return `
        <div class="statement-item">
          <div class="desc">
            <span style="font-weight:600;">${esc(row.description)}</span>
            <span class="date">${esc(dateOnly(row.date) || '—')}</span>
          </div>
          <span class="${row.debit ? 'debit' : 'credit'}">
            ${money(row.debit || row.credit)}
          </span>
          <span class="balance">${money(balance)}</span>
        </div>`;
    }).join('');

    return `
      <div style="display:flex;justify-content:flex-start;margin-bottom:12px;">
        <button type="button" class="btn btn-secondary" data-action="printStatement">
          <i class="fas fa-print"></i>
          طباعة كشف الحساب
        </button>
      </div>
      ${content}`;
  }

  function bindProfileTabs() {
    document.querySelectorAll('#profileTabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        document.querySelectorAll('#profileTabs .tab').forEach((item) => {
          const active = item === tab;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('#customerViewContent .tab-content').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `tab-${target}`);
        });
      });
    });
  }

  async function loadData() {
    if (state.loading) return;

    state.loading = true;

    try {
      await waitForApi();

      const customer = await apiCall(['getCustomer'], state.customerId);

      if (!customer) {
        renderFailure('العميل غير موجود', 'لم يتم العثور على العميل.');
        return;
      }

      state.customer = customer;

      const results = await Promise.allSettled([
        apiCall(['getBookings'], { customer_id: state.customerId }),
        apiCall(['getCustomerPayments'], { customer_id: state.customerId }),
        apiCall(['getCustomerAccount'], state.customerId),
        apiCall(['getCustomerStatement'], state.customerId),
        apiCall(['getPaymentMethods']),
        apiCall(['getItems'])
      ]);

      const value = (index) =>
        results[index].status === 'fulfilled'
          ? results[index].value
          : null;

      const bookings = value(0);
      const payments = value(1);
      const account = value(2);
      const statement = value(3);
      const methods = value(4);
      const items = value(5);

      state.bookings = arrayData(bookings);
      state.payments = arrayData(payments);
      state.paymentMethods = arrayData(methods);
      state.items = arrayData(items);
      state.account = account || state.customer.account || null;
      state.statement = statement || state.customer.statement || null;

      renderProfile();
    } catch (error) {
      console.error('customer-view loadData:', error);
      renderFailure(
        'فشل تحميل بيانات العميل',
        error?.message || 'تعذر الاتصال بالخادم.'
      );
      toast(error?.message || 'فشل تحميل بيانات العميل.', 'error');
    } finally {
      state.loading = false;
    }
  }

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

    document.querySelectorAll('.switch-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === state.mode);
    });

    const bookingMode = $('bookingMode');
    const paymentMode = $('paymentMode');
    const title = $('transactionModalTitle');
    const save = $('transactionSaveBtn');

    if (bookingMode) {
      bookingMode.style.display = state.mode === 'booking' ? 'block' : 'none';
    }

    if (paymentMode) {
      paymentMode.style.display = state.mode === 'payment' ? 'block' : 'none';
    }

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
    const element = $(id);
    if (element) element.value = value ?? '';
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? '—';
  }

  function fillPaymentMethods(selectedId = '') {
    const bookingSelect = $('bookingPaymentMethod');
    const paymentBox = $('paymentMethodsContainer');

    const methods = state.paymentMethods.filter(
      (method) => method.is_active !== false
    );

    if (bookingSelect) {
      bookingSelect.innerHTML =
        '<option value="">اختر طريقة الدفع</option>' +
        methods.map((method) =>
          `<option value="${esc(method.id)}">${esc(method.name)}</option>`
        ).join('');

      if (selectedId !== '') {
        bookingSelect.value = String(selectedId);
      }
    }

    if (paymentBox) {
      if (!methods.length) {
        paymentBox.innerHTML = '<span class="status-badge">لا توجد طرق دفع متاحة</span>';
        return;
      }

      paymentBox.innerHTML = methods.map((method, index) => `
        <label class="payment-method-option">
          <input
            type="radio"
            name="customerPaymentMethod"
            value="${esc(method.id)}"
            ${Number(selectedId) === Number(method.id) || (!selectedId && index === 0) ? 'checked' : ''}
          >
          <i class="fas fa-credit-card"></i>
          ${esc(method.name)}
        </label>
      `).join('');
    }
  }

  function fillPaymentBookings(selectedId = '') {
    const select = $('paymentBooking');
    if (!select) return;

    const openBookings = state.bookings.filter(
      (booking) => bookingRemaining(booking) > 0
    );

    select.innerHTML =
      '<option value="">اختر الحجز المرتبط بالدفعة</option>' +
      openBookings.map((booking) => `
        <option value="${esc(booking.id)}">
          حجز #${esc(booking.id)}
          · ${esc(dateOnly(booking.event_date) || booking.mark || '—')}
          · متبقي ${esc(money(bookingRemaining(booking)))}
        </option>
      `).join('');

    select.value = selectedId ? String(selectedId) : '';
  }

  function itemId(item) {
    return item.item_id ?? item.itemId ?? item.id;
  }

  function itemName(item) {
    return item.name ?? item.item_name ?? item.itemName ?? '';
  }

function itemPrice(item) {
  return number(
    item.default_price ??
    item.defaultPrice ??
    item.price ??
    item.unit_price ??
    item.unitPrice
  );
}

function renderNewItemRow(data = {}) {
  const selectedId = data.item_id ?? data.itemId ?? '';
  const quantity = number(data.quantity) || 1;
  const price = number(data.unit_price ?? data.unitPrice ?? data.price);

  const options = state.items.map((item) => `
    <option
      value="${esc(itemId(item))}"
      data-name="${esc(itemName(item))}"
      data-price="${esc(itemPrice(item))}"
      ${Number(selectedId) === Number(itemId(item)) ? 'selected' : ''}
    >
      ${esc(itemName(item))} · ${esc(money(itemPrice(item)))}
    </option>
  `).join('');

  return `
    <div class="item-row">
      <select class="form-input item-select">
        <option value="">اختر الصنف</option>
        ${options}
      </select>

      <input
        type="number"
        class="form-input item-qty"
        min="1"
        step="1"
        value="${esc(quantity)}"
        placeholder="الكمية"
      >

      <input
        type="number"
        class="form-input item-price"
        min="0"
        step="0.01"
        value="${esc(price || '')}"
        placeholder="السعر"
      >

      <button
        type="button"
        class="btn-icon-sm btn-icon-danger remove-item-btn"
        title="حذف الصنف"
      >
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
      updateBookingPreview();
      return;
    }

    box.innerHTML = source.map((item) => renderNewItemRow(item)).join('');
    document.querySelectorAll('#bookingItemsContainer .item-row').forEach(updateItemRow);
    updateBookingPreview();
  }

  function updateItemRow(row) {
    if (!row) return;

    const select = row.querySelector('.item-select');
    const price = row.querySelector('.item-price');
    const qty = number(row.querySelector('.item-qty')?.value) || 0;
    const selected = select?.options[select.selectedIndex];

    if (selected && selected.value && !price?.dataset.manual) {
      if (price) price.value = itemPrice({
        price: selected.dataset.price
      }) || '';
    }

    const unitPrice = number(price?.value);
    const total = qty * unitPrice;
    const totalBox = row.querySelector('.item-total');

    if (totalBox) totalBox.textContent = money(total);
  }

  function collectBookingItems() {
    return [...document.querySelectorAll('#bookingItemsContainer .item-row')]
      .map((row) => {
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
      })
      .filter((item) =>
        item.item_name &&
        item.quantity > 0 &&
        item.unit_price >= 0
      );
  }

  function updateBookingPreview() {
    document.querySelectorAll('#bookingItemsContainer .item-row')
      .forEach(updateItemRow);

    const items = collectBookingItems();
    const total = items.reduce((sum, item) => sum + number(item.total_price), 0);
    const deposit = number($('bookingPlateDeposit')?.value);
    const initialPayment = number($('bookingInitialPayment')?.value);

    setText('bookingItemsTotal', money(total));
    setText('bookingPlateDisplay', money(deposit));
    setText('bookingGrandTotal', money(total));

    const remaining = Math.max(0, total - initialPayment);
    setText(
      'bookingRemainingPreview',
      `المتبقي بعد الدفعة: ${money(remaining)}`
    );
  }

  function resetBookingForm(booking = null) {
    state.editingBookingId = booking ? Number(booking.id) : null;

    setText('bookingCustomerName', state.customer?.name || '—');
    setText('bookingCustomerPhone', state.customer?.phone || '—');

    setField('bookingEventDate', dateOnly(booking?.event_date));
    setField(
      'bookingDeliveryTime',
      String(booking?.delivery_time || '').slice(0, 5)
    );
    setField('bookingDeliveryPeriod', booking?.delivery_period || 'ظهراً');
    setField('bookingAddress', booking?.delivery_address || '');
    setField('bookingMark', booking?.mark || '');
    setField('bookingPlateDeposit', booking ? booking.plate_deposit : '');
    setField('bookingStatus', booking?.status || 'new');
    setField('bookingNotes', booking?.notes || '');

    // عند تعديل حجز لا نضيف دفعة أولية جديدة.
    setField('bookingInitialPayment', '');

    fillPaymentMethods();
    renderBookingItems(booking?.items || []);
    updateBookingPreview();
    setMode('booking');
  }

  function openBookingModal(booking = null) {
    if (!state.customer) {
      toast('لم يتم تحميل بيانات العميل بعد.', 'error');
      return;
    }

    resetBookingForm(booking);
    openModal();
  }

  function openPaymentModal(preselectedBookingId = '') {
    if (!state.customer) {
      toast('لم يتم تحميل بيانات العميل بعد.', 'error');
      return;
    }

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
    const bookingId = Number($('paymentBooking')?.value) || 0;
    const selectedBooking = state.bookings.find(
      (booking) => Number(booking.id) === bookingId
    );

    const current = selectedBooking
      ? bookingRemaining(selectedBooking)
      : Math.max(0, accountData().balance);

    const amount = number($('paymentAmount')?.value);
    const after = Math.max(0, current - amount);

    setText('paymentCurrentBalance', money(current));
    setText('paymentAfterBalance', money(after));
  }

  function validateBooking() {
    const eventDate = $('bookingEventDate')?.value;
    const deliveryTime = $('bookingDeliveryTime')?.value;
    const deliveryPeriod = $('bookingDeliveryPeriod')?.value;
    const address = $('bookingAddress')?.value.trim();
    const deposit = number($('bookingPlateDeposit')?.value);
    const initialPayment = number($('bookingInitialPayment')?.value);
    const items = collectBookingItems();
    const total = items.reduce(
      (sum, item) => sum + number(item.total_price),
      0
    );

    if (!eventDate) throw new Error('تاريخ المناسبة مطلوب.');
    if (!deliveryTime) throw new Error('وقت التسليم مطلوب.');
    if (!deliveryPeriod) throw new Error('فترة التسليم مطلوبة.');
    if (!address) throw new Error('عنوان التوصيل مطلوب.');
    if (!items.length) throw new Error('أضف صنفًا واحدًا على الأقل.');
    if (deposit < 0) throw new Error('تأمين الصحون غير صحيح.');
    if (initialPayment < 0) throw new Error('الدفعة الأولى غير صحيحة.');
    if (initialPayment > total) {
      throw new Error('الدفعة الأولى لا يمكن أن تتجاوز إجمالي الحجز.');
    }

    return {
      eventDate,
      deliveryTime,
      deliveryPeriod,
      address,
      deposit,
      initialPayment,
      items,
      total: Number(total.toFixed(2))
    };
  }

  function bookingPayload(data) {
    const payload = {
      customer_id: Number(state.customerId),
      invoice_date: sqlDateTime(new Date().toISOString()),
      event_date: data.eventDate,
      delivery_time: data.deliveryTime,
      delivery_period: data.deliveryPeriod,
      delivery_address: data.address,
      mark: $('bookingMark')?.value.trim() || null,
      total_amount: data.total,
      plate_deposit: data.deposit || null,
      status: state.editingBookingId
        ? (
          state.bookings.find(
            (booking) => Number(booking.id) === Number(state.editingBookingId)
          )?.status || 'new'
        )
        : 'new',
      notes: $('bookingNotes')?.value.trim() || null,
      items: data.items
    };

    /*
     * مهم:
     * لا نرسل plate_deposit_returned إطلاقًا.
     * المرتجع يُسجل لاحقًا عند عملية إرجاع الصحون.
     */
    if (!state.editingBookingId && data.initialPayment > 0) {
      const methodId = number($('bookingPaymentMethod')?.value);
      if (!methodId) {
        throw new Error('اختر طريقة الدفع للدفعة الأولى.');
      }

      payload.initial_payment = data.initialPayment;
      payload.payment_method_id = methodId;
      payload.payment_date = sqlDateTime(dateTimeLocalNow());
      payload.payment_notes = $('bookingNotes')?.value.trim() || null;

      /*
       * إذا كان الـ API يدعم اسم الحقل التالي، يمكنه استخدامه لضمان
       * إنشاء payment.booking_id = booking.id بعد إنشاء الحجز.
       * لا نضع رقمًا قبل إنشاء الحجز لأنه غير موجود بعد.
       */
    }

    return payload;
  }

  async function saveBooking() {
    if (state.saving) return;

    try {
      const data = validateBooking();
      const payload = bookingPayload(data);

      state.saving = true;
      setSaveButton(true, state.editingBookingId
        ? 'جاري تحديث الحجز...'
        : 'جاري حفظ الحجز...'
      );

      if (state.editingBookingId) {
        await apiCall(
          ['updateBooking'],
          Number(state.editingBookingId),
          payload
        );

        toast('تم تحديث الحجز بنجاح.', 'success');
      } else {
        const result = await apiCall(
          ['addBooking', 'createBooking'],
          payload
        );

        /*
         * لا ننشئ دفعة ثانية هنا.
         * عند إنشاء الحجز، الـ API هو المسؤول عن إنشاء الدفعة الأولية
         * وربطها بالـ booking_id للحجز الجديد ضمن نفس العملية.
         */
        void result;

        toast('تم إضافة الحجز بنجاح.', 'success');
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('saveBooking:', error);
      toast(error?.message || 'تعذر حفظ الحجز.', 'error');
    } finally {
      state.saving = false;
      setSaveButton(false);
    }
  }

  function validatePayment() {
    const amount = number($('paymentAmount')?.value);
    const paymentDate = $('paymentDate')?.value;
    const methodId = number(
      document.querySelector(
        'input[name="customerPaymentMethod"]:checked'
      )?.value
    );
    const bookingId = number($('paymentBooking')?.value) || null;

    if (amount <= 0) throw new Error('أدخل مبلغًا صحيحًا.');
    if (!paymentDate) throw new Error('حدد تاريخ ووقت الدفع.');
    if (!methodId) throw new Error('اختر طريقة الدفع.');
    if (!bookingId) throw new Error('اختر الحجز الذي تخصه الدفعة.');

    const booking = state.bookings.find(
      (item) => Number(item.id) === bookingId
    );

    if (!booking) {
      throw new Error('الحجز المحدد غير موجود.');
    }

    const remaining = bookingRemaining(booking);

    if (amount > remaining) {
      throw new Error(
        `المبلغ يتجاوز المتبقي على الحجز (${money(remaining)}).`
      );
    }

    return {
      amount: Number(amount.toFixed(2)),
      bookingId,
      methodId,
      paymentDate: sqlDateTime(paymentDate),
      notes: $('paymentNotes')?.value.trim() || null
    };
  }

  async function savePayment() {
    if (state.saving) return;

    try {
      const data = validatePayment();

      state.saving = true;
      setSaveButton(true, 'جاري تسجيل الدفعة...');

      await apiCall(
        ['addCustomerPayment', 'createCustomerPayment'],
        {
          customer_id: Number(state.customerId),
          booking_id: Number(data.bookingId),
          amount: data.amount,
          payment_method_id: data.methodId,
          payment_date: data.paymentDate,
          notes: data.notes
        }
      );

      toast('تم تسجيل الدفعة وربطها بالحجز بنجاح.', 'success');
      closeModal();
      await loadData();
    } catch (error) {
      console.error('savePayment:', error);
      toast(error?.message || 'تعذر تسجيل الدفعة.', 'error');
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

  async function deleteBooking(id) {
    const booking = state.bookings.find(
      (item) => Number(item.id) === Number(id)
    );
    if (!booking) return;

    const confirmed = await confirmAction(
      `سيتم حذف الحجز #${id}. يجب أن يقوم النظام بحذف/إلغاء كل الدفعات المرتبطة بهذا الحجز أيضًا. هل تريد المتابعة؟`
    );

    if (!confirmed) return;

    try {
      await apiCall(['deleteBooking'], Number(id));
      toast('تم حذف الحجز بنجاح.', 'success');
      await loadData();
    } catch (error) {
      console.error('deleteBooking:', error);
      toast(error?.message || 'تعذر حذف الحجز.', 'error');
    }
  }

  async function deletePayment(id) {
    const payment = state.payments.find(
      (item) => Number(item.id) === Number(id)
    );
    if (!payment) return;

    const confirmed = await confirmAction(
      `هل تريد حذف الدفعة بقيمة ${money(payment.amount)}؟`
    );

    if (!confirmed) return;

    try {
      await apiCall(['deleteCustomerPayment'], Number(id));
      toast('تم حذف الدفعة بنجاح.', 'success');
      await loadData();
    } catch (error) {
      console.error('deletePayment:', error);
      toast(error?.message || 'تعذر حذف الدفعة.', 'error');
    }
  }

  function printBooking(id) {
    const booking = state.bookings.find(
      (item) => Number(item.id) === Number(id)
    );
    if (!booking) return;

    const paid = bookingPaid(booking.id);
    const total = bookingTotal(booking);
    const remaining = Math.max(0, total - paid);

    const rows = (Array.isArray(booking.items) ? booking.items : [])
      .map((item) => `
        <tr>
          <td>${esc(item.item_name ?? item.itemName ?? item.name ?? '')}</td>
          <td>${number(item.quantity)}</td>
          <td>${money(item.unit_price ?? item.unitPrice ?? item.price)}</td>
          <td>${money(item.total_price ?? item.totalPrice)}</td>
        </tr>
      `).join('');

    const html = `
      <!doctype html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>الحجز #${esc(booking.id)}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#222}
          h1{font-size:22px}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #ddd;padding:8px;text-align:right}
          .summary{margin-top:20px;line-height:2}
        </style>
      </head>
      <body>
        <h1>تفاصيل الحجز #${esc(booking.id)}</h1>
        <div>العميل: ${esc(state.customer?.name || '')}</div>
        <div>تاريخ المناسبة: ${esc(dateOnly(booking.event_date))}</div>
        <div>وقت التسليم: ${esc(booking.delivery_time || '—')}</div>
        <div>العنوان: ${esc(booking.delivery_address || '—')}</div>
        <table>
          <thead>
            <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4">لا توجد أصناف</td></tr>'}</tbody>
        </table>
        <div class="summary">
          إجمالي الحجز: ${money(total)}<br>
          المدفوع: ${money(paid)}<br>
          المتبقي: ${money(remaining)}<br>
          تأمين الصحون: ${money(booking.plate_deposit)}
        </div>
        <script>window.onload=function(){window.print();};</script>
      </body>
      </html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.', 'error');
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function printStatement() {
    const rows = statementRows();
    let balance = 0;

    const body = rows.map((row) => {
      balance += row.debit - row.credit;
      return `
        <tr>
          <td>${esc(dateOnly(row.date))}</td>
          <td>${esc(row.description)}</td>
          <td>${row.debit ? money(row.debit) : '—'}</td>
          <td>${row.credit ? money(row.credit) : '—'}</td>
          <td>${money(balance)}</td>
        </tr>`;
    }).join('');

    const html = `
      <!doctype html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب - ${esc(state.customer?.name || '')}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#222}
          h1{font-size:22px}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #ddd;padding:8px;text-align:right}
        </style>
      </head>
      <body>
        <h1>كشف حساب العميل: ${esc(state.customer?.name || '')}</h1>
        <div>الجوال: ${esc(state.customer?.phone || '—')}</div>
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>البيان</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <script>window.onload=function(){window.print();};</script>
      </body>
      </html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.', 'error');
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function bindContainer() {
    const container = $('customerViewContent');
    if (!container) return;

    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const card = button.closest('[data-id]');
      const id = Number(card?.dataset.id);

      switch (action) {
        case 'newBooking':
          openBookingModal();
          break;
        case 'newPayment':
          openPaymentModal();
          break;
        case 'editBooking': {
          const booking = state.bookings.find(
            (item) => Number(item.id) === id
          );
          if (booking) openBookingModal(booking);
          break;
        }
        case 'deleteBooking':
          deleteBooking(id);
          break;
        case 'deletePayment':
          deletePayment(id);
          break;
        case 'printBooking':
          printBooking(id);
          break;
        case 'printStatement':
          printStatement();
          break;
        case 'backCustomers':
          window.location.href = 'customers.html';
          break;
        default:
          break;
      }
    });
  }

  function bindModal() {
    document.querySelectorAll('.switch-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        if (mode === 'booking') {
          openBookingModal();
        } else {
          openPaymentModal();
        }
      });
    });

    $('transactionSaveBtn')?.addEventListener('click', () => {
      if (state.mode === 'booking') {
        saveBooking();
      } else {
        savePayment();
      }
    });

    $('addBookingItemBtn')?.addEventListener('click', () => {
      $('bookingItemsContainer')?.insertAdjacentHTML(
        'beforeend',
        renderNewItemRow()
      );
      updateBookingPreview();
    });

    $('bookingItemsContainer')?.addEventListener('change', (event) => {
      if (event.target.matches('.item-select')) {
        const row = event.target.closest('.item-row');
        const price = row?.querySelector('.item-price');
        if (price) delete price.dataset.manual;
        updateItemRow(row);
        updateBookingPreview();
      }
    });

    $('bookingItemsContainer')?.addEventListener('input', (event) => {
      if (event.target.matches('.item-price')) {
        event.target.dataset.manual = 'true';
      }

      if (event.target.matches('.item-qty,.item-price')) {
        updateItemRow(event.target.closest('.item-row'));
        updateBookingPreview();
      }
    });

    $('bookingItemsContainer')?.addEventListener('click', (event) => {
      const button = event.target.closest('.remove-item-btn');
      if (!button) return;

      const row = button.closest('.item-row');
      const box = $('bookingItemsContainer');
      if (!row || !box) return;

      const rows = box.querySelectorAll('.item-row');
      if (rows.length > 1) {
        row.remove();
      } else {
        row.querySelectorAll('input').forEach((input) => {
          input.value = '';
        });
        const select = row.querySelector('select');
        if (select) select.value = '';
      }

      updateBookingPreview();
    });

    ['bookingPlateDeposit', 'bookingInitialPayment'].forEach((id) => {
      $(id)?.addEventListener('input', updateBookingPreview);
    });

    $('paymentAmount')?.addEventListener('input', updatePaymentPreview);
    $('paymentBooking')?.addEventListener('change', updatePaymentPreview);

    document.querySelectorAll('[data-close="transactionModal"]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });

    $('transactionModal')?.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = $('transactionModal');
        if (modal?.classList.contains('active')) {
          closeModal();
        }
      }
    });
  }

  function bindFab() {
    $('fab')?.addEventListener('click', () => {
      if (state.customer) openBookingModal();
    });
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    state.customerId = Number(params.get('id')) || 0;

    bindContainer();
    bindModal();
    bindFab();

    if (!state.customerId) {
      renderFailure(
        'معرف العميل غير صحيح',
        'افتح صفحة تفاصيل العميل من قائمة العملاء.'
      );
      return;
    }

    loadData();
  }

  /*
   * دوال عامة مطلوبة من الـ HTML الحالي.
   */
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
