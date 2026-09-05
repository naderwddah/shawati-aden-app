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
    saving: false
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
    return new Date().toISOString().slice(0, 10);
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

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 16);
    }

    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);

    return local.toISOString().slice(0, 16);
  }

  function accountTotals() {
    const invoices = state.invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );

    const payments = state.payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    return {
      invoices,
      payments,
      balance: invoices - payments
    };
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
    el.content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <h4>جاري تحميل ملف المورد</h4>
        <p>يرجى الانتظار...</p>
      </div>
    `;

    try {
      const [
        supplier,
        invoices,
        payments,
        statement
      ] = await Promise.all([
        API.getSupplier(state.supplierId),
        API.getSupplierInvoices({ supplier_id: state.supplierId }),
        API.getSupplierPayments({ supplier_id: state.supplierId }),
        API.getSupplierStatement(state.supplierId)
      ]);

      state.supplier = supplier;
      state.invoices = Array.isArray(invoices)
        ? invoices
        : [];

      state.payments = Array.isArray(payments)
        ? payments
        : [];

      state.statement = Array.isArray(statement?.transactions)
        ? statement.transactions
        : Array.isArray(statement)
          ? statement
          : [];

      render();
    } catch (error) {
      console.error(error);

      el.content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-triangle-exclamation"></i>
          <h4>تعذر تحميل المورد</h4>
          <p>${escapeHtml(error?.message || 'حدث خطأ')}</p>
          <button class="btn btn-primary" id="backToSuppliers">
            العودة للموردين
          </button>
        </div>
      `;

      document
        .getElementById('backToSuppliers')
        ?.addEventListener('click', () => {
          location.href = 'suppliers.html';
        });
    }
  }

  function render() {
    if (!state.supplier) return;

    const totals = accountTotals();
    const balance = totals.balance;

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

        <div class="balance-badge ${balance > 0 ? 'due' : 'clear'}">
          ${
            balance > 0
              ? `مستحق ${currency(balance)}`
              : 'الحساب مسدد'
          }
        </div>

      </div>

      <div class="summary-grid">

        <div class="summary-card">
          <span class="label">إجمالي الفواتير</span>
          <span class="value">
            ${currency(totals.invoices)}
          </span>
        </div>

        <div class="summary-card">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">
            ${currency(totals.payments)}
          </span>
        </div>

        <div class="summary-card">
          <span class="label">المستحق</span>
          <span class="value ${balance > 0 ? 'danger' : 'success'}">
            ${currency(Math.max(balance, 0))}
          </span>
        </div>

      </div>

      <div class="tabs">

        <button class="tab active" data-tab="invoices">
          <i class="fas fa-file-invoice"></i>
          الفواتير
        </button>

        <button class="tab" data-tab="payments">
          <i class="fas fa-money-bill-wave"></i>
          المدفوعات
        </button>

        <button class="tab" data-tab="statement">
          <i class="fas fa-receipt"></i>
          كشف الحساب
        </button>

      </div>

      <div class="tab-content active" id="tab-invoices">
        ${renderInvoices()}
      </div>

      <div class="tab-content" id="tab-payments">
        ${renderPayments()}
      </div>

      <div class="tab-content" id="tab-statement">
        ${renderStatement()}
      </div>
    `;

    bindRenderedEvents();
  }

  function renderInvoices() {
    const invoices = [...state.invoices].sort((a, b) => {
      return new Date(b.invoice_date) - new Date(a.invoice_date);
    });

    if (!invoices.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-file-invoice"></i>
          <h4>لا توجد فواتير</h4>
          <p>يمكنك إضافة أول فاتورة لهذا المورد</p>
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
    const payments = [...state.payments].sort((a, b) => {
      return new Date(b.payment_date) - new Date(a.payment_date);
    });

    if (!payments.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-money-bill-wave"></i>
          <h4>لا توجد مدفوعات</h4>
          <p>يمكنك تسجيل أول دفعة لهذا المورد</p>
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
    if (state.statement.length) {
      return [...state.statement].sort((a, b) => {
        return new Date(
          a.date || a.created_at || a.createdAt
        ) - new Date(
          b.date || b.created_at || b.createdAt
        );
      });
    }

    const rows = [
      ...state.invoices.map(invoice => ({
        type: 'invoice',
        date: invoice.invoice_date,
        description:
          invoice.invoice_number ||
          invoice.details ||
          `فاتورة #${invoice.id}`,
        amount: Number(invoice.total_amount || 0)
      })),

      ...state.payments.map(payment => ({
        type: 'payment',
        date: payment.payment_date,
        description:
          paymentMethodName(payment),
        amount: Number(payment.amount || 0)
      }))
    ];

    return rows.sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
  }

  function renderStatement() {
    const rows = buildStatement();

    if (!rows.length) {
      return `
        <div class="empty-state">
          <i class="fas fa-receipt"></i>
          <h4>كشف الحساب فارغ</h4>
          <p>لا توجد حركات مالية لهذا المورد</p>
        </div>
      `;
    }

    let balance = 0;

    return `
      <div class="section-header">
        <span class="section-title">كشف الحساب</span>
      </div>

      <div class="statement">

        <div class="statement-row statement-head">
          <span>البيان</span>
          <span>مدين</span>
          <span>دائن</span>
          <span>الرصيد</span>
        </div>

        ${rows.map(row => {

          const amount = Math.abs(Number(row.amount || 0));
          const isInvoice =
            row.type === 'invoice' ||
            row.type === 'debit';

          if (isInvoice) {
            balance += amount;
          } else {
            balance -= amount;
          }

          return `
            <div class="statement-row">

              <div>
                <strong>
                  ${escapeHtml(
                    row.description ||
                    row.notes ||
                    (isInvoice ? 'فاتورة' : 'دفعة')
                  )}
                </strong>

                <div style="font-size:11px;color:var(--text-muted)">
                  ${escapeHtml(
                    normalizeDate(
                      row.date ||
                      row.created_at ||
                      row.createdAt
                    )
                  )}
                </div>
              </div>

              ${
                isInvoice
                  ? `<span class="statement-debit">${currency(amount)}</span>`
                  : '<span></span>'
              }

              ${
                !isInvoice
                  ? `<span class="statement-credit">${currency(amount)}</span>`
                  : '<span></span>'
              }

              <span class="statement-balance">
                ${currency(Math.max(balance, 0))}
              </span>

            </div>
          `;
        }).join('')}

      </div>
    `;
  }

  function setMode(mode) {
    state.mode = mode;

    document.querySelectorAll('[data-mode]').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.mode === mode
      );
    });

    el.invoiceForm.style.display =
      mode === 'invoice' ? 'block' : 'none';

    el.paymentForm.style.display =
      mode === 'payment' ? 'block' : 'none';

    if (state.editingInvoiceId) {
      el.modalTitle.textContent = 'تعديل الفاتورة';
      el.save.textContent = 'تحديث الفاتورة';
    } else if (state.editingPaymentId) {
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

  function closeModal() {
    el.modal.classList.remove('active');
    document.body.style.overflow = '';

    state.editingInvoiceId = null;
    state.editingPaymentId = null;
    state.saving = false;
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

      closeModal();
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
        supplier_id: state.supplierId,
        amount: Number(amount.toFixed(2)),
        payment_method_id: methodId,
        payment_date: date,
        notes: notes || null
      };

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

      closeModal();
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
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {

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
    el.fab?.addEventListener('click', () => {
      openModal('invoice');
    });

    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        setMode(button.dataset.mode);
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
      if (event.detail?.modalId === 'transactionModal') {
        openModal('invoice');
      }
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