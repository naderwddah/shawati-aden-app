// ============================================================
// assets/js/pages/customer-view.js
// ملف العميل – عرض الفواتير والمدفوعات، إضافة/تعديل/حذف، تصدير
// يتحكم بالكامل بـ transactionModal (تبويبات: حجز / دفعة)
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  let currentCustomer = null;
  let currentBookings = [];
  let currentPayments = [];
  let allItems = [];
  let editingBookingId = null;
  let editingPaymentId = null;
  let isEditMode = false;

  // ============================================================
  // 1. تحميل البيانات وعرضها
  // ============================================================
  function loadCustomerData() {
    const params = new URLSearchParams(window.location.search);
    const customerId = parseInt(params.get("id"));

    if (!customerId) {
      showEmptyState(
        "معرف العميل غير صحيح",
        "يرجى العودة إلى صفحة العملاء واختيار عميل صحيح.",
      );
      return;
    }

    if (!window.API) {
      setTimeout(loadCustomerData, 200);
      return;
    }

    currentCustomer = window.API.getCustomer(customerId);
    if (!currentCustomer) {
      showEmptyState("العميل غير موجود", "لم يتم العثور على عميل بهذا المعرف.");
      return;
    }

    currentBookings = window.API.getCustomerInvoices(customerId) || [];
    currentPayments = window.API.getCustomerPayments(customerId) || [];
    allItems = window.API.getItems() || [];

    renderCustomerProfile();
  }

  function showEmptyState(title, message) {
    const container = document.getElementById("customerViewContent");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <h4>${title}</h4>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="window.location.href='customers.html'">العودة للعملاء</button>
        </div>
      `;
    }
  }

  // ============================================================
  // 2. عرض ملف العميل
  // ============================================================
  function renderCustomerProfile() {
    const container = document.getElementById("customerViewContent");
    if (!container || !currentCustomer) return;

    const statement = buildStatement(currentBookings, currentPayments);

    container.innerHTML = `
      <div class="customer-profile-header">
        <div class="avatar">${getInitials(currentCustomer.name)}</div>
        <div class="info">
          <div class="name">${currentCustomer.name}</div>
          <div class="phone">${currentCustomer.phone}</div>
          <div class="address"><i class="fas fa-location-dot" style="margin-left:4px;"></i> ${currentCustomer.address || "لا يوجد عنوان"}</div>
        </div>
        <div class="status-badge">
          <span class="badge ${currentCustomer.balance > 0 ? "badge-danger" : "badge-success"}">
            ${currentCustomer.balance > 0 ? `متبقي ${window.API.formatCurrency(currentCustomer.balance)}` : "مسدد بالكامل"}
          </span>
        </div>
      </div>

      <div class="profile-summary">
        <div class="stat">
          <span class="label">إجمالي الفواتير</span>
          <span class="value">${window.API.formatCurrency(currentCustomer.totalInvoices)}</span>
        </div>
        <div class="stat">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">${window.API.formatCurrency(currentCustomer.totalPaid)}</span>
        </div>
        <div class="stat">
          <span class="label">المتبقي</span>
          <span class="value ${currentCustomer.balance > 0 ? "danger" : "success"}">${window.API.formatCurrency(currentCustomer.balance)}</span>
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

    // تفعيل التبويبات
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

  // ============================================================
  // 3. دوال مساعدة
  // ============================================================
  function getInitials(name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2);
  }

  function buildStatement(bookings, payments) {
    const statement = [];
    bookings.forEach((inv) => {
      statement.push({
        date: inv.eventDate || inv.date,
        description: `فاتورة #${inv.id} - ${inv.notes || "وليمة"}`,
        debit: inv.total,
        credit: 0,
        id: inv.id,
        type: "booking",
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

  // ============================================================
  // 4. عرض الفواتير (محسّن)
  // ============================================================
  function renderInvoices() {
    if (!currentBookings || currentBookings.length === 0) {
      return `<div class="empty-state"><i class="fas fa-file-invoice"></i><h4>لا توجد فواتير</h4></div>`;
    }
    return currentBookings
      .map(
        (inv) => `
      <div class="invoice-item" data-id="${inv.id}">
        <div class="info">
          <div class="title">${inv.notes || "وليمة"}</div>
          <div class="sub">
            <span>📅 ${inv.eventDate}</span>
            <span>👥 ${inv.guests || 0} ضيف</span>
            <span>📌 ${inv.status || "جديد"}</span>
          </div>
          ${inv.items ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${inv.items.map((i) => i.name + " (x" + i.qty + ")").join(" • ")}</div>` : ""}
        </div>
        <div class="amount-section">
          <span class="total">${window.API.formatCurrency(inv.total)}</span>
          <span class="paid">مدفوع ${window.API.formatCurrency(inv.paid)}</span>
          ${inv.remaining > 0 ? `<span class="remaining">متبقي ${window.API.formatCurrency(inv.remaining)}</span>` : ""}
        </div>
        <div class="actions">
          <button class="btn-icon-sm btn-icon-primary" data-action="editBooking" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="btn-icon-sm btn-icon-danger" data-action="deleteBooking" title="حذف"><i class="fas fa-trash"></i></button>
          <button class="btn-icon-sm" data-action="exportBooking" title="تصدير"><i class="fas fa-file-pdf"></i></button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ============================================================
  // 5. عرض المدفوعات (محسّن)
  // ============================================================
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
          <div class="sub">📅 ${p.date} ${p.notes ? `• ${p.notes}` : ""}</div>
        </div>
        <div class="amount">+${window.API.formatCurrency(p.amount)}</div>
        <div class="actions">
          <button class="btn-icon-sm btn-icon-primary" data-action="editPayment" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="btn-icon-sm btn-icon-danger" data-action="deletePayment" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ============================================================
  // 6. عرض كشف الحساب (محسّن)
  // ============================================================
  function renderStatement(statement) {
    if (!statement || statement.length === 0) {
      return `<div class="empty-state"><i class="fas fa-receipt"></i><h4>لا توجد حركات</h4></div>`;
    }
    let html = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-3);">
        <button class="btn btn-sm btn-secondary" id="exportStatementBtn"><i class="fas fa-file-pdf"></i> تصدير كشف الحساب</button>
      </div>
    `;
    html += statement
      .map(
        (row) => `
      <div class="statement-item">
        <div class="desc">
          <span style="font-weight:500;">${row.description}</span>
          <span class="date">${row.date}</span>
        </div>
        ${row.debit > 0 ? `<span class="debit">${window.API.formatCurrency(row.debit)}</span>` : `<span class="credit">${window.API.formatCurrency(row.credit)}</span>`}
        <span class="balance">${window.API.formatCurrency(row.balance)}</span>
      </div>
    `,
      )
      .join("");
    return html;
  }

  // ============================================================
  // 7. ربط أحداث الأزرار
  // ============================================================
  function attachEventListeners() {
    const container = document.getElementById("customerViewContent");
    if (!container) return;

    container.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "deleteBooking") {
        const item = btn.closest(".invoice-item");
        if (item) handleDeleteBooking(parseInt(item.dataset.id));
      } else if (action === "editBooking") {
        const item = btn.closest(".invoice-item");
        if (item) openEditBookingModal(parseInt(item.dataset.id));
      } else if (action === "exportBooking") {
        const item = btn.closest(".invoice-item");
        if (item) exportBooking(parseInt(item.dataset.id));
      } else if (action === "deletePayment") {
        const item = btn.closest(".payment-item");
        if (item) handleDeletePayment(parseInt(item.dataset.id));
      } else if (action === "editPayment") {
        const item = btn.closest(".payment-item");
        if (item) openEditPaymentModal(parseInt(item.dataset.id));
      } else if (action === "exportStatement") {
        exportStatement();
      }
    });
  }

  // ============================================================
  // 8. عمليات الفواتير (الحجوزات)
  // ============================================================
  function handleDeleteBooking(id) {
    const booking = currentBookings.find((b) => b.id === id);
    if (!booking) return;

    showConfirm({
      title: "حذف الفاتورة",
      message: `هل أنت متأكد من حذف الفاتورة "${booking.notes || "وليمة"}"؟`,
      confirmText: "حذف",
      danger: true,
      onConfirm: function () {
        try {
          if (window.API.deleteBooking) {
            window.API.deleteBooking(id);
          } else {
            const idx = currentBookings.findIndex((b) => b.id === id);
            if (idx !== -1) currentBookings.splice(idx, 1);
          }
          showToast("تم حذف الفاتورة بنجاح", "success");
          refreshData();
        } catch (err) {
          showToast(err.message || "حدث خطأ أثناء الحذف", "error");
        }
      },
    });
  }

  function openEditBookingModal(id) {
    const booking = currentBookings.find((b) => b.id === id);
    if (!booking) {
      showToast("الفاتورة غير موجودة", "error");
      return;
    }
    editingBookingId = id;
    isEditMode = true;
    openTransactionModal("booking", booking);
  }

  function exportBooking(id) {
    const booking = currentBookings.find((b) => b.id === id);
    if (!booking) {
      showToast("الفاتورة غير موجودة", "error");
      return;
    }
    const content = `
      <div style="direction:rtl;font-family:Tajawal,sans-serif;padding:20px;">
        <h2 style="color:#8F1720;">شواطئ عدن</h2>
        <h3>فاتورة #${booking.id}</h3>
        <p><strong>العميل:</strong> ${currentCustomer.name}</p>
        <p><strong>التاريخ:</strong> ${booking.eventDate}</p>
        <p><strong>الوصف:</strong> ${booking.notes || "وليمة"}</p>
        <p><strong>عدد الضيوف:</strong> ${booking.guests || 0}</p>
        ${booking.items ? `<p><strong>الأصناف:</strong> ${booking.items.map((i) => i.name + " (x" + i.qty + ")").join(", ")}</p>` : ""}
        <p><strong>تأمين الصحون:</strong> ${window.API.formatCurrency(booking.platesDeposit || 0)}</p>
        <hr/>
        <p><strong>الإجمالي:</strong> ${window.API.formatCurrency(booking.total)}</p>
        <p><strong>المدفوع:</strong> ${window.API.formatCurrency(booking.paid)}</p>
        <p><strong>المتبقي:</strong> ${window.API.formatCurrency(booking.remaining)}</p>
        <p><strong>طريقة الدفع:</strong> ${booking.paymentMethod || "نقدي"}</p>
        <p><strong>الحالة:</strong> ${booking.status || "جديد"}</p>
      </div>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html><head><title>فاتورة #${booking.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        </head><body>${content}</body></html>
      `);
      win.document.close();
      win.print();
    } else {
      showToast("تعذر فتح نافذة الطباعة", "error");
    }
  }

  // ============================================================
  // 9. عمليات المدفوعات
  // ============================================================
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
          if (window.API.deletePayment) {
            window.API.deletePayment(id);
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

  function openEditPaymentModal(id) {
    const payment = currentPayments.find((p) => p.id === id);
    if (!payment) {
      showToast("الدفعة غير موجودة", "error");
      return;
    }
    editingPaymentId = id;
    isEditMode = true;
    openTransactionModal("payment", payment);
  }

  // ============================================================
  // 10. تصدير كشف الحساب
  // ============================================================
  function exportStatement() {
    const statement = buildStatement(currentBookings, currentPayments);
    if (!statement || statement.length === 0) {
      showToast("لا توجد حركات لتصديرها", "warning");
      return;
    }
    let content = `
      <div style="direction:rtl;font-family:Tajawal,sans-serif;padding:20px;">
        <h2 style="color:#8F1720;">شواطئ عدن</h2>
        <h3>كشف حساب العميل: ${currentCustomer.name}</h3>
        <p>رقم الجوال: ${currentCustomer.phone}</p>
        <hr/>
        <table style="width:100%;border-collapse:collapse;text-align:right;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px;border:1px solid #ddd;">التاريخ</th>
              <th style="padding:8px;border:1px solid #ddd;">البيان</th>
              <th style="padding:8px;border:1px solid #ddd;">مدين</th>
              <th style="padding:8px;border:1px solid #ddd;">دائن</th>
              <th style="padding:8px;border:1px solid #ddd;">الرصيد</th>
            </tr>
          </thead>
          <tbody>
    `;
    statement.forEach((row) => {
      content += `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${row.date}</td>
          <td style="padding:8px;border:1px solid #ddd;">${row.description}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:left;">${row.debit > 0 ? window.API.formatCurrency(row.debit) : "-"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:left;">${row.credit > 0 ? window.API.formatCurrency(row.credit) : "-"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:left;">${window.API.formatCurrency(row.balance)}</td>
        </tr>
      `;
    });
    content += `
          </tbody>
          <tfoot>
            <tr style="background:#f9f9f9;font-weight:bold;">
              <td colspan="4" style="padding:8px;border:1px solid #ddd;">الرصيد الحالي</td>
              <td style="padding:8px;border:1px solid #ddd;">${window.API.formatCurrency(statement[statement.length - 1]?.balance || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html><head><title>كشف حساب ${currentCustomer.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        </head><body>${content}</body></html>
      `);
      win.document.close();
      win.print();
    } else {
      showToast("تعذر فتح نافذة الطباعة", "error");
    }
  }

  // ============================================================
  // 11. تحديث البيانات وإعادة العرض
  // ============================================================
  function refreshData() {
    if (!currentCustomer) return;
    currentBookings = window.API.getCustomerInvoices(currentCustomer.id) || [];
    currentPayments = window.API.getCustomerPayments(currentCustomer.id) || [];
    currentCustomer = window.API.getCustomer(currentCustomer.id);
    renderCustomerProfile();
  }

  // ============================================================
  // 12. فتح مودال المعاملات (يتحكم بهذا الملف بالكامل)
  // ============================================================
  function openTransactionModal(tab, editData) {
    const modal = document.getElementById("transactionModal");
    if (!modal) {
      showToast("المودال غير متوفر", "error");
      return;
    }

    const titleEl = document.getElementById("transactionModalTitle");
    const bookingCustomerName = document.getElementById("bookingCustomerName");
    const bookingCustomerPhone = document.getElementById(
      "bookingCustomerPhone",
    );
    const bookingCustomerAddress = document.getElementById(
      "bookingCustomerAddress",
    );
    const paymentCustomerName = document.getElementById("paymentCustomerName");
    const paymentCustomerPhone = document.getElementById(
      "paymentCustomerPhone",
    );
    const paymentCurrentBalance = document.getElementById(
      "paymentCurrentBalance",
    );

    if (
      !titleEl ||
      !bookingCustomerName ||
      !bookingCustomerPhone ||
      !bookingCustomerAddress ||
      !paymentCustomerName ||
      !paymentCustomerPhone ||
      !paymentCurrentBalance
    ) {
      setTimeout(() => openTransactionModal(tab, editData), 100);
      return;
    }

    const isEditing = !!editData;
    titleEl.textContent = isEditing
      ? tab === "booking"
        ? "تعديل الفاتورة"
        : "تعديل الدفعة"
      : tab === "booking"
        ? "حجز جديد"
        : "تسجيل دفعة";

    bookingCustomerName.textContent = currentCustomer.name;
    bookingCustomerPhone.textContent = currentCustomer.phone;
    bookingCustomerAddress.textContent =
      currentCustomer.address || "لا يوجد عنوان";

    paymentCustomerName.textContent = currentCustomer.name;
    paymentCustomerPhone.textContent = currentCustomer.phone;
    paymentCurrentBalance.textContent = window.API.formatCurrency(
      currentCustomer.balance || 0,
    );

    modal.dataset.entityType = "customer";
    modal.dataset.entityId = currentCustomer.id;

    const bookingDate = document.getElementById("bookingDate");
    const bookingGuests = document.getElementById("bookingGuests");
    const bookingPlatesDeposit = document.getElementById(
      "bookingPlatesDeposit",
    );
    const bookingNotes = document.getElementById("bookingNotes");
    const bookingPaid = document.getElementById("bookingPaid");
    const bookingPaymentMethod = document.getElementById(
      "bookingPaymentMethod",
    );

    if (editData && tab === "booking") {
      if (bookingDate) bookingDate.value = editData.eventDate || "";
      if (bookingGuests) bookingGuests.value = editData.guests || "";
      if (bookingPlatesDeposit)
        bookingPlatesDeposit.value = editData.platesDeposit || "";
      if (bookingNotes) bookingNotes.value = editData.notes || "";
      if (bookingPaid) bookingPaid.value = editData.paid || "";
      if (bookingPaymentMethod)
        bookingPaymentMethod.value = editData.paymentMethod || "نقدي";
      renderBookingItems(editData.items || []);
      editingBookingId = editData.id;
    } else {
      if (bookingDate)
        bookingDate.value = new Date().toISOString().slice(0, 10);
      if (bookingGuests) bookingGuests.value = "";
      if (bookingPlatesDeposit) bookingPlatesDeposit.value = "";
      if (bookingNotes) bookingNotes.value = "";
      if (bookingPaid) bookingPaid.value = "";
      if (bookingPaymentMethod) bookingPaymentMethod.value = "نقدي";
      renderBookingItems([]);
      editingBookingId = null;
    }

    const paymentAmount = document.getElementById("paymentAmount");
    const paymentNotes = document.getElementById("paymentNotes");

    if (editData && tab === "payment") {
      if (paymentAmount) paymentAmount.value = editData.amount || "";
      if (paymentNotes) paymentNotes.value = editData.notes || "";
      const methodRadio = document.querySelector(
        `input[name="paymentMethod"][value="${editData.method || "نقدي"}"]`,
      );
      if (methodRadio) methodRadio.checked = true;
      editingPaymentId = editData.id;
    } else {
      if (paymentAmount) paymentAmount.value = "";
      if (paymentNotes) paymentNotes.value = "";
      const defaultMethod = document.querySelector(
        'input[name="paymentMethod"][value="نقدي"]',
      );
      if (defaultMethod) defaultMethod.checked = true;
      editingPaymentId = null;
    }

    const saveBtn = document.getElementById("transactionSaveBtn");
    if (saveBtn) {
      saveBtn.textContent = isEditing
        ? tab === "booking"
          ? "تحديث الفاتورة"
          : "تحديث الدفعة"
        : tab === "booking"
          ? "حفظ الحجز"
          : "تسجيل الدفعة";
    }

    if (typeof setTransactionMode === "function") {
      setTransactionMode(tab);
    }

    updateBookingTotals();
    updatePaymentPreview();

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // ============================================================
  // 13. عرض الأصناف في نموذج الحجز
  // ============================================================
  function renderBookingItems(items) {
    const container = document.getElementById("bookingItemsContainer");
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = buildItemRow(null, 0);
      return;
    }

    container.innerHTML = items
      .map((item, index) => buildItemRow(item, index))
      .join("");
    // تحديث الإجماليات بعد التحميل
    setTimeout(updateBookingTotals, 50);
  }

  function buildItemRow(itemData, index) {
    const items = allItems;
    const selectedId = itemData ? itemData.id : "";
    const qty = itemData ? itemData.qty : 1;
    const price = itemData ? itemData.price : 0;

    let optionsHtml = '<option value="">اختر صنف</option>';
    items.forEach((it) => {
      const selected = it.id === selectedId ? "selected" : "";
      optionsHtml += `<option value="${it.id}" data-price="${it.price}" data-name="${it.name}" ${selected}>${it.name} (${it.price} ر.س)</option>`;
    });

    return `
      <div class="item-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;" data-index="${index}">
        <select class="form-select item-select" style="flex:2;min-width:100px;">
          ${optionsHtml}
        </select>
        <input type="number" class="form-input item-qty" placeholder="الكمية" min="1" value="${qty}" style="flex:1;min-width:60px;" />
        <input type="number" class="form-input item-price" placeholder="السعر" min="0" step="0.5" value="${price}" style="flex:1;min-width:80px;" />
        <span class="item-total" style="font-weight:700;min-width:70px;">${(qty * price).toFixed(2)} ر.س</span>
        <button type="button" class="btn-icon-sm btn-icon-danger remove-item-btn" title="حذف"><i class="fas fa-times"></i></button>
      </div>
    `;
  }

  // ============================================================
  // 14. تحديث الإجماليات في نموذج الحجز
  // ============================================================
  function updateBookingTotals() {
    const rows = document.querySelectorAll("#bookingItemsContainer .item-row");
    let itemsTotal = 0;
    rows.forEach((row) => {
      const totalSpan = row.querySelector(".item-total");
      if (totalSpan) {
        const val =
          parseFloat(totalSpan.textContent.replace(/[^0-9.]/g, "")) || 0;
        itemsTotal += val;
      }
    });
    const platesDeposit =
      parseFloat(document.getElementById("bookingPlatesDeposit")?.value) || 0;
    const grandTotal = itemsTotal + platesDeposit;
    const paid = parseFloat(document.getElementById("bookingPaid")?.value) || 0;
    const remaining = grandTotal - paid;

    const itemsTotalDisplay = document.getElementById("bookingItemsTotal");
    const platesDisplay = document.getElementById("bookingPlatesDisplay");
    const grandTotalDisplay = document.getElementById("bookingGrandTotal");
    const remainingDisplay = document.getElementById("bookingRemaining");

    if (itemsTotalDisplay)
      itemsTotalDisplay.textContent = itemsTotal.toFixed(2) + " ر.س";
    if (platesDisplay)
      platesDisplay.textContent = platesDeposit.toFixed(2) + " ر.س";
    if (grandTotalDisplay)
      grandTotalDisplay.textContent = grandTotal.toFixed(2) + " ر.س";
    if (remainingDisplay)
      remainingDisplay.textContent = remaining.toFixed(2) + " ر.س";
  }

  // ============================================================
  // 15. معاينة الرصيد في نموذج الدفعة
  // ============================================================
  function updatePaymentPreview() {
    const currentBalanceEl = document.getElementById("paymentCurrentBalance");
    const amountEl = document.getElementById("paymentAmount");
    const afterEl = document.getElementById("paymentAfterBalance");

    if (!currentBalanceEl || !amountEl || !afterEl) return;

    const balanceText = currentBalanceEl.textContent;
    const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, "")) || 0;
    const amount = parseFloat(amountEl.value) || 0;

    afterEl.textContent = window.API.formatCurrency(
      Math.max(0, currentBalance - amount),
    );
  }

  // ============================================================
  // 16. أحداث الأصناف (delegation)
  // ============================================================
  document.addEventListener("click", function (e) {
    // إضافة صف صنف جديد
    if (e.target && e.target.id === "addBookingItemBtn") {
      const container = document.getElementById("bookingItemsContainer");
      if (container) {
        const index = container.querySelectorAll(".item-row").length;
        container.insertAdjacentHTML("beforeend", buildItemRow(null, index));
        const newRow = container.lastElementChild;
        // ربط الأحداث
        newRow
          .querySelector(".item-select")
          .addEventListener("change", function () {
            updateItemRow(this.closest(".item-row"));
          });
        newRow
          .querySelector(".item-qty")
          .addEventListener("input", function () {
            updateItemRow(this.closest(".item-row"));
          });
        newRow
          .querySelector(".item-price")
          .addEventListener("input", function () {
            updateItemRow(this.closest(".item-row"));
          });
        newRow
          .querySelector(".remove-item-btn")
          .addEventListener("click", function () {
            const container = document.getElementById("bookingItemsContainer");
            if (container.querySelectorAll(".item-row").length > 1) {
              newRow.remove();
              updateBookingTotals();
            } else {
              showToast("يجب أن يكون هناك صنف واحد على الأقل", "warning");
            }
          });
        updateItemRow(newRow);
        updateBookingTotals();
      }
    }

    // حذف صف صنف
    const removeBtn = e.target.closest(".remove-item-btn");
    if (removeBtn) {
      const row = removeBtn.closest(".item-row");
      if (row) {
        const container = document.getElementById("bookingItemsContainer");
        if (container && container.querySelectorAll(".item-row").length > 1) {
          row.remove();
          updateBookingTotals();
        } else {
          showToast("يجب أن يكون هناك صنف واحد على الأقل", "warning");
        }
      }
    }
  });

  // مستمعات لتحديث الإجماليات
  document.addEventListener("input", function (e) {
    if (
      e.target &&
      (e.target.id === "bookingPlatesDeposit" || e.target.id === "bookingPaid")
    ) {
      updateBookingTotals();
    }
    if (e.target && e.target.id === "paymentAmount") {
      updatePaymentPreview();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.closest(".item-select")) {
      const row = e.target.closest(".item-row");
      if (row) updateItemRow(row);
    }
  });

  document.addEventListener("input", function (e) {
    if (
      e.target &&
      (e.target.closest(".item-qty") || e.target.closest(".item-price"))
    ) {
      const row = e.target.closest(".item-row");
      if (row) updateItemRow(row);
    }
  });

  function updateItemRow(row) {
    const select = row.querySelector(".item-select");
    const qtyInput = row.querySelector(".item-qty");
    const priceInput = row.querySelector(".item-price");
    const totalSpan = row.querySelector(".item-total");

    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.value) {
      const price = parseFloat(selectedOption.dataset.price) || 0;
      if (!priceInput.value || parseFloat(priceInput.value) === 0) {
        priceInput.value = price;
      }
    }
    const qty = parseFloat(qtyInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    totalSpan.textContent = (qty * price).toFixed(2) + " ر.س";
    updateBookingTotals();
  }

  // ============================================================
  // 17. حفظ الفاتورة أو الدفعة من المودال
  // ============================================================
  function handleTransactionSave() {
    const modal = document.getElementById("transactionModal");
    if (!modal) return;

    const entityId = parseInt(
      modal.dataset.entityId || currentCustomer?.id || "0",
    );
    const activeMode =
      document.querySelector(".switch-btn.active")?.dataset.mode || "booking";

    if (!entityId) {
      showToast("بيانات غير مكتملة", "error");
      return;
    }

    if (activeMode === "booking") {
      saveBooking(entityId);
    } else if (activeMode === "payment") {
      savePayment(entityId);
    }
  }

  function saveBooking(customerId) {
    const eventDate = document.getElementById("bookingDate")?.value;
    const guests =
      parseInt(document.getElementById("bookingGuests")?.value || "0") || 0;
    const platesDeposit =
      parseFloat(document.getElementById("bookingPlatesDeposit")?.value) || 0;
    const notes = document.getElementById("bookingNotes")?.value.trim() || "";
    const paid = parseFloat(document.getElementById("bookingPaid")?.value) || 0;
    const paymentMethod =
      document.getElementById("bookingPaymentMethod")?.value || "نقدي";

    const itemRows = document.querySelectorAll(
      "#bookingItemsContainer .item-row",
    );
    const items = [];
    let itemsTotal = 0;
    itemRows.forEach((row) => {
      const select = row.querySelector(".item-select");
      const qty = parseFloat(row.querySelector(".item-qty")?.value) || 0;
      const price = parseFloat(row.querySelector(".item-price")?.value) || 0;
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && selectedOption.value) {
        const name = selectedOption.dataset.name || selectedOption.text;
        items.push({ id: parseInt(selectedOption.value), name, qty, price });
        itemsTotal += qty * price;
      }
    });

    const total = itemsTotal + platesDeposit;

    if (items.length === 0) {
      showToast("يرجى إضافة صنف واحد على الأقل", "warning");
      return;
    }
    if (!eventDate) {
      showToast("يرجى تحديد تاريخ الفاتورة", "warning");
      return;
    }

    const bookingData = {
      customerId,
      eventDate,
      guests,
      items,
      platesDeposit,
      total,
      paid,
      paymentMethod,
      status: "جديد",
      notes,
      remaining: total - paid,
    };

    try {
      if (editingBookingId) {
        if (window.API.updateBooking) {
          window.API.updateBooking(editingBookingId, bookingData);
        } else {
          const idx = currentBookings.findIndex(
            (b) => b.id === editingBookingId,
          );
          if (idx !== -1)
            currentBookings[idx] = { ...currentBookings[idx], ...bookingData };
        }
        showToast("تم تحديث الفاتورة بنجاح", "success");
        editingBookingId = null;
      } else {
        if (window.API.addBooking) {
          window.API.addBooking(customerId, bookingData);
        } else {
          const newId = currentBookings.length
            ? Math.max(...currentBookings.map((b) => b.id)) + 1
            : 1;
          currentBookings.push({ id: newId, customerId, ...bookingData });
        }
        showToast("تم إضافة الفاتورة بنجاح", "success");
      }
      closeModal("transactionModal");
      refreshData();
    } catch (err) {
      showToast(err.message || "حدث خطأ أثناء حفظ الفاتورة", "error");
    }
  }

  function savePayment(customerId) {
    const amount = parseFloat(document.getElementById("paymentAmount")?.value);
    const method =
      document.querySelector('input[name="paymentMethod"]:checked')?.value ||
      "نقدي";
    const notes = document.getElementById("paymentNotes")?.value.trim() || "";

    if (!amount || amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }

    const balanceText =
      document.getElementById("paymentCurrentBalance")?.textContent || "0";
    const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, "")) || 0;
    if (amount > currentBalance) {
      showToast(
        `المبلغ يتجاوز الرصيد الحالي (${window.API.formatCurrency(currentBalance)})`,
        "error",
      );
      return;
    }

    try {
      if (editingPaymentId) {
        // تعديل
        if (window.API.updatePayment) {
          window.API.updatePayment(editingPaymentId, {
            customerId,
            amount,
            method,
            notes,
          });
        } else {
          const idx = currentPayments.findIndex(
            (p) => p.id === editingPaymentId,
          );
          if (idx !== -1)
            currentPayments[idx] = {
              ...currentPayments[idx],
              amount,
              method,
              notes,
            };
        }
        showToast("تم تحديث الدفعة بنجاح", "success");
        editingPaymentId = null;
      } else {
        // إضافة
        if (window.API.addPayment) {
          window.API.addPayment(customerId, amount, method, notes);
        } else {
          const newId = currentPayments.length
            ? Math.max(...currentPayments.map((p) => p.id)) + 1
            : 1;
          currentPayments.push({
            id: newId,
            customerId,
            amount,
            method,
            notes,
            date: new Date().toISOString().slice(0, 10),
          });
        }
        showToast(
          `تم تسجيل دفعة بقيمة ${window.API.formatCurrency(amount)}`,
          "success",
        );
      }
      closeModal("transactionModal");
      refreshData();
    } catch (err) {
      showToast(err.message || "حدث خطأ أثناء حفظ الدفعة", "error");
    }
  }

  // ============================================================
  // 18. ربط زر الحفظ في المودال
  // ============================================================
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "transactionSaveBtn") {
      handleTransactionSave();
    }
  });

  // ============================================================
  // 19. ربط FAB (من layout.js عبر حدث fab:modal:opened)
  // ============================================================
  document.addEventListener("fab:modal:opened", function (e) {
    if (e.detail.modalId === "transactionModal" && currentCustomer) {
      // فتح المودال في وضع الحجز الجديد
      openTransactionModal("booking", null);
    }
  });

  // ============================================================
  // 20. بدء التشغيل
  // ============================================================
  if (window.layoutReady) {
    loadCustomerData();
  } else {
    document.addEventListener("layout:ready", loadCustomerData);
  }
});
