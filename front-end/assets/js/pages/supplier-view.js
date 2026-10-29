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
    dataIssues: [],
    statementFrom: '', statementTo: '',
    document: null, documentBusy: false
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
    paymentNotes: document.getElementById('paymentNotes'),
    documentModal: document.getElementById('supplierDocumentModal'),
    documentContent: document.getElementById('supplierDocumentContent'),
    documentTitle: document.getElementById('supplierDocumentTitle'),
    printRoot: document.getElementById('supplierPrintRoot')
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
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="view-invoice" title="عرض الفاتورة" aria-label="عرض الفاتورة"><i class="fas fa-eye"></i></button>
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="print-invoice" title="طباعة الفاتورة" aria-label="طباعة الفاتورة"><i class="fas fa-print"></i></button>
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="share-invoice" title="مشاركة PDF" aria-label="مشاركة فاتورة PDF"><i class="fas fa-share-nodes"></i></button>
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
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="view-payment" title="عرض سند الصرف" aria-label="عرض سند الصرف"><i class="fas fa-eye"></i></button>
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="print-payment" title="طباعة سند الصرف" aria-label="طباعة سند الصرف"><i class="fas fa-print"></i></button>
            <button type="button" class="btn-icon-sm supplier-doc-icon" data-action="share-payment" title="مشاركة PDF" aria-label="مشاركة سند الصرف PDF"><i class="fas fa-share-nodes"></i></button>
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

  // ===== سجل المورد: يعتمد على الحركات المالية الأصلية لا على التقديرات =====
  function buildStatement() {
    if (state.statementReady) {
      return [...state.statement].map((row, index) => {
        const invoice = row.type === 'invoice' || row.type === 'debit';
        const debit = Number(row.debit ?? (invoice ? row.amount : 0)) || 0;
        const credit = Number(row.credit ?? (invoice ? 0 : row.amount)) || 0;
        return { ...row, debit, credit, _sequence: index,
          date: row.date ?? row.created_at ?? '',
          type: invoice ? 'invoice' : 'payment' };
      }).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a._sequence - b._sequence);
    }
    if (!(state.invoicesReady && state.paymentsReady)) return null;
    return [
      ...state.invoices.map(invoice => ({ type: 'invoice', id: invoice.id,
        date: invoice.invoice_date, invoice_number: invoice.invoice_number,
        description: invoice.invoice_number ? `فاتورة ${invoice.invoice_number}` : `فاتورة #${invoice.id}`,
        debit: Number(invoice.total_amount) || 0, credit: 0 })),
      ...state.payments.map(payment => ({ type: 'payment', id: payment.id, date: payment.payment_date,
        payment_method: paymentMethodName(payment), description: `دفعة للمورد #${payment.id}`,
        debit: 0, credit: Number(payment.amount) || 0 }))
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.type === 'invoice' ? -1 : 1));
  }

  function dateText(value) {
    const date = normalizeDate(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  function dateTimeText(value) {
    const v = String(value || '');
    const match = v.match(/(\d{2}:\d{2})/);
    return `${dateText(v)}${match ? ' · ' + match[1] : ''}`;
  }
  function balanceText(value) {
    const amount = Math.round(Number(value || 0) * 100) / 100;
    if (amount > 0.005) return `مستحق ${currency(amount)}`;
    if (amount < -0.005) return `رصيد دائن ${currency(-amount)}`;
    return 'مسدد';
  }
  function statementModel() {
    const rows = buildStatement();
    if (rows === null) return null;
    const from = state.statementFrom;
    const to = state.statementTo;
    let opening = 0;
    let debitTotal = 0;
    let creditTotal = 0;
    const visible = [];
    for (const row of rows) {
      const date = normalizeDate(row.date);
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      if (from && date && date < from) { opening += debit - credit; continue; }
      if ((from || to) && !date) continue;
      if (to && date > to) continue;
      debitTotal += debit;
      creditTotal += credit;
      visible.push({ ...row, debit, credit });
    }
    let running = Math.round(opening * 100) / 100;
    const calculated = visible.map(row => {
      running = Math.round((running + row.debit - row.credit) * 100) / 100;
      return { ...row, balance: running };
    });
    return { rows: calculated, opening: Math.round(opening * 100) / 100,
      debitTotal: Math.round(debitTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      closing: running, from, to };
  }
  function statementPeriodLabel(model) {
    if (!model.from && !model.to) return 'جميع الحركات المسجلة';
    return `من ${model.from ? dateText(model.from) : 'البداية'} إلى ${model.to ? dateText(model.to) : 'اليوم'}`;
  }
  function ledgerRowsHtml(model, forDocument = false) {
    if (!model.rows.length) return '<tr><td class="supplier-ledger-empty" colspan="5">لا توجد حركات في الفترة المحددة</td></tr>';
    return model.rows.map(row => {
      const invoice = row.type === 'invoice';
      const ref = invoice
        ? (row.invoice_number ? `فاتورة ${row.invoice_number}` : `فاتورة #${row.id || '—'}`)
        : `دفعة #${row.id || '—'}`;
      const title = row.description || ref;
      const sub = invoice ? 'فاتورة مشتريات' : `سند صرف${row.payment_method ? ' · ' + row.payment_method : ''}`;
      return `<tr class="supplier-ledger-entry">
        <td data-label="التاريخ" class="supplier-ledger-date">${escapeHtml(dateTimeText(row.date))}</td>
        <td data-label="البيان" class="supplier-ledger-description"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span></td>
        <td data-label="مدين" class="supplier-ledger-debit">${row.debit ? currency(row.debit) : '—'}</td>
        <td data-label="دائن" class="supplier-ledger-credit">${row.credit ? currency(row.credit) : '—'}</td>
        <td data-label="الرصيد" class="supplier-ledger-balance ${row.balance < -0.005 ? 'is-credit' : ''}">${escapeHtml(balanceText(row.balance))}</td>
      </tr>`;
    }).join('');
  }
  function summaryTiles(model) {
    return `<div class="supplier-ledger-summary">
      <div class="supplier-ledger-tile"><span>رصيد أول الفترة</span><strong>${escapeHtml(balanceText(model.opening))}</strong></div>
      <div class="supplier-ledger-tile"><span>الفواتير (مدين)</span><strong>${currency(model.debitTotal)}</strong></div>
      <div class="supplier-ledger-tile"><span>المدفوع (دائن)</span><strong>${currency(model.creditTotal)}</strong></div>
      <div class="supplier-ledger-tile ${model.closing > 0.005 ? 'due' : model.closing < -0.005 ? 'credit' : ''}"><span>الرصيد الختامي</span><strong>${escapeHtml(balanceText(model.closing))}</strong></div>
    </div>`;
  }
  function ledgerTableHtml(model) {
    return `<div class="supplier-ledger-table-wrap"><table class="supplier-ledger-table">
      <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين (فواتير)</th><th>دائن (دفعات)</th><th>الرصيد بعد الحركة</th></tr></thead>
      <tbody>${ledgerRowsHtml(model)}</tbody>
      <tfoot><tr><td colspan="2">الإجمالي خلال الفترة</td><td>${currency(model.debitTotal)}</td><td>${currency(model.creditTotal)}</td><td>${escapeHtml(balanceText(model.closing))}</td></tr></tfoot>
    </table></div>`;
  }
  function renderStatement() {
    const model = statementModel();
    if (model === null) return '<div class="empty-state"><h4>كشف الحساب غير متاح</h4><p>تعذر تحميل الحركات المالية، أعد المحاولة قبل الطباعة</p></div>';
    return `<section class="supplier-statement-panel">
      <div class="supplier-statement-top"><div><h3>كشف حساب المورد</h3><p>ملخص المستحقات والمدفوعات مع الرصيد المتراكم</p></div>
        <span class="supplier-period-chip">${escapeHtml(statementPeriodLabel(model))}</span></div>
      <div class="supplier-statement-controls"><div class="supplier-range-fields">
        <label>من تاريخ<input type="date" id="supplierStatementFrom" value="${escapeHtml(state.statementFrom)}"></label>
        <label>إلى تاريخ<input type="date" id="supplierStatementTo" value="${escapeHtml(state.statementTo)}"></label></div>
        <div class="supplier-statement-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="supplierStatementApply">تطبيق</button>
          <button type="button" class="btn btn-secondary btn-sm" id="supplierStatementReset">الكل</button>
          <button type="button" class="btn btn-secondary btn-sm" data-doc-statement="view"><i class="fas fa-eye"></i> معاينة</button>
          <button type="button" class="btn btn-secondary btn-sm" data-doc-statement="print"><i class="fas fa-print"></i> طباعة</button>
          <button type="button" class="btn btn-secondary btn-sm" data-doc-statement="pdf"><i class="fas fa-file-pdf"></i> PDF</button>
          <button type="button" class="btn btn-primary btn-sm" data-doc-statement="share"><i class="fas fa-share-nodes"></i> مشاركة</button>
        </div></div>
      ${summaryTiles(model)}
      ${ledgerTableHtml(model)}
      <p class="supplier-statement-note">مدين = فواتير المورد، دائن = ما دُفع للمورد. الرصيد الدائن يعني زيادة المدفوع على قيمة الفواتير.</p>
    </section>`;
  }

  // ===== قوالب المستندات: الفاتورة، سند الصرف، كشف الحساب =====
  function docHeader(type, reference, date) {
    return `<header class="supplier-doc-header">
      <div class="supplier-doc-brand"><img src="assets/images/logo.png" alt="" onerror="this.style.display='none'">
        <div><strong>مطابخ شواطئ عدن</strong><span>سجلات الموردين والحسابات</span></div></div>
      <div class="supplier-doc-header-meta"><span>${escapeHtml(type)}</span><strong>${escapeHtml(reference)}</strong><small>${escapeHtml(date)}</small></div>
    </header>`;
  }
  function docDetails(entries) {
    return `<div class="supplier-doc-details">${entries.map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value ?? '—')}</strong></div>`).join('')}</div>`;
  }
  function docFooter() {
    return `<footer class="supplier-doc-footer"><strong>مطابخ شواطئ عدن</strong><span>مستند صادر من سجلات النظام في ${escapeHtml(new Date().toLocaleString('ar-SA'))}</span></footer>`;
  }
  function invoiceDocument(invoice) {
    const id = Number(invoice.id);
    const reference = invoice.invoice_number || `#${id}`;
    const html = `<article class="supplier-doc-paper">
      ${docHeader('فاتورة مورد مسجلة', reference, dateText(invoice.invoice_date))}
      <div class="supplier-doc-heading"><span>فاتورة مشتريات</span><h2>بيانات فاتورة المورد</h2><p>ملخص فاتورة محفوظة في سجلات المطعم</p></div>
      ${docDetails([['اسم المورد', state.supplier.name], ['رقم الجوال', state.supplier.phone || '—'],
        ['رقم الفاتورة', reference], ['تاريخ الفاتورة', dateText(invoice.invoice_date)]])}
      <section class="supplier-doc-section"><h3>تفاصيل الفاتورة</h3><div class="supplier-doc-prose">${escapeHtml(invoice.details || 'لا توجد تفاصيل')}</div></section>
      ${invoice.notes ? `<section class="supplier-doc-section"><h3>ملاحظات</h3><div class="supplier-doc-prose">${escapeHtml(invoice.notes)}</div></section>` : ''}
      <div class="supplier-doc-total"><span>إجمالي الفاتورة</span><strong>${currency(invoice.total_amount)}</strong></div>
      <p class="supplier-doc-disclaimer">نسخة من فاتورة مورد مسجلة بالنظام؛ ليست فاتورة ضريبية صادرة من المورد ولا تؤكد سدادها.</p>
      ${docFooter()}</article>`;
    return { type: 'invoice', title: `فاتورة مورد ${reference}`, filename: `supplier-invoice-${id}.pdf`, html };
  }
  function paymentDocument(payment) {
    const id = Number(payment.id);
    const html = `<article class="supplier-doc-paper">
      ${docHeader('سند صرف مسجل', `#${id}`, dateTimeText(payment.payment_date))}
      <div class="supplier-doc-heading"><span>مدفوعات الموردين</span><h2>سند صرف للمورد</h2><p>بيانات دفعة مسجلة في حساب المورد</p></div>
      <div class="supplier-doc-amount"><span>المبلغ المدفوع</span><strong>${currency(payment.amount)}</strong></div>
      ${docDetails([['اسم المورد', state.supplier.name], ['رقم الجوال', state.supplier.phone || '—'],
        ['رقم السند', `#${id}`], ['تاريخ ووقت الدفع', dateTimeText(payment.payment_date)],
        ['طريقة الدفع', paymentMethodName(payment)]])}
      ${payment.notes ? `<section class="supplier-doc-section"><h3>ملاحظات الدفعة</h3><div class="supplier-doc-prose">${escapeHtml(payment.notes)}</div></section>` : ''}
      <p class="supplier-doc-disclaimer">السند يثبت تسجيل الدفعة في النظام فقط، ولا يُعد إثباتًا مصرفيًا لإتمام التحويل.</p>
      ${docFooter()}</article>`;
    return { type: 'payment', title: `سند صرف #${id}`, filename: `supplier-payment-${id}.pdf`, html };
  }
  function statementDocument() {
    const model = statementModel();
    if (!model) throw new Error('كشف الحساب غير متاح؛ أعد تحميل بيانات المورد');
    const html = `<article class="supplier-doc-paper supplier-doc-statement">
      ${docHeader('كشف حساب مورد', `#${state.supplierId}`, statementPeriodLabel(model))}
      <div class="supplier-doc-heading"><span>الحسابات المالية</span><h2>كشف حساب المورد</h2><p>${escapeHtml(statementPeriodLabel(model))}</p></div>
      ${docDetails([['اسم المورد', state.supplier.name], ['رقم الجوال', state.supplier.phone || '—']])}
      ${summaryTiles(model)}
      ${ledgerTableHtml(model)}
      <p class="supplier-doc-disclaimer">المدين: فواتير المورد. الدائن: الدفعات المصروفة له. يظهر رصيد أول الفترة عند تطبيق فلتر التواريخ.</p>
      ${docFooter()}</article>`;
    return { type: 'statement', title: 'كشف حساب المورد', filename: `supplier-statement-${state.supplierId}-${today()}.pdf`, html };
  }
  function openDocument(doc) {
    if (!doc || !el.documentModal || !el.documentContent) return;
    state.document = doc;
    el.documentTitle.textContent = doc.title;
    el.documentContent.innerHTML = doc.html;
    el.documentModal.classList.add('active');
    el.documentModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('supplier-document-open');
  }
  function closeDocument() {
    if (state.documentBusy) return;
    el.documentModal?.classList.remove('active');
    el.documentModal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('supplier-document-open');
    state.document = null;
    if (el.printRoot) el.printRoot.innerHTML = '';
  }
  function documentFor(type, id) {
    if (!state.supplier) throw new Error('ملف المورد غير متاح');
    if (type === 'statement') return statementDocument();
    if (type === 'invoice') {
      if (!state.invoicesReady) throw new Error('الفواتير غير محملة');
      const entry = state.invoices.find(x => Number(x.id) === Number(id));
      if (!entry) throw new Error('الفاتورة غير موجودة');
      return invoiceDocument(entry);
    }
    if (!state.paymentsReady) throw new Error('الدفعات غير محملة');
    const entry = state.payments.find(x => Number(x.id) === Number(id));
    if (!entry) throw new Error('الدفعة غير موجودة');
    return paymentDocument(entry);
  }
  function printDocument() {
    const doc = state.document;
    if (!doc || !el.printRoot) return;
    el.printRoot.innerHTML = doc.html;
    window.print();
  }
  function pdfAvailable() {
    if (typeof window.html2pdf !== 'function') {
      toast('تعذر تحميل مكتبة PDF. استخدم طباعة ثم اختر حفظ كـ PDF من المتصفح.', 'warning');
      return false;
    }
    return true;
  }
  async function makePdf(doc) {
    if (!pdfAvailable()) return null;
    const paper = el.documentContent?.querySelector('.supplier-doc-paper');
    if (!paper) throw new Error('محتوى المستند غير متاح');
    // Clone at a printable A4 width so mobile preview never becomes a narrow PDF.
    const clone = paper.cloneNode(true);
    const mount = document.createElement('div');
    mount.className = 'supplier-pdf-mount';
    mount.appendChild(clone);
    document.body.appendChild(mount);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const images = [...clone.querySelectorAll('img')];
      await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve; img.onerror = resolve;
      })));
      return await window.html2pdf().set({
        margin: [10, 9, 10, 9], filename: doc.filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.supplier-doc-section', '.supplier-doc-total', '.supplier-doc-amount', '.supplier-ledger-tile'] }
      }).from(clone).outputPdf('blob');
    } finally { mount.remove(); }
  }
  function downloadPdf(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function pdfAction(share = false) {
    if (!state.document || state.documentBusy) return;
    if (!pdfAvailable()) return;
    const doc = state.document;
    state.documentBusy = true;
    const buttons = [...el.documentModal.querySelectorAll('[data-supplier-doc]')];
    buttons.forEach(b => { if (b.dataset.supplierDoc !== 'close') b.disabled = true; });
    try {
      const blob = await makePdf(doc);
      if (!blob) return;
      if (share && typeof File === 'function' && typeof navigator.share === 'function') {
        const file = new File([blob], doc.filename, { type: 'application/pdf' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ title: doc.title, files: [file] }); return; }
          catch (err) { if (err.name === 'AbortError') return; }
        }
      }
      downloadPdf(blob, doc.filename);
      toast(share ? 'تم تنزيل PDF. يمكنك إرساله من جهازك؛ مشاركة الملفات المباشرة غير متاحة هنا.' : 'تم تنزيل ملف PDF', 'success');
    } catch (err) {
      console.error('supplier PDF error', err);
      toast('تعذر إنشاء PDF. استخدم زر الطباعة ثم اختر حفظ كـ PDF.', 'error');
    } finally {
      state.documentBusy = false;
      buttons.forEach(b => { b.disabled = false; });
    }
  }
  function handleDocumentAction(type, id, action) {
    try {
      openDocument(documentFor(type, id));
      if (action === 'print') printDocument();
      if (action === 'pdf') pdfAction(false);
      if (action === 'share') pdfAction(true);
    } catch (err) { toast(err.message || 'تعذر عرض المستند', 'error'); }
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

  function bindStatementActions() {
    document.getElementById('supplierStatementReset')?.addEventListener('click', () => {
      state.statementFrom = ''; state.statementTo = '';
      document.getElementById('tab-statement').innerHTML = renderStatement();
      bindStatementActions();
    });
    document.getElementById('supplierStatementApply')?.addEventListener('click', () => {
      const from = document.getElementById('supplierStatementFrom')?.value || '';
      const to = document.getElementById('supplierStatementTo')?.value || '';
      if (from && to && from > to) { toast('تاريخ البداية يجب أن يسبق تاريخ النهاية', 'warning'); return; }
      state.statementFrom = from; state.statementTo = to;
      document.getElementById('tab-statement').innerHTML = renderStatement();
      bindStatementActions();
    });
    document.querySelectorAll('[data-doc-statement]').forEach(button => {
      button.addEventListener('click', () => handleDocumentAction('statement', null, button.dataset.docStatement));
    });
  }

  function bindRenderedEvents() {
    bindStatementActions();
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

  function bindDocuments() {
    el.content?.addEventListener('click', event => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const match = /^(view|print|share)-(invoice|payment)$/.exec(btn.dataset.action);
      if (!match) return;
      const card = btn.closest(match[2] === 'invoice' ? '[data-invoice-id]' : '[data-payment-id]');
      const id = Number(card?.dataset[match[2] === 'invoice' ? 'invoiceId' : 'paymentId']);
      if (id > 0) handleDocumentAction(match[2], id, match[1]);
    });
    el.documentModal?.addEventListener('click', event => {
      const btn = event.target.closest('[data-supplier-doc]');
      if (!btn) return;
      const action = btn.dataset.supplierDoc;
      if (action === 'close') closeDocument();
      else if (action === 'print') printDocument();
      else if (action === 'pdf') pdfAction(false);
      else if (action === 'share') pdfAction(true);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && el.documentModal?.classList.contains('active')) closeDocument();
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
    bindDocuments();

    await Promise.all([
      loadPaymentMethods(),
      loadData()
    ]);
  }

  init();
});