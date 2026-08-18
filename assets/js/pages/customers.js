// ============================================================
// assets/js/pages/customers.js
// الصفحة الرئيسية للعملاء (عرض، بحث، إضافة، تعديل، حذف)
// جميع العمليات المالية (دفع/فاتورة) تكون في customer-view.js
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  function init() {
    // ---- عناصر DOM ----
    const listEl = document.getElementById("customersList");
    const searchInput = document.getElementById("customerSearch");
    const countEl = document.getElementById("customersCount");
    const receivablesEl = document.getElementById("customersReceivables");
    const collectedEl = document.getElementById("customersCollected");

    // عناصر مودال الإضافة
    const addModal = document.getElementById("addCustomerModal");
    const nameInput = document.getElementById("newCustomerName");
    const phoneInput = document.getElementById("newCustomerPhone");
    const saveBtn = document.getElementById("saveNewCustomer");
    const addHeaderBtn = document.getElementById("addCustomerBtn");
    const fab = document.getElementById("fab");

    // عناصر مودال التعديل
    const editModal = document.getElementById("editCustomerModal");
    const editName = document.getElementById("editCustomerName");
    const editPhone = document.getElementById("editCustomerPhone");
    const saveEditBtn = document.getElementById("saveEditCustomer");
    let editingCustomerId = null;

    if (!listEl) return;

    // ---- دوال مساعدة ----
    function formatCurrency(amount) {
      if (window.API && typeof window.API.formatCurrency === "function") {
        return window.API.formatCurrency(amount);
      }
      return Number(amount).toLocaleString("ar-SA") + " ر.س";
    }

    // ---- عرض العملاء ----
    function renderCustomers(filter = "") {
      if (!window.API || typeof window.API.getCustomers !== "function") {
        listEl.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>جاري التحميل...</h4></div>`;
        return;
      }

      const allCustomers = window.API.getCustomers();
      const filtered = allCustomers.filter(
        (c) => c.name.includes(filter) || c.phone.includes(filter),
      );

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-slash"></i>
            <h4>لا يوجد عملاء</h4>
            <p>${filter ? "لم يتم العثور على عملاء مطابقين للبحث" : "أضف أول عميل لك الآن"}</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered
        .map((c) => {
          const balance = c.balance;
          const initials = c.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2);
          return `
          <div class="customer-card" data-id="${c.id}">
            <div class="click-area" onclick="window.location.href='customer-view.html?id=${c.id}'">
              <div class="avatar">${initials}</div>
              <div class="info">
                <div class="name">${c.name}</div>
                <div class="phone">${c.phone}</div>
                <div class="financial">
                  <span><span class="label">الفواتير</span> ${c.invoicesCount}</span>
                  <span><span class="label">الإجمالي</span> <span class="amount">${formatCurrency(c.totalInvoices)}</span></span>
                  <span><span class="label">مدفوع</span> <span class="paid">${formatCurrency(c.totalPaid)}</span></span>
                  ${
                    balance > 0
                      ? `<span><span class="label">متبقي</span> <span class="remaining">${formatCurrency(balance)}</span></span>`
                      : `<span><span class="label">الحالة</span> <span style="color:var(--success);font-weight:700;">مسدد بالكامل</span></span>`
                  }
                </div>
              </div>
            </div>
            <div class="actions">
              <button class="btn-icon-sm btn-icon-primary" data-action="edit" title="تعديل"><i class="fas fa-pen"></i></button>
              <button class="btn-icon-sm btn-icon-danger" data-action="delete" title="حذف"><i class="fas fa-trash"></i></button>
              <div class="arrow"><i class="fas fa-chevron-left"></i></div>
            </div>
          </div>
        `;
        })
        .join("");
    }

    // ---- تحديث الملخص المالي ----
    function updateSummary() {
      if (!window.API || typeof window.API.getCustomers !== "function") return;

      const allCustomers = window.API.getCustomers();
      const total = allCustomers.length;
      const receivables = allCustomers.reduce((sum, c) => sum + c.balance, 0);
      const collected = allCustomers.reduce((sum, c) => sum + c.totalPaid, 0);

      countEl.textContent = total;
      receivablesEl.textContent = formatCurrency(receivables);
      collectedEl.textContent = formatCurrency(collected);
    }

    // ---- البحث الفوري ----
    searchInput.addEventListener("input", function () {
      renderCustomers(this.value.trim());
    });

    // ============================================================
    // إضافة عميل جديد
    // ============================================================
    function openAddModal() {
      nameInput.value = "";
      phoneInput.value = "";
      addModal.classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(() => nameInput.focus(), 100);
    }

    function closeAddModal() {
      addModal.classList.remove("active");
      document.body.style.overflow = "";
    }

    function handleSaveCustomer() {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();

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

      try {
        window.API.addCustomer(name, phone, "");
        showToast(`تم إضافة العميل "${name}" بنجاح`, "success");
        renderCustomers(searchInput.value.trim());
        updateSummary();
        closeAddModal();
      } catch (err) {
        showToast(err.message || "حدث خطأ أثناء إضافة العميل", "error");
      }
    }

    addHeaderBtn.addEventListener("click", openAddModal);
    fab.addEventListener("click", openAddModal);
    saveBtn.addEventListener("click", handleSaveCustomer);

    document
      .querySelectorAll('[data-close="addCustomerModal"]')
      .forEach((btn) => {
        btn.addEventListener("click", closeAddModal);
      });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && addModal.classList.contains("active")) {
        closeAddModal();
      }
    });

    [nameInput, phoneInput].forEach((input) => {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSaveCustomer();
        }
      });
    });

    // ============================================================
    // تعديل عميل (بدون عنوان)
    // ============================================================
    function openEditModal(customerId) {
      const customer = window.API.getCustomer(customerId);
      if (!customer) {
        showToast("العميل غير موجود", "error");
        return;
      }
      editingCustomerId = customerId;
      editName.value = customer.name || "";
      editPhone.value = customer.phone || "";
      editModal.classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(() => editName.focus(), 100);
    }

    function closeEditModal() {
      editModal.classList.remove("active");
      document.body.style.overflow = "";
      editingCustomerId = null;
    }

    function handleEditCustomer() {
      const name = editName.value.trim();
      const phone = editPhone.value.trim();

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

      try {
        // الحفاظ على العنوان القديم إن وجد
        const customer = window.API.getCustomer(editingCustomerId);
        const address = customer ? customer.address : "";
        window.API.updateCustomer(editingCustomerId, name, phone, address);
        showToast(`تم تحديث العميل "${name}" بنجاح`, "success");
        renderCustomers(searchInput.value.trim());
        updateSummary();
        closeEditModal();
      } catch (err) {
        showToast(err.message || "حدث خطأ أثناء التحديث", "error");
      }
    }

    saveEditBtn.addEventListener("click", handleEditCustomer);

    document
      .querySelectorAll('[data-close="editCustomerModal"]')
      .forEach((btn) => {
        btn.addEventListener("click", closeEditModal);
      });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && editModal.classList.contains("active")) {
        closeEditModal();
      }
    });

    [editName, editPhone].forEach((input) => {
      if (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            handleEditCustomer();
          }
        });
      }
    });

    // ============================================================
    // حذف عميل
    // ============================================================
    function handleDeleteCustomer(id) {
      const customer = window.API.getCustomer(id);
      if (!customer) return;

      showConfirm({
        title: "حذف العميل",
        message: `هل أنت متأكد من حذف العميل "${customer.name}"؟`,
        confirmText: "حذف",
        danger: true,
        onConfirm: function () {
          try {
            if (window.API.deleteCustomer) {
              window.API.deleteCustomer(id);
            } else {
              // محاكاة الحذف
              const customers = window.API.getCustomers();
              const index = customers.findIndex((c) => c.id === id);
              if (index !== -1) {
                customers.splice(index, 1);
              }
            }
            showToast(`تم حذف العميل "${customer.name}" بنجاح`, "success");
            renderCustomers(searchInput.value.trim());
            updateSummary();
          } catch (err) {
            showToast(err.message || "حدث خطأ أثناء الحذف", "error");
          }
        },
      });
    }

    // ---- أحداث الأزرار (delegation) ----
    listEl.addEventListener("click", function (e) {
      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        const card = editBtn.closest(".customer-card");
        if (card) {
          const id = parseInt(card.dataset.id);
          openEditModal(id);
        }
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const card = deleteBtn.closest(".customer-card");
        if (card) {
          const id = parseInt(card.dataset.id);
          handleDeleteCustomer(id);
        }
        return;
      }
    });

    // ---- التهيئة الأولية ----
    function loadData() {
      if (!window.API) {
        setTimeout(loadData, 200);
        return;
      }
      renderCustomers();
      updateSummary();
    }

    loadData();

    if (!window.layoutReady) {
      document.addEventListener("layout:ready", function () {
        renderCustomers(searchInput.value.trim());
        updateSummary();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
});