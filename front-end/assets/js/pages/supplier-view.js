document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const state = {
    supplierId: null,
    supplier: null,
    invoices: [],
    payments: [],
    statement: [],
    paymentMethods: [],
    mode: 'invoice',
    editingInvoiceId: null,
    editingPaymentId: null,
    saving: false,
    activeTab: 'invoices',
    invoicesReady: false, paymentsReady: false, statementReady: false,
    dataIssues: []
  };

  const el = {
    content: document.getElementById('supplierViewContent'),
    fab: document.getElementById('fab'),
    modal: document.getElementById('transactionModal'),
    modalTitle: document.getElementById('transactionModalTitle'),
    invoiceForm: document.getElementById('invoiceForm'),
    paymentForm: document.getElementById('paymentForm'),
    save: document.getElementById('saveTransaction'),

    invoiceNumber: document.getElementById('invoiceNumber'),
    invoiceDate: document.getElementById('invoiceDate'),
    invoiceTotal: document.getElementById('invoiceTotal'),
    invoiceDetails: document.getElementById('invoiceDetails'),
    invoiceNotes: document.getElementById('invoiceNotes'),

    paymentDate: document.getElementById('paymentDate'),
    paymentAmount: document.getElementById('paymentAmount'),
    paymentMethod: document.getElementById('paymentMethod'),
    paymentNotes: document.getElementById('paymentNotes')
  };

  function toast(message, type = 'info') {
    if (window.Layout && typeof Layout.showToast === 'function') {
      Layout.showToast(message, type);
      return;
    }

    alert(message);
  }

  function confirmAction(options) {
    if (window.Layout && typeof Layout.showConfirm === 'function') {
      Layout.showConfirm(options);
      return;
    }

    if (confirm(options.message || 'هل أنت متأكد؟')) {
      options.onConfirm?.();
    }
  }

  function currency(value) {
    const number = Number(value || 0);

    if (window.Utils && typeof Utils.formatCurrency === 'function') {
      return Utils.formatCurrency(number);
    }

    return `${number.toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ر.س`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts.length
      ? parts.slice(0, 2).map(x => x[0]).join('').toUpperCase()
      : 'م';
  }

  function today() {
    return localDateTime().slice(0, 10);
  }

  function localDateTime() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function normalizeDate(value) {
    if (!value) return '';

    return String(value).slice(0, 10);
  }

  function normalizeDateTime(value) {
    if (!value) return '';
    // Laravel's datetime columns are local, not UTC; avoid automatic offset conversion.
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
      return raw.replace(' ', 'T').slice(0, 16);
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw.replace(' ', 'T').slice(0, 16);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function accountTotals() {
    if (!state.invoicesReady || !state.paymentsReady) return null;
    const invoices = state.invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const payments = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { invoices, payments, balance: Math.round((invoices - payments) * 100) / 100 };
  }

  function arrayData(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.data?.data)) return value.data.data;
    throw new Error('تنسيق استجابة API غير صحيح');
  }

  function statementData(value) {
    const obj = value?.data && !Array.isArray(value.data) ? value.data : value;
    if (Array.isArray(obj?.transactions)) return obj.transactions;
    if (Array.isArray(obj)) return obj;
    throw new Error('تنسيق كشف الحساب غير صحيح');
  }

  function dataNotice() {
    return state.dataIssues.length
      ? `<div class="supplier-data-notice" role="alert"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(state.dataIssues.join('، '))} <button type="button" class="btn btn-sm btn-secondary" id="retrySupplierData">إعادة المحاولة</button></div>`
      : '';
  }

    async function loadPaymentMethods() {
    try {
      const data = await API.getPaymentMethods();

      state.paymentMethods = Array.isArray(data)
        ? data.filter(item => item.is_active !== false)
        : [];

      el.paymentMethod.innerHTML = state.paymentMethods.map(method => `
        <option value="${method.id}">
          ${escapeHtml(method.name)}
        </option>
      `).join('');

      if (!state.paymentMethods.length) {
        el.paymentMethod.innerHTML = `
          <option value="">لا توجد طرق دفع</option>
        `;
      }
    } catch (error) {
      state.paymentMethods = [];

      el.paymentMethod.innerHTML = `
        <option value="">تعذر تحميل طرق الدفع</option>
      `;
    }
  }

  async function loadData() {
    el.content.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>جاري تحميل ملف المورد...</h4></div>';
    const [supplierRes, invoicesRes, paymentsRes, statementRes] = await Promise.allSettled([
      API.getSupplier(state.supplierId),
      API.getSupplierInvoices({ supplier_id: state.supplierId }),
      API.getSupplierPayments({ supplier_id: state.supplierId }),
      API.getSupplierStatement(state.supplierId)
    ]);
    if (supplierRes.status !== 'fulfilled' || !supplierRes.value) {
      const e = supplierRes.reason;
      el.content.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>تعذر تحميل المورد</h4><p>${escapeHtml(e?.message || 'يرجى إعادة المحاولة')}</p><button class="btn btn-primary" id="retrySupplierData">إعادة المحاولة</button></div>`;
      document.getElementById('retrySupplierData')?.addEventListener('click', loadData);
      return;
    }
    state.supplier = supplierRes.value;
    state.dataIssues = [];
    state.invoicesReady = invoicesRes.status === 'fulfilled';
    state.paymentsReady = paymentsRes.status === 'fulfilled';
    state.statementReady = statementRes.status === 'fulfilled';
    try { state.invoices = state.invoicesReady ? arrayData(invoicesRes.value) : []; }
    catch (e) { state.invoicesReady = false; state.invoices = []; }
    try { state.payments = state.paymentsReady ? arrayData(paymentsRes.value) : []; }
    catch (e) { state.paymentsReady = false; state.payments = []; }
    try { state.statement = state.statementReady ? statementData(statementRes.value) : []; }
    catch (e) { state.statementReady = false; state.statement = []; }
    if (!state.invoicesReady) state.dataIssues.push('تعذر تحميل الفواتير');
    if (!state.paymentsReady) state.dataIssues.push('تعذر تحميل الدفعات');
    if (!state.statementReady && !(state.invoicesReady && state.paymentsReady)) state.dataIssues.push('تعذر تحميل كشف الحساب');
    render();
  }

    function render() {
    if (!state.supplier) return;

    const totals = accountTotals();
    const balance = totals?.balance ?? null;
    const balanceLabel = balance === null ? 'الرصيد غير متاح' : balance > 0.005 ? `مستحق ${currency(balance)}` : balance < -0.005 ? `رصيد دائن ${currency(-balance)}` : 'الحساب مسدد';

    el.content.innerHTML = `
      <div class="supplier-header">

        <div class="supplier-avatar">
          ${escapeHtml(initials(state.supplier.name))}
        </div>

        <div class="supplier-info">
          <div class="supplier-name">
            ${escapeHtml(state.supplier.name || 'بدون اسم')}
          </div>

          <div class="supplier-phone">
            ${escapeHtml(state.supplier.phone || 'لا يوجد رقم')}
          </div>

          ${
            state.supplier.notes
              ? `<div class="supplier-notes">${escapeHtml(state.supplier.notes)}</div>`
              : ''
          }
        </div>

        <div class="balance-badge ${balance === null ? 'unknown' : balance > 0.005 ? 'due' : balance < -0.005 ? 'credit' : 'clear'}">${escapeHtml(balanceLabel)}</div>

      </div>

      <div class="summary-grid">

        <div class="summary-card">
          <span class="label">إجمالي الفواتير</span>
          <span class="value">
            ${totals ? currency(totals.invoices) : '—'}
          </span>
        </div>

        <div class="summary-card">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">
            ${totals ? currency(totals.payments) : '—'}
          </span>
        </div>

        <div class="summary-card">
          <span class="label">المستحق</span>
          <span class="value ${balance !== null && balance > 0 ? 'danger' : 'success'}">
            ${totals ? currency(Math.max(balance, 0)) : '—'}
          </span>
        </div>

      </div>

      ${dataNotice()}

      <div class="tabs">

        <button class="tab ${state.activeTab === 'invoices' ? 'active' : ''}" data-tab="invoices">
          <i class="fas fa-file-invoice"></i>
          الفواتير
        </button>

        <button class="tab ${state.activeTab === 'payments' ? 'active' : ''}" data-tab="payments">
          <i class="fas fa-money-bill-wave"></i>
          المدفوعات
        </button>

        <button class="tab ${state.activeTab === 'statement' ? 'active' : ''}" data-tab="statement">
          <i class="fas fa-receipt"></i>
          كشف الحساب
        </button>

      </div>

      <div class="tab-content ${state.activeTab === 'invoices' ? 'active' : ''}" id="tab-invoices">
        ${renderInvoices()}
      </div>

      <div class="tab-content ${state.activeTab === 'payments' ? 'active' : ''}" id="tab-payments">
        ${renderPayments()}
      </div>

      <div class="tab-content ${state.activeTab === 'statement' ? 'active' : ''}" id="tab-statement">
        ${renderStatement()}
      </div>
    `;

    bindRenderedEvents();
    document.getElementById('retrySupplierData')?.addEventListener('click', loadData);
  }

  function renderInvoices() {
    if (!state.invoicesReady) return '<div class="empty-state"><h4>تعذر تحميل الفواتير</h4><p>تحقق من الاتصال وأعد المحاولة</p></div>';
    const invoices = [...state.invoices].sort((a, b) => {
      return new Date(b.invoice_date) - new Date(a.invoice_date);
    });

    if (!invoices.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-file-invoice"></i>
          <h4>لا توجد فواتير</h4>
          <p>يمكنك إضافة أول فاتورة لهذا المورد</p><button class="btn btn-primary btn-sm" data-add="invoice">إضافة فاتورة</button>
        </div>
      `;
    }

    return `
      <div class="section-header">
        <span class="section-title">فواتير المورد</span>

        <button class="btn btn-primary btn-sm" data-add="invoice">
          <i class="fas fa-plus"></i>
          فاتورة
        </button>
      </div>

      ${invoices.map(invoice => `
        <div
          class="transaction-card"
          data-invoice-id="${invoice.id}"
        >

          <div class="transaction-icon">
            <i class="fas fa-file-invoice"></i>
          </div>

          <div class="transaction-info">
            <div class="transaction-title">
              ${
                escapeHtml(
                  invoice.invoice_number ||
                  `فاتورة #${invoice.id}`
                )
              }
            </div>

            <div class="transaction-meta">
              ${escapeHtml(normalizeDate(invoice.invoice_date))}
              ${invoice.details ? ` · ${escapeHtml(invoice.details)}` : ''}
              ${invoice.notes ? ` · ${escapeHtml(invoice.notes)}` : ''}
            </div>
          </div>

          <div class="transaction-amount invoice">
            ${currency(invoice.total_amount)}
          </div>

          <div class="transaction-actions">

            <button
              class="btn-icon-sm btn-icon-primary"
              data-action="edit-invoice"
              title="تعديل"
            >
              <i class="fas fa-pen"></i>
            </button>

            <button
              class="btn-icon-sm btn-icon-danger"
              data-action="delete-invoice"
              title="حذف"
            >
              <i class="fas fa-trash"></i>
            </button>

          </div>

        </div>
      `).join('')}
    `;
  }

  function paymentMethodName(payment) {
    if (payment.payment_method?.name) {
      return payment.payment_method.name;
    }

    const method = state.paymentMethods.find(
      item => Number(item.id) === Number(payment.payment_method_id)
    );

    return method?.name || 'غير محدد';
  }

  function renderPayments() {
    if (!state.paymentsReady) return '<div class="empty-state"><h4>تعذر تحميل المدفوعات</h4><p>تحقق من الاتصال وأعد المحاولة</p></div>';
    const payments = [...state.payments].sort((a, b) => {
      return new Date(b.payment_date) - new Date(a.payment_date);
    });

    if (!payments.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-money-bill-wave"></i>
          <h4>لا توجد مدفوعات</h4>
          <p>يمكنك تسجيل أول دفعة لهذا المورد</p><button class="btn btn-primary btn-sm" data-add="payment">تسجيل دفعة</button>
        </div>
      `;
    }

    return `
      <div class="section-header">
        <span class="section-title">مدفوعات المورد</span>

        <button class="btn btn-primary btn-sm" data-add="payment">
          <i class="fas fa-plus"></i>
          دفعة
        </button>
      </div>

      ${payments.map(payment => `
        <div
          class="transaction-card"
          data-payment-id="${payment.id}"
        >

          <div class="transaction-icon">
            <i class="fas fa-money-bill-wave"></i>
          </div>

          <div class="transaction-info">
            <div class="transaction-title">
              ${escapeHtml(paymentMethodName(payment))}
            </div>

            <div class="transaction-meta">
              ${escapeHtml(normalizeDate(payment.payment_date))}
              ${
                payment.notes
                  ? ` · ${escapeHtml(payment.notes)}`
                  : ''
              }
            </div>
          </div>

          <div class="transaction-amount payment">
            ${currency(payment.amount)}
          </div>

          <div class="transaction-actions">

            <button
              class="btn-icon-sm btn-icon-primary"
              data-action="edit-payment"
              title="تعديل"
            >
              <i class="fas fa-pen"></i>
            </button>

            <button
              class="btn-icon-sm btn-icon-danger"
              data-action="delete-payment"
              title="حذف"
            >
              <i class="fas fa-trash"></i>
            </button>

          </div>

        </div>
      `).join('')}
    `;
  }

  function buildStatement() {
    if (state.statementReady) {
      return [...state.statement].map(row => {
        const isInvoice = row.type === 'invoice' || row.type === 'debit';
        const debit = Number(row.debit ?? (isInvoice ? row.amount : 0)) || 0;
        const credit = Number(row.credit ?? (!isInvoice ? row.amount : 0)) || 0;
        return { ...row, debit, credit };
      }).sort((a, b) => String(a.date ?? a.created_at ?? '').localeCompare(String(b.date ?? b.created_at ?? '')));
    }
    if (!(state.invoicesReady && state.paymentsReady)) return null;
    return [
      ...state.invoices.map(invoice => ({ type:'invoice', date:invoice.invoice_date,
        description:invoice.invoice_number || invoice.details || `فاتورة #${invoice.id}`, debit:Number(invoice.total_amount)||0, credit:0 })),
      ...state.payments.map(payment => ({ type:'payment', date:payment.payment_date,
        description:paymentMethodName(payment), debit:0, credit:Number(payment.amount)||0 }))
    ].sort((a,b) => String(a.date).localeCompare(String(b.date)));
  }

  function renderStatement() {
    const rows = buildStatement();
    if (rows === null) return '<div class="empty-state"><h4>كشف الحساب غير متاح</h4><p>تعذر تحميل الحركات المالية</p></div>';
    if (!rows.length) return '<div class="empty-state"><i class="fas fa-receipt"></i><h4>كشف الحساب فارغ</h4><p>لا توجد حركات مالية</p></div>';
    let balance = 0;
    return `<div class="section-header"><span class="section-title">كشف الحساب</span><button class="btn btn-secondary btn-sm" type="button" id="printSupplierStatement"><i class="fas fa-print"></i> طباعة الكشف</button></div>
      <div class="statement"><div class="statement-row statement-head"><span>البيان</span><span>مدين</span><span>دائن</span><span>الرصيد</span></div>
        ${rows.map(row => {
          const debit = Number(row.debit)||0, credit = Number(row.credit)||0;
          balance = Math.round((balance + debit - credit)*100)/100;
          const displayBalance = balance < -0.005 ? `دائن ${currency(-balance)}` : currency(balance);
          return `<div class="statement-row"><div><strong>${escapeHtml(row.description || row.notes || (debit ? 'فاتورة' : 'دفعة'))}</strong><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(normalizeDate(row.date || row.created_at || row.createdAt))}</div></div>
          <span class="statement-debit">${debit ? currency(debit) : '—'}</span><span class="statement-credit">${credit ? currency(credit) : '—'}</span><span class="statement-balance ${balance < -0.005 ? 'credit' : ''}">${displayBalance}</span></div>`;
        }).join('')}</div>`;
  }

  function printStatement() {
    const rows = buildStatement();
    if (!rows) return toast('كشف الحساب غير متاح للطباعة', 'error');
    const win = window.open('', '_blank');
    if (!win) return toast('تعذر فتح نافذة الطباعة', 'error');
    let balance = 0;
    const tbody = rows.map(row => {
      const debit = Number(row.debit)||0, credit = Number(row.credit)||0;
      balance = Math.round((balance + debit - credit)*100)/100;
      return `<tr><td>${escapeHtml(normalizeDate(row.date))}</td><td>${escapeHtml(row.description || '')}</td><td>${debit ? currency(debit) : '—'}</td><td>${credit ? currency(credit) : '—'}</td><td>${balance < 0 ? 'دائن ' + currency(-balance) : currency(balance)}</td></tr>`;
    }).join('');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب - ${escapeHtml(state.supplier?.name)}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}table{border-collapse:collapse;width:100%;margin-top:20px}td,th{border:1px solid #ccc;padding:9px;font-size:12px;text-align:right}th{background:#eee}h1{font-size:20px}</style></head><body><h1>كشف حساب المورد: ${escapeHtml(state.supplier?.name)}</h1><p>تاريخ الطباعة: ${today()}</p><table><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${tbody}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }

    function setMode(mode) {
    state.mode = mode;

    document.querySelectorAll('#transactionModal [data-mode]').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.mode === mode
      );
    });

    el.invoiceForm.style.display =
      mode === 'invoice' ? 'block' : 'none';

    el.paymentForm.style.display =
      mode === 'payment' ? 'block' : 'none';

    if (state.editingInvoiceId && mode === 'invoice') {
      el.modalTitle.textContent = 'تعديل الفاتورة';
      el.save.textContent = 'تحديث الفاتورة';
    } else if (state.editingPaymentId && mode === 'payment') {
      el.modalTitle.textContent = 'تعديل الدفعة';
      el.save.textContent = 'تحديث الدفعة';
    } else {
      el.modalTitle.textContent =
        mode === 'invoice'
          ? 'فاتورة جديدة'
          : 'تسجيل دفعة';

      el.save.textContent =
        mode === 'invoice'
          ? 'حفظ الفاتورة'
          : 'تسجيل الدفعة';
    }
  }

  function openModal(mode = 'invoice', item = null) {
    state.editingInvoiceId = null;
    state.editingPaymentId = null;

    el.invoiceNumber.value = '';
    el.invoiceDate.value = today();
    el.invoiceTotal.value = '';
    el.invoiceDetails.value = '';
    el.invoiceNotes.value = '';

    el.paymentDate.value = localDateTime();
    el.paymentAmount.value = '';
    el.paymentNotes.value = '';
    // Reset the payment method to a valid default for new entries.
    el.paymentMethod.selectedIndex = 0;

    if (mode === 'invoice' && item) {
      state.editingInvoiceId = Number(item.id);

      el.invoiceNumber.value =
        item.invoice_number || '';

      el.invoiceDate.value =
        normalizeDate(item.invoice_date);

      el.invoiceTotal.value =
        item.total_amount || 0;

      el.invoiceDetails.value =
        item.details || '';

      el.invoiceNotes.value =
        item.notes || '';
    }

    if (mode === 'payment' && item) {
      state.editingPaymentId = Number(item.id);

      el.paymentDate.value =
        normalizeDateTime(item.payment_date);

      el.paymentAmount.value =
        item.amount || 0;

      el.paymentNotes.value =
        item.notes || '';

      if (item.payment_method_id) {
        el.paymentMethod.value =
          String(item.payment_method_id);
      }
    }

    setMode(mode);

    el.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(force = false) {
    if (state.saving && force !== true) return;
    el.modal.classList.remove('active');
    document.body.style.overflow = '';

    state.editingInvoiceId = null;
    state.editingPaymentId = null;
  }

  async function saveInvoice() {
    if (state.saving) return;

    const invoiceDate = el.invoiceDate.value;
    const total = Number(el.invoiceTotal.value);
    const invoiceNumber =
      el.invoiceNumber.value.trim();

    const details =
      el.invoiceDetails.value.trim();

    const notes =
      el.invoiceNotes.value.trim();

    if (!invoiceDate) {
      toast('يرجى تحديد تاريخ الفاتورة', 'warning');
      return;
    }

    if (!Number.isFinite(total) || total <= 0) {
      toast('يرجى إدخال إجمالي صحيح', 'warning');
      return;
    }
    if (!details) { toast('تفاصيل الفاتورة مطلوبة', 'warning'); el.invoiceDetails.focus(); return; }

    state.saving = true;
    el.save.disabled = true;
    el.save.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
      const payload = {
        supplier_id: state.supplierId,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        details: details || null,
        total_amount: Number(total.toFixed(2)),
        notes: notes || null
      };

      if (state.editingInvoiceId) {
        await API.updateSupplierInvoice(
          state.editingInvoiceId,
          payload
        );

        toast('تم تحديث الفاتورة بنجاح', 'success');
      } else {
        await API.createSupplierInvoice(payload);

        toast('تم إضافة الفاتورة بنجاح', 'success');
      }

      closeModal(true);
      await loadData();
    } catch (error) {
      console.error(error);

      toast(
        error?.message || 'تعذر حفظ الفاتورة',
        'error'
      );
    } finally {
      state.saving = false;
      el.save.disabled = false;
      el.save.textContent = state.editingInvoiceId ? 'تحديث الفاتورة' : 'حفظ الفاتورة';
    }
  }

  async function savePayment() {
    if (state.saving) return;

    const date = el.paymentDate.value;
    const amount = Number(el.paymentAmount.value);
    const methodId = Number(el.paymentMethod.value);
    const notes = el.paymentNotes.value.trim();

    if (!date) {
      toast('يرجى تحديد تاريخ الدفعة', 'warning');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast('يرجى إدخال مبلغ صحيح', 'warning');
      return;
    }

    if (!methodId) {
      toast('يرجى اختيار طريقة الدفع', 'warning');
      return;
    }

    state.saving = true;
    el.save.disabled = true;
    el.save.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
      const payload = {
        amount: Number(amount.toFixed(2)),
        payment_method_id: methodId,
        payment_date: date.replace('T', ' ') + (date.length === 16 ? ':00' : ''),
        notes: notes || null
      };
      if (!state.editingPaymentId) payload.supplier_id = state.supplierId;

      if (state.editingPaymentId) {
        await API.updateSupplierPayment(
          state.editingPaymentId,
          payload
        );

        toast('تم تحديث الدفعة بنجاح', 'success');
      } else {
        await API.createSupplierPayment(payload);

        toast('تم تسجيل الدفعة بنجاح', 'success');
      }

      closeModal(true);
      await loadData();
    } catch (error) {
      console.error(error);

      toast(
        error?.message || 'تعذر حفظ الدفعة',
        'error'
      );
    } finally {
      state.saving = false;
      el.save.disabled = false;
      el.save.textContent = state.editingPaymentId ? 'تحديث الدفعة' : 'تسجيل الدفعة';
    }
  }

  function deleteInvoice(id) {
    const invoice = state.invoices.find(
      item => Number(item.id) === Number(id)
    );

    if (!invoice) return;

    confirmAction({
      title: 'حذف الفاتورة',
      message:
        `هل أنت متأكد من حذف الفاتورة "${invoice.invoice_number || `#${invoice.id}`}"؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      danger: true,

      onConfirm: async () => {
        try {
          await API.deleteSupplierInvoice(id);

          toast('تم حذف الفاتورة بنجاح', 'success');

          await loadData();
        } catch (error) {
          toast(
            error?.message || 'تعذر حذف الفاتورة',
            'error'
          );
        }
      }
    });
  }

  function deletePayment(id) {
    const payment = state.payments.find(
      item => Number(item.id) === Number(id)
    );

    if (!payment) return;

    confirmAction({
      title: 'حذف الدفعة',
      message:
        `هل أنت متأكد من حذف الدفعة بقيمة ${currency(payment.amount)}؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      danger: true,

      onConfirm: async () => {
        try {
          await API.deleteSupplierPayment(id);

          toast('تم حذف الدفعة بنجاح', 'success');

          await loadData();
        } catch (error) {
          toast(
            error?.message || 'تعذر حذف الدفعة',
            'error'
          );
        }
      }
    });
  }

  function bindRenderedEvents() {
    document.getElementById('printSupplierStatement')?.addEventListener('click', printStatement);
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.tab;
        document.querySelectorAll('[data-tab]')
          .forEach(item => item.classList.remove('active'));

        document.querySelectorAll('.tab-content')
          .forEach(item => item.classList.remove('active'));

        button.classList.add('active');

        document
          .getElementById(`tab-${button.dataset.tab}`)
          ?.classList.add('active');
      });
    });

    document.querySelectorAll('[data-add]').forEach(button => {
      button.addEventListener('click', () => {
        openModal(button.dataset.add);
      });
    });

    document.querySelectorAll('[data-action="edit-invoice"]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const card = button.closest('[data-invoice-id]');
          const id = Number(card.dataset.invoiceId);

          const invoice = state.invoices.find(
            item => Number(item.id) === id
          );

          openModal('invoice', invoice);
        });
      });

    document.querySelectorAll('[data-action="delete-invoice"]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const card = button.closest('[data-invoice-id]');
          deleteInvoice(Number(card.dataset.invoiceId));
        });
      });

    document.querySelectorAll('[data-action="edit-payment"]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const card = button.closest('[data-payment-id]');
          const id = Number(card.dataset.paymentId);

          const payment = state.payments.find(
            item => Number(item.id) === id
          );

          openModal('payment', payment);
        });
      });

    document.querySelectorAll('[data-action="delete-payment"]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const card = button.closest('[data-payment-id]');
          deletePayment(Number(card.dataset.paymentId));
        });
      });
  }

  function bindEvents() {
    // Layout replaces the FAB with a clone. Listen to its event, not the old node.
    document.querySelectorAll('#transactionModal [data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const next = button.dataset.mode;
        // Switching while editing starts a fresh transaction instead of submitting the old ID.
        if (state.editingInvoiceId || state.editingPaymentId) openModal(next);
        else setMode(next);
      });
    });

    el.save?.addEventListener('click', () => {
      if (state.mode === 'invoice') {
        saveInvoice();
      } else {
        savePayment();
      }
    });

    document.querySelectorAll('[data-close="transactionModal"]')
      .forEach(button => {
        button.addEventListener('click', closeModal);
      });

    document.addEventListener('fab:modal:opened', event => {
      if (event.detail?.modalId === 'transactionModal') openModal('invoice');
    });

    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        el.modal.classList.contains('active')
      ) {
        closeModal();
      }
    });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('id'));

    if (!id) {
      location.href = 'suppliers.html';
      return;
    }

    state.supplierId = id;

    if (!window.API) {
      setTimeout(init, 200);
      return;
    }

    bindEvents();

    await Promise.all([
      loadPaymentMethods(),
      loadData()
    ]);
  }

  init();
});