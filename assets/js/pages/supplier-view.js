// assets/js/pages/supplier-view.js
document.addEventListener("DOMContentLoaded", function () {
  let currentSupplier = null;
  let currentInvoices = [];
  let currentPayments = [];
  let editingInvoiceId = null;
  let editingPaymentId = null;

  function init() {
    const params = new URLSearchParams(window.location.search);
    const supplierId = parseInt(params.get("id"));

    if (!supplierId) {
      const container = document.getElementById("supplierViewContent");
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-truck"></i>
            <h4>معرف المورد غير صحيح</h4>
            <p>يرجى العودة إلى صفحة الموردين واختيار مورد صحيح.</p>
            <button class="btn btn-primary" onclick="window.location.href='suppliers.html'">العودة للموردين</button>
          </div>
        `;
      }
      return;
    }

    if (!window.API) {
      setTimeout(init, 200);
      return;
    }

    currentSupplier = window.API.getSupplier(supplierId);
    if (!currentSupplier) {
      const container = document.getElementById("supplierViewContent");
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-truck"></i>
            <h4>المورد غير موجود</h4>
            <p>لم يتم العثور على مورد بهذا المعرف.</p>
            <button class="btn btn-primary" onclick="window.location.href='suppliers.html'">العودة للموردين</button>
          </div>
        `;
      }
      return;
    }

    currentInvoices = window.API.getSupplierInvoices(supplierId) || [];
    currentPayments = window.API.getSupplierPayments(supplierId) || [];
    renderSupplierProfile();
  }

  function buildStatement(invoices, payments) {
    const statement = [];
    invoices.forEach((inv) => {
      statement.push({
        date: inv.date,
        description: `فاتورة #${inv.id} - ${inv.notes || "فاتورة"}`,
        debit: inv.total,
        credit: 0,
        id: inv.id,
        type: "invoice",
      });
    });
    payments.forEach((p) => {
      statement.push({
        date: p.date,
        description: `دفعة (${p.method}) - ${p.notes || ""}`,
        debit: 0,
        credit: p.amount,
        id: p.id,
        type: "payment",
      });
    });

    statement.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    return statement.map((row) => {
      runningBalance += (row.debit || 0) - (row.credit || 0);
      return { ...row, balance: runningBalance };
    });
  }

  function renderSupplierProfile() {
    const container = document.getElementById("supplierViewContent");
    if (!container || !currentSupplier) return;

    const statement = buildStatement(currentInvoices, currentPayments);

    container.innerHTML = `
      <div class="supplier-profile-header">
        <div class="avatar">${currentSupplier.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)}</div>
        <div class="info">
          <div class="name">${currentSupplier.name}</div>
          <div class="phone">${currentSupplier.phone}</div>
          <div class="category"><i class="fas fa-tag" style="margin-left:4px;"></i> ${currentSupplier.category || "بدون تصنيف"}</div>
        </div>
        <div class="status-badge">
          <span class="badge ${currentSupplier.balance > 0 ? "badge-danger" : "badge-success"}">
            ${currentSupplier.balance > 0 ? `مستحق ${window.API.formatCurrency(currentSupplier.balance)}` : "مسدد بالكامل"}
          </span>
        </div>
      </div>

      <div class="profile-summary">
        <div class="stat">
          <span class="label">إجمالي الفواتير</span>
          <span class="value">${window.API.formatCurrency(currentSupplier.totalInvoices)}</span>
        </div>
        <div class="stat">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">${window.API.formatCurrency(currentSupplier.totalPaid)}</span>
        </div>
        <div class="stat">
          <span class="label">المستحق</span>
          <span class="value ${currentSupplier.balance > 0 ? "danger" : "success"}">${window.API.formatCurrency(currentSupplier.balance)}</span>
        </div>
      </div>

      <div class="tabs" id="profileTabs">
        <div class="tab active" data-tab="invoices">الفواتير</div>
        <div class="tab" data-tab="payments">المدفوعات</div>
        <div class="tab" data-tab="statement">كشف الحساب</div>
      </div>

      <div class="tab-content active" id="tab-invoices">
        ${renderInvoices()}
      </div>
      <div class="tab-content" id="tab-payments">
        ${renderPayments()}
      </div>
      <div class="tab-content" id="tab-statement">
        ${renderStatement(statement)}
      </div>
    `;

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", function () {
        document
          .querySelectorAll(".tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".tab-content")
          .forEach((tc) => tc.classList.remove("active"));
        this.classList.add("active");
        const target = document.getElementById("tab-" + this.dataset.tab);
        if (target) target.classList.add("active");
      });
    });

    attachEventListeners();
  }

  function renderInvoices() {
    if (!currentInvoices || currentInvoices.length === 0) {
      return `<div class="empty-state"><i class="fas fa-file-invoice"></i><h4>لا توجد فواتير</h4></div>`;
    }

    return currentInvoices
      .map(
        (inv) => `
      <div class="invoice-item" data-id="${inv.id}">
        <div class="info">
          <div class="title">${inv.notes || "فاتورة"}</div>
          <div class="sub">${inv.date} · المبلغ: ${window.API.formatCurrency(inv.total)}</div>
        </div>
        <div class="amount negative">${window.API.formatCurrency(inv.total)}</div>
        <div style="font-size:12px;color:var(--text-muted);">مدفوع ${window.API.formatCurrency(inv.paid)}</div>
        ${inv.remaining > 0 ? `<div style="font-size:12px;color:var(--danger);font-weight:700;">متبقي ${window.API.formatCurrency(inv.remaining)}</div>` : ""}
        <div class="actions" style="display:flex;gap:8px;align-items:center;">
          <button class="btn-icon-sm btn-icon-primary" data-action="editInvoice" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="btn-icon-sm btn-icon-danger" data-action="deleteInvoice" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderPayments() {
    if (!currentPayments || currentPayments.length === 0) {
      return `<div class="empty-state"><i class="fas fa-hand-holding-dollar"></i><h4>لا توجد مدفوعات</h4></div>`;
    }

    return currentPayments
      .map(
        (p) => `
      <div class="payment-item" data-id="${p.id}">
        <div class="info">
          <div class="title">دفعة (${p.method})</div>
          <div class="sub">${p.date} · ${p.notes || "بدون ملاحظات"}</div>
        </div>
        <div class="amount positive">+${window.API.formatCurrency(p.amount)}</div>
        <div class="actions" style="display:flex;gap:8px;align-items:center;">
          <button class="btn-icon-sm btn-icon-primary" data-action="editPayment" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="btn-icon-sm btn-icon-danger" data-action="deletePayment" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderStatement(statement) {
    if (!statement || statement.length === 0) {
      return `<div class="empty-state"><i class="fas fa-receipt"></i><h4>لا توجد حركات</h4></div>`;
    }

    return statement
      .map(
        (row) => `
      <div class="statement-item">
        <div class="desc">
          <span style="font-weight:500;">${row.description}</span>
          <span style="color:var(--text-muted);font-size:12px;margin-right:8px;">${row.date}</span>
        </div>
        ${row.debit > 0 ? `<span class="debit">${window.API.formatCurrency(row.debit)}</span>` : `<span class="credit">${window.API.formatCurrency(row.credit)}</span>`}
        <span class="balance">${window.API.formatCurrency(row.balance)}</span>
      </div>
    `,
      )
      .join("");
  }

  function setSupplierTransactionMode(mode) {
    const invoiceTab = document.getElementById("supplierInvoiceMode");
    const paymentTab = document.getElementById("supplierPaymentMode");
    const buttons = document.querySelectorAll(".switch-btn");
    const title = document.getElementById("supplierTransactionModalTitle");
    const saveBtn = document.getElementById("supplierTransactionSaveBtn");

    const isPayment = mode === "payment";
    if (invoiceTab) invoiceTab.style.display = isPayment ? "none" : "block";
    if (paymentTab) paymentTab.style.display = isPayment ? "block" : "none";

    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
    });

    if (title) {
      title.textContent = isPayment
        ? editingPaymentId
          ? "تعديل الدفعة"
          : "تسجيل دفعة"
        : editingInvoiceId
          ? "تعديل الفاتورة"
          : "فاتورة جديدة";
    }

    if (saveBtn) {
      saveBtn.textContent = isPayment
        ? editingPaymentId
          ? "تحديث الدفعة"
          : "تسجيل الدفعة"
        : editingInvoiceId
          ? "تحديث الفاتورة"
          : "حفظ الفاتورة";
    }
  }

  window.setSupplierTransactionMode = function (mode) {
    setSupplierTransactionMode(mode);
  };

  document.querySelectorAll(".switch-btn").forEach((button) => {
    button.addEventListener("click", function () {
      setSupplierTransactionMode(this.dataset.mode || "invoice");
    });
  });

  function attachEventListeners() {
    const container = document.getElementById("supplierViewContent");
    if (!container) return;

    container.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const invoiceItem = btn.closest(".invoice-item");
      const paymentItem = btn.closest(".payment-item");

      if (action === "editInvoice" && invoiceItem) {
        openEditInvoiceModal(parseInt(invoiceItem.dataset.id));
      } else if (action === "deleteInvoice" && invoiceItem) {
        handleDeleteInvoice(parseInt(invoiceItem.dataset.id));
      } else if (action === "editPayment" && paymentItem) {
        openEditPaymentModal(parseInt(paymentItem.dataset.id));
      } else if (action === "deletePayment" && paymentItem) {
        handleDeletePayment(parseInt(paymentItem.dataset.id));
      }
    });
  }

  function handleDeleteInvoice(id) {
    const invoice = currentInvoices.find((inv) => inv.id === id);
    if (!invoice) return;

    showConfirm({
      title: "حذف الفاتورة",
      message: `هل أنت متأكد من حذف الفاتورة رقم ${invoice.id}؟`,
      confirmText: "حذف",
      danger: true,
      onConfirm: function () {
        try {
          if (window.API.deleteSupplierInvoice) {
            window.API.deleteSupplierInvoice(id);
          } else {
            const idx = currentInvoices.findIndex((inv) => inv.id === id);
            if (idx !== -1) currentInvoices.splice(idx, 1);
          }
          showToast("تم حذف الفاتورة بنجاح", "success");
          refreshData();
        } catch (err) {
          showToast(err.message || "حدث خطأ أثناء الحذف", "error");
        }
      },
    });
  }

  function handleDeletePayment(id) {
    const payment = currentPayments.find((p) => p.id === id);
    if (!payment) return;

    showConfirm({
      title: "حذف الدفعة",
      message: `هل أنت متأكد من حذف الدفعة بقيمة ${window.API.formatCurrency(payment.amount)}؟`,
      confirmText: "حذف",
      danger: true,
      onConfirm: function () {
        try {
          if (window.API.deleteSupplierPayment) {
            window.API.deleteSupplierPayment(id);
          } else {
            const idx = currentPayments.findIndex((p) => p.id === id);
            if (idx !== -1) currentPayments.splice(idx, 1);
          }
          showToast("تم حذف الدفعة بنجاح", "success");
          refreshData();
        } catch (err) {
          showToast(err.message || "حدث خطأ أثناء الحذف", "error");
        }
      },
    });
  }

  function openEditInvoiceModal(id) {
    const invoice = currentInvoices.find((inv) => inv.id === id);
    if (!invoice) return;

    editingInvoiceId = id;
    editingPaymentId = null;
    const title = document.getElementById("supplierTransactionModalTitle");
    const saveBtn = document.getElementById("supplierTransactionSaveBtn");
    if (title) title.textContent = "تعديل الفاتورة";
    if (saveBtn) saveBtn.textContent = "تحديث الفاتورة";

    document.getElementById("supplierInvoiceCustomerName").textContent =
      currentSupplier.name;
    document.getElementById("supplierInvoiceCustomerPhone").textContent =
      currentSupplier.phone;
    document.getElementById("supplierInvoiceDate").value = invoice.date || "";
    document.getElementById("supplierInvoiceTotal").value = invoice.total || 0;
    document.getElementById("supplierInvoicePaid").value = invoice.paid || 0;
    document.getElementById("supplierInvoiceNotes").value = invoice.notes || "";

    if (typeof setSupplierTransactionMode === "function")
      setSupplierTransactionMode("invoice");
    openModal("supplierTransactionModal");
  }

  function openEditPaymentModal(id) {
    const payment = currentPayments.find((p) => p.id === id);
    if (!payment) return;

    editingPaymentId = id;
    editingInvoiceId = null;
    const title = document.getElementById("supplierTransactionModalTitle");
    const saveBtn = document.getElementById("supplierTransactionSaveBtn");
    if (title) title.textContent = "تعديل الدفعة";
    if (saveBtn) saveBtn.textContent = "تحديث الدفعة";

    document.getElementById("supplierPaymentCustomerName").textContent =
      currentSupplier.name;
    document.getElementById("supplierPaymentCustomerPhone").textContent =
      currentSupplier.phone;
    document.getElementById("supplierPaymentCurrentBalance").textContent =
      window.API.formatCurrency(currentSupplier.balance || 0);
    document.getElementById("supplierPaymentAmount").value =
      payment.amount || 0;
    document.getElementById("supplierPaymentNotes").value = payment.notes || "";
    const methodInput = document.querySelector(
      `input[name="supplierPaymentMethod"][value="${payment.method || "نقدي"}"]`,
    );
    if (methodInput) methodInput.checked = true;

    if (typeof setSupplierTransactionMode === "function")
      setSupplierTransactionMode("payment");
    updateSupplierPaymentPreview();
    openModal("supplierTransactionModal");
  }

  function refreshData() {
    if (!currentSupplier) return;
    currentInvoices = window.API.getSupplierInvoices(currentSupplier.id) || [];
    currentPayments = window.API.getSupplierPayments(currentSupplier.id) || [];
    currentSupplier = window.API.getSupplier(currentSupplier.id);
    renderSupplierProfile();
  }

  function saveInvoice() {
    const date = document.getElementById("supplierInvoiceDate").value;
    const total =
      parseFloat(document.getElementById("supplierInvoiceTotal").value) || 0;
    const paid =
      parseFloat(document.getElementById("supplierInvoicePaid").value) || 0;
    const notes = document.getElementById("supplierInvoiceNotes").value.trim();

    if (!date) {
      showToast("يرجى تحديد تاريخ الفاتورة", "warning");
      return;
    }
    if (total <= 0) {
      showToast("يرجى إدخال إجمالي صحيح للفاتورة", "warning");
      return;
    }

    try {
      const payload = { date, total, paid, notes };
      if (editingInvoiceId) {
        window.API.updateSupplierInvoice(editingInvoiceId, payload);
        showToast("تم تحديث الفاتورة بنجاح", "success");
      } else {
        window.API.addSupplierInvoice(currentSupplier.id, payload);
        showToast("تم إضافة الفاتورة بنجاح", "success");
      }

      closeModal("supplierTransactionModal");
      editingInvoiceId = null;
      refreshData();
    } catch (err) {
      showToast(err.message || "حدث خطأ أثناء حفظ الفاتورة", "error");
    }
  }

  function savePaymentFromModal() {
    const amount =
      parseFloat(document.getElementById("supplierPaymentAmount").value) || 0;
    const method =
      document.querySelector('input[name="supplierPaymentMethod"]:checked')
        ?.value || "نقدي";
    const notes = document.getElementById("supplierPaymentNotes").value.trim();

    if (!amount || amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }

    try {
      if (editingPaymentId) {
        window.API.updateSupplierPayment(editingPaymentId, {
          amount,
          method,
          notes,
        });
        showToast("تم تحديث الدفعة بنجاح", "success");
      } else {
        if (amount > (currentSupplier.balance || 0)) {
          showToast(
            `المبلغ يتجاوز المستحق (${window.API.formatCurrency(currentSupplier.balance || 0)})`,
            "error",
          );
          return;
        }
        window.API.addSupplierPayment(
          currentSupplier.id,
          amount,
          method,
          notes,
        );
        showToast(
          `تم تسجيل دفعة بقيمة ${window.API.formatCurrency(amount)}`,
          "success",
        );
      }

      closeModal("supplierTransactionModal");
      editingPaymentId = null;
      document.getElementById("supplierTransactionSaveBtn").textContent =
        "حفظ الفاتورة";
      refreshData();
    } catch (err) {
      showToast(err.message || "حدث خطأ أثناء حفظ الدفعة", "error");
    }
  }

  function updateSupplierPaymentPreview() {
    const amount =
      parseFloat(document.getElementById("supplierPaymentAmount").value) || 0;
    const before = currentSupplier ? currentSupplier.balance : 0;
    const after = Math.max(0, before - amount);
    const afterEl = document.getElementById("supplierPaymentAfterBalance");
    if (afterEl) afterEl.textContent = window.API.formatCurrency(after);
    const currentBalance = document.getElementById(
      "supplierPaymentCurrentBalance",
    );
    if (currentBalance)
      currentBalance.textContent = window.API.formatCurrency(before);
  }

  document.addEventListener("click", function (e) {
    const targetId = e.target && e.target.id;

    if (targetId === "supplierTransactionSaveBtn") {
      const activeMode =
        document.querySelector(".switch-btn.active")?.dataset.mode || "invoice";
      if (activeMode === "payment") {
        savePaymentFromModal();
      } else {
        saveInvoice();
      }
    }

    if (targetId === "fab" && currentSupplier) {
      editingInvoiceId = null;
      editingPaymentId = null;
      const title = document.getElementById("supplierTransactionModalTitle");
      const saveBtn = document.getElementById("supplierTransactionSaveBtn");
      if (title) title.textContent = "فاتورة جديدة";
      if (saveBtn) saveBtn.textContent = "حفظ الفاتورة";

      document.getElementById("supplierInvoiceCustomerName").textContent =
        currentSupplier.name;
      document.getElementById("supplierInvoiceCustomerPhone").textContent =
        currentSupplier.phone;
      document.getElementById("supplierInvoiceDate").value = new Date()
        .toISOString()
        .slice(0, 10);
      document.getElementById("supplierInvoiceTotal").value = "";
      document.getElementById("supplierInvoicePaid").value = "";
      document.getElementById("supplierInvoiceNotes").value = "";

      document.getElementById("supplierPaymentCustomerName").textContent =
        currentSupplier.name;
      document.getElementById("supplierPaymentCustomerPhone").textContent =
        currentSupplier.phone;
      document.getElementById("supplierPaymentCurrentBalance").textContent =
        window.API.formatCurrency(currentSupplier.balance || 0);
      document.getElementById("supplierPaymentAmount").value = "";
      document.getElementById("supplierPaymentNotes").value = "";
      const defaultMethod = document.querySelector(
        'input[name="supplierPaymentMethod"][value="نقدي"]',
      );
      if (defaultMethod) defaultMethod.checked = true;
      updateSupplierPaymentPreview();
      if (typeof setSupplierTransactionMode === "function")
        setSupplierTransactionMode("invoice");
      openModal("supplierTransactionModal");
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "supplierPaymentAmount") {
      updateSupplierPaymentPreview();
    }
  });

  document.addEventListener("fab:modal:opened", function (e) {
    if (e.detail.modalId === "supplierTransactionModal" && currentSupplier) {
      editingInvoiceId = null;
      editingPaymentId = null;
      const title = document.getElementById("supplierTransactionModalTitle");
      const saveBtn = document.getElementById("supplierTransactionSaveBtn");
      if (title) title.textContent = "فاتورة جديدة";
      if (saveBtn) saveBtn.textContent = "حفظ الفاتورة";

      document.getElementById("supplierInvoiceCustomerName").textContent =
        currentSupplier.name;
      document.getElementById("supplierInvoiceCustomerPhone").textContent =
        currentSupplier.phone;
      document.getElementById("supplierInvoiceDate").value = new Date()
        .toISOString()
        .slice(0, 10);
      document.getElementById("supplierInvoiceTotal").value = "";
      document.getElementById("supplierInvoicePaid").value = "";
      document.getElementById("supplierInvoiceNotes").value = "";

      document.getElementById("supplierPaymentCustomerName").textContent =
        currentSupplier.name;
      document.getElementById("supplierPaymentCustomerPhone").textContent =
        currentSupplier.phone;
      document.getElementById("supplierPaymentCurrentBalance").textContent =
        window.API.formatCurrency(currentSupplier.balance || 0);
      document.getElementById("supplierPaymentAmount").value = "";
      document.getElementById("supplierPaymentNotes").value = "";
      const defaultMethod = document.querySelector(
        'input[name="supplierPaymentMethod"][value="نقدي"]',
      );
      if (defaultMethod) defaultMethod.checked = true;
      updateSupplierPaymentPreview();
      if (typeof setSupplierTransactionMode === "function")
        setSupplierTransactionMode("invoice");
    }
  });

  if (window.layoutReady) {
    init();
  } else {
    document.addEventListener("layout:ready", init);
  }
});
