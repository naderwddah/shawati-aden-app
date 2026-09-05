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
    return accounts.find(
      (account) =>
        Number(account.customer_id ?? account.customer?.id ?? account.id) ===
        Number(customerId)
    ) || null;
  }

  function getCustomerFinancialData(customer) {
    const account = getAccountForCustomer(customer.id);

    const totalInvoices = number(
      account?.total_invoices ??
      account?.totalInvoices ??
      customer.total_invoices ??
      customer.totalInvoices ??
      0
    );

    const totalPaid = number(
      account?.total_paid ??
      account?.totalPaid ??
      customer.total_paid ??
      customer.totalPaid ??
      0
    );

    const balance = number(
      account?.balance ??
      customer.balance ??
      Math.max(0, totalInvoices - totalPaid)
    );

    const invoicesCount = number(
      account?.invoices_count ??
      account?.invoicesCount ??
      customer.invoices_count ??
      customer.invoicesCount ??
      0
    );

    return {
      totalInvoices,
      totalPaid,
      balance,
      invoicesCount
    };
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
        const active = customer.is_active !== false;
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
                    <span class="label">الفواتير</span>
                    ${financial.invoicesCount}
                  </span>

                  <span>
                    <span class="label">الإجمالي</span>
                    <span class="amount">${formatCurrency(financial.totalInvoices)}</span>
                  </span>

                  <span>
                    <span class="label">مدفوع</span>
                    <span class="paid">${formatCurrency(financial.totalPaid)}</span>
                  </span>

                  ${
                    financial.balance > 0
                      ? `
                        <span>
                          <span class="label">متبقي</span>
                          <span class="remaining">${formatCurrency(financial.balance)}</span>
                        </span>
                      `
                      : `
                        <span>
                          <span class="label">الحالة</span>
                          <span style="color:var(--success);font-weight:700;">مسدد</span>
                        </span>
                      `
                  }
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

  async function loadAccounts() {
    accounts = [];

    if (typeof API.getCustomerAccounts !== "function") return;

    try {
      const result = await API.getCustomerAccounts();
      accounts = Array.isArray(result) ? result : [];
    } catch (error) {
      accounts = [];
    }
  }

  async function loadCustomers() {
    if (!window.API || typeof API.getCustomers !== "function") {
      listEl.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h4 class="empty-state-title">تعذر الاتصال بالخادم</h4>
        </div>
      `;
      return;
    }

    try {
      const result = await API.getCustomers();

      customers = Array.isArray(result) ? result : [];

      await loadAccounts();

      updateSummary();
      renderCustomers(searchInput?.value.trim() || "");
    } catch (error) {
      listEl.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h4 class="empty-state-title">حدث خطأ في تحميل العملاء</h4>
          <p class="empty-state-text">${escapeHtml(error.message || "تعذر تحميل البيانات")}</p>
        </div>
      `;

      showToast(error.message || "فشل تحميل العملاء", "error");
    }
  }

  function updateSummary() {
    const activeCustomers = customers.filter(
      (customer) => customer.is_active !== false
    );

    let receivables = 0;
    let collected = 0;

    customers.forEach((customer) => {
      const financial = getCustomerFinancialData(customer);
      receivables += financial.balance;
      collected += financial.totalPaid;
    });

    if (countEl) countEl.textContent = activeCustomers.length;
    if (receivablesEl) receivablesEl.textContent = formatCurrency(receivables);
    if (collectedEl) collectedEl.textContent = formatCurrency(collected);
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

    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';

    try {
      await API.updateCustomer(editingCustomerId, {
        name,
        phone,
        notes,
        is_active: currentCustomer?.is_active !== false
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

    const isActive = customer.is_active !== false;
    const nextState = !isActive;

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
      setTimeout(initialize, 150);
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