document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const listEl = document.getElementById("customersList");
  const searchInput = document.getElementById("customerSearch");
  const countEl = document.getElementById("customersCount");
  const receivablesEl = document.getElementById("customersReceivables");
  const collectedEl = document.getElementById("customersCollected");

  const addModal = document.getElementById("addCustomerModal");
  const nameInput = document.getElementById("newCustomerName");
  const phoneInput = document.getElementById("newCustomerPhone");
  const notesInput = document.getElementById("newCustomerNotes");
  const saveBtn = document.getElementById("saveNewCustomer");
  const addHeaderBtn = document.getElementById("addCustomerBtn");
  const fab = document.getElementById("fab");

  const editModal = document.getElementById("editCustomerModal");
  const editName = document.getElementById("editCustomerName");
  const editPhone = document.getElementById("editCustomerPhone");
  const editNotes = document.getElementById("editCustomerNotes");
  const saveEditBtn = document.getElementById("saveEditCustomer");

  let editingCustomerId = null;
  let customers = [];
  let accounts = [];
  let accountsFailed = false;
  let accountsByCustomerId = new Map();
  let loadVersion = 0;

  if (!listEl) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function formatCurrency(amount) {
    if (window.API && typeof API.formatCurrency === "function") {
      return API.formatCurrency(number(amount));
    }

    return number(amount).toLocaleString("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " ر.س";
  }

  function showToast(message, type = "info") {
    const container =
      document.querySelector(".custom-toast-container") ||
      document.getElementById("toastContainer");

    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `custom-toast ${type}`;
    toast.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:12px 16px;margin:8px;background:var(--surface-card);border-radius:12px;box-shadow:var(--shadow-md);font-family:Tajawal,sans-serif;";

    const icons = {
      success: "fa-check-circle",
      error: "fa-times-circle",
      warning: "fa-exclamation-circle",
      info: "fa-info-circle"
    };

    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function getAccountForCustomer(customerId) {
    return accountsByCustomerId.get(String(customerId)) ?? null;
  }

  function getCustomerFinancialData(customer) {
    const account = getAccountForCustomer(customer.id);
    if (accountsFailed || !account) return null;
    // CustomerAccountService: invoices_total, payments_total, balance,
    // net_collected_total, invoices_count (added in this repair).
    return {
      totalInvoices: number(account.invoices_total ?? account.total_invoices ?? 0),
      totalPaid: number(account.payments_total ?? account.total_paid ?? 0),
      netCollected: number(account.net_collected_total ?? account.payments_total ?? 0),
      balance: number(account.balance ?? 0),
      invoicesCount: number(account.invoices_count ?? 0),
      returned: number(account.deposit_returned_total ?? 0)
    };
  }

  function isActive(customer) {
    return ![false, 0, "0"].includes(customer.is_active);
  }

  function getInitials(name) {
    const words = String(name || "؟")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return "؟";

    return words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase();
  }

  function renderCustomers(filter = "") {
    const query = String(filter || "").trim().toLowerCase();

    const filtered = customers.filter((customer) => {
      const name = String(customer.name || "").toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();

      return name.includes(query) || phone.includes(query);
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            <i class="fas fa-${query ? "search" : "user-slash"}"></i>
          </div>
          <h4 class="empty-state-title">
            ${query ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء مضافين"}
          </h4>
          <p class="empty-state-text">
            ${
              query
                ? "لم نتمكن من العثور على عملاء بهذا الاسم أو الرقم."
                : "ابدأ بإضافة عملائك لإدارة حساباتهم وفواتيرهم بسهولة."
            }
          </p>
          ${
            !query
              ? `<button class="empty-state-btn" id="emptyAddCustomer">
                   <i class="fas fa-plus"></i>
                   إضافة عميل جديد
                 </button>`
              : ""
          }
        </div>
      `;

      document.getElementById("emptyAddCustomer")?.addEventListener(
        "click",
        openAddModal
      );

      return;
    }

    listEl.innerHTML = filtered
      .map((customer) => {
        const financial = getCustomerFinancialData(customer);
        const active = isActive(customer);
        const initials = getInitials(customer.name);

        return `
          <div class="customer-card ${active ? "" : "inactive"}" data-id="${customer.id}">
            <div class="click-area" data-action="view">
              <div class="avatar">${escapeHtml(initials)}</div>

              <div class="info">
                <div class="name">${escapeHtml(customer.name)}</div>
                <div class="phone">${escapeHtml(customer.phone || "—")}</div>

                <span class="customer-status ${active ? "active" : "inactive"}">
                  <i class="fas ${active ? "fa-check-circle" : "fa-ban"}"></i>
                  ${active ? "نشط" : "غير نشط"}
                </span>

                <div class="financial">
                  <span>
                    <span class="label">الحجوزات</span>
                    ${financial ? financial.invoicesCount : '—'}
                  </span>

                  <span>
                    <span class="label">الإجمالي</span>
                    <span class="amount">${financial ? formatCurrency(financial.totalInvoices) : "—"}</span>
                  </span>

                  <span>
                    <span class="label">مدفوع</span>
                    <span class="paid">${financial ? formatCurrency(financial.netCollected) : "—"}</span>
                  </span>

                  ${!financial ? `<span class="financial-warning">تعذر تحميل الحساب</span>` : financial.balance > 0
                    ? `<span><span class="label">مستحق</span><span class="remaining">${formatCurrency(financial.balance)}</span></span>`
                    : financial.balance < 0
                    ? `<span><span class="label">رصيد دائن</span><span class="paid">${formatCurrency(Math.abs(financial.balance))}</span></span>`
                    : `<span><span class="label">الحالة</span><span class="paid">مسدد</span></span>`}

                </div>
              </div>
            </div>

            <div class="actions">
              <button
                type="button"
                class="customer-action edit"
                data-action="edit"
                title="تعديل"
              >
                <i class="fas fa-pen"></i>
              </button>

              <button
                type="button"
                class="customer-action ${active ? "toggle" : "activate"}"
                data-action="toggle"
                title="${active ? "تعطيل العميل" : "تفعيل العميل"}"
              >
                <i class="fas ${active ? "fa-user-slash" : "fa-user-check"}"></i>
              </button>

              <div class="arrow">
                <i class="fas fa-chevron-left"></i>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadCustomers() {
    if (!window.API || typeof API.getCustomers !== "function") {
      listEl.innerHTML = '<div class="empty-state-box"><h4>تعذر تحميل واجهة الاتصال</h4></div>';
      return;
    }
    const version = ++loadVersion;
    // Both requests are independent; do not block customer records on a
    // temporarily failing financial summary.
    const [customerResult, accountResult] = await Promise.allSettled([
      API.getCustomers(), API.getCustomerAccounts()
    ]);
    if (version !== loadVersion) return;
    if (customerResult.status !== 'fulfilled' || !Array.isArray(customerResult.value)) {
      listEl.innerHTML = `<div class="empty-state-box"><h4>تعذر تحميل العملاء</h4><p class="empty-state-text">${escapeHtml(customerResult.reason?.message || 'يرجى المحاولة مرة أخرى')}</p><button type="button" class="btn btn-primary" id="retryCustomers">إعادة المحاولة</button></div>`;
      document.getElementById('retryCustomers')?.addEventListener('click', loadCustomers);
      [countEl, receivablesEl, collectedEl].forEach(el => { if (el) el.textContent = '—'; });
      return;
    }
    customers = customerResult.value;
    accountsFailed = accountResult.status !== 'fulfilled' || !Array.isArray(accountResult.value);
    accounts = accountsFailed ? [] : accountResult.value;
    accountsByCustomerId = new Map(accounts.map(a => [String(a.customer_id ?? a.customer?.id), a]));
    updateSummary();
    renderCustomers(searchInput?.value || '');
    const warning = document.getElementById('customerAccountsWarning');
    if (warning) {
      warning.hidden = !accountsFailed;
      warning.textContent = accountsFailed ? 'تعذر تحميل الأرصدة المالية. بيانات العملاء متاحة، ويمكن إعادة تحميل الصفحة للمحاولة.' : '';
    }
  }

  function updateSummary() {
    let receivables = 0;
    let collected = 0;
    customers.forEach((customer) => {
      const financial = getCustomerFinancialData(customer);
      if (financial) {
        receivables += Math.max(0, financial.balance);
        collected += financial.netCollected;
      }
    });
    if (countEl) countEl.textContent = customers.length.toLocaleString('ar-SA');
    if (receivablesEl) receivablesEl.textContent = accountsFailed ? '—' : formatCurrency(receivables);
    if (collectedEl) collectedEl.textContent = accountsFailed ? '—' : formatCurrency(collected);
  }

  function openAddModal() {
    nameInput.value = "";
    phoneInput.value = "";
    notesInput.value = "";
    saveBtn.disabled = false;
    saveBtn.innerHTML = "حفظ العميل";

    addModal.classList.add("active");
    document.body.style.overflow = "hidden";

    setTimeout(() => nameInput.focus(), 100);
  }

  function closeAddModal() {
    addModal.classList.remove("active");

    if (!editModal.classList.contains("active")) {
      document.body.style.overflow = "";
    }
  }

  async function handleSaveCustomer() {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const notes = notesInput.value.trim();

    if (!name) {
      showToast("يرجى إدخال اسم العميل", "warning");
      nameInput.focus();
      return;
    }

    if (!phone) {
      showToast("يرجى إدخال رقم الجوال", "warning");
      phoneInput.focus();
      return;
    }

    if (customers.some(c => String(c.phone || '').trim() === phone)) {
      showToast('يوجد عميل مسجل بهذا الرقم. استخدم بياناته الموجودة.', 'warning');
      phoneInput.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
      const result = await API.createCustomer({
        name,
        phone,
        notes,
        is_active: true
      });

      const customer = result?.data || result;

      showToast(
        `تم إضافة العميل "${customer?.name || name}" بنجاح`,
        "success"
      );

      closeAddModal();
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "حدث خطأ أثناء إضافة العميل", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "حفظ العميل";
    }
  }

  async function openEditModal(customerId) {
    try {
      const result = await API.getCustomer(customerId);
      const customer = result?.data || result;

      if (!customer) {
        showToast("العميل غير موجود", "error");
        return;
      }

      editingCustomerId = customerId;

      editName.value = customer.name || "";
      editPhone.value = customer.phone || "";
      editNotes.value = customer.notes || "";

      saveEditBtn.disabled = false;
      saveEditBtn.innerHTML = "حفظ التغييرات";

      editModal.classList.add("active");
      document.body.style.overflow = "hidden";

      setTimeout(() => editName.focus(), 100);
    } catch (error) {
      showToast(error.message || "فشل تحميل بيانات العميل", "error");
    }
  }

  function closeEditModal() {
    editModal.classList.remove("active");
    editingCustomerId = null;

    if (!addModal.classList.contains("active")) {
      document.body.style.overflow = "";
    }
  }

  async function handleEditCustomer() {
    if (!editingCustomerId) return;

    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const notes = editNotes.value.trim();

    if (!name) {
      showToast("يرجى إدخال اسم العميل", "warning");
      editName.focus();
      return;
    }

    if (!phone) {
      showToast("يرجى إدخال رقم الجوال", "warning");
      editPhone.focus();
      return;
    }

    const currentCustomer = customers.find(
      (customer) => Number(customer.id) === Number(editingCustomerId)
    );

    if (customers.some(c => Number(c.id) !== Number(editingCustomerId) && String(c.phone || '').trim() === phone)) {
      showToast('رقم الجوال مرتبط بعميل آخر.', 'warning');
      editPhone.focus();
      return;
    }
    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';

    try {
      await API.updateCustomer(editingCustomerId, {
        name,
        phone,
        notes,
        is_active: currentCustomer ? isActive(currentCustomer) : true
      });

      showToast(`تم تحديث العميل "${name}" بنجاح`, "success");

      closeEditModal();
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "حدث خطأ أثناء التحديث", "error");
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.innerHTML = "حفظ التغييرات";
    }
  }

  async function toggleCustomer(customerId) {
    const customer = customers.find(
      (item) => Number(item.id) === Number(customerId)
    );

    if (!customer) return;

    const currentlyActive = isActive(customer);
    const nextState = !currentlyActive;

    try {
      await API.updateCustomer(customerId, {
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes || "",
        is_active: nextState
      });

      showToast(
        nextState
          ? `تم تفعيل العميل "${customer.name}"`
          : `تم تعطيل العميل "${customer.name}"`,
        "success"
      );

      await loadCustomers();
    } catch (error) {
      showToast(
        error.message ||
          (nextState ? "فشل تفعيل العميل" : "فشل تعطيل العميل"),
        "error"
      );
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      renderCustomers(this.value.trim());
    });
  }

  if (addHeaderBtn) {
    addHeaderBtn.addEventListener("click", openAddModal);
  }

  if (fab) {
    fab.addEventListener("click", openAddModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveCustomer);
  }

  if (saveEditBtn) {
    saveEditBtn.addEventListener("click", handleEditCustomer);
  }

  document.querySelectorAll('[data-close="addCustomerModal"]').forEach((element) => {
    element.addEventListener("click", closeAddModal);
  });

  document.querySelectorAll('[data-close="editCustomerModal"]').forEach((element) => {
    element.addEventListener("click", closeEditModal);
  });

  [nameInput, phoneInput, notesInput].forEach((input) => {
    input?.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
        event.preventDefault();
        handleSaveCustomer();
      }
    });
  });

  [editName, editPhone, editNotes].forEach((input) => {
    input?.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
        event.preventDefault();
        handleEditCustomer();
      }
    });
  });

  listEl.addEventListener("click", function (event) {
    const card = event.target.closest(".customer-card");

    if (!card) return;

    const customerId = Number(card.dataset.id);

    const editButton = event.target.closest('[data-action="edit"]');
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      openEditModal(customerId);
      return;
    }

    const toggleButton = event.target.closest('[data-action="toggle"]');
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleCustomer(customerId);
      return;
    }

    const viewArea = event.target.closest('[data-action="view"]');
    if (viewArea) {
      window.location.href = `customer-view.html?id=${customerId}`;
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;

    if (addModal.classList.contains("active")) {
      closeAddModal();
    }

    if (editModal.classList.contains("active")) {
      closeEditModal();
    }
  });

  async function initialize() {
    if (!window.API) {
      listEl.innerHTML = '<div class="empty-state-box"><h4>ملف API غير محمل</h4></div>';
      return;
    }

    listEl.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <h4 class="empty-state-title">جاري تحميل العملاء...</h4>
      </div>
    `;

    await loadCustomers();
  }

  initialize();
});