// ============================================================
// assets/js/pages/suppliers.js
// الصفحة الرئيسية للموردين (عرض، بحث، إضافة، تعديل، حذف)
// جميع العمليات المالية (دفع/فاتورة) تكون في supplier-view.js
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  function init() {
    // ---- عناصر DOM ----
    const listEl = document.getElementById("suppliersList");
    const searchInput = document.getElementById("supplierSearch");
    const countEl = document.getElementById("suppliersCount");
    const payablesEl = document.getElementById("suppliersPayables");
    const paidEl = document.getElementById("suppliersPaid");

    // عناصر مودال الإضافة
    const addModal = document.getElementById("addSupplierModal");
    const nameInput = document.getElementById("newSupplierName");
    const phoneInput = document.getElementById("newSupplierPhone");
    const saveBtn = document.getElementById("saveNewSupplier");
    const addHeaderBtn = document.getElementById("addSupplierBtn");
    const fab = document.getElementById("fab");

    // عناصر مودال التعديل (تم حذف category و address)
    const editModal = document.getElementById("editSupplierModal");
    const editName = document.getElementById("editSupplierName");
    const editPhone = document.getElementById("editSupplierPhone");
    const saveEditBtn = document.getElementById("saveEditSupplier");
    let editingSupplierId = null;

    if (!listEl) return;

    // ---- دوال مساعدة ----
    function formatCurrency(amount) {
      if (window.API && typeof window.API.formatCurrency === "function") {
        return window.API.formatCurrency(amount);
      }
      return Number(amount).toLocaleString("ar-SA") + " ر.س";
    }

    // ---- عرض الموردين ----
    function renderSuppliers(filter = "") {
      if (!window.API || typeof window.API.getSuppliers !== "function") {
        listEl.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>جاري التحميل...</h4></div>`;
        return;
      }

      const allSuppliers = window.API.getSuppliers();
      const filtered = allSuppliers.filter(
        (s) => s.name.includes(filter) || s.phone.includes(filter),
      );

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-truck"></i>
            <h4>لا يوجد موردين</h4>
            <p>${filter ? "لم يتم العثور على موردين مطابقين للبحث" : "أضف أول مورد لك الآن"}</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered
        .map((s) => {
          const balance = s.balance;
          const initials = s.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2);
          return `
          <div class="supplier-card" data-id="${s.id}">
            <div class="click-area" onclick="window.location.href='supplier-view.html?id=${s.id}'">
              <div class="avatar">${initials}</div>
              <div class="info">
                <div class="name">${s.name}</div>
                <div class="phone">${s.phone}</div>
                <div class="category">${s.category || "بدون تصنيف"}</div>
                <div class="financial">
                  <span><span class="label">الفواتير</span> ${s.invoicesCount}</span>
                  <span><span class="label">الإجمالي</span> <span class="amount">${formatCurrency(s.totalInvoices)}</span></span>
                  <span><span class="label">مدفوع</span> <span class="paid">${formatCurrency(s.totalPaid)}</span></span>
                  ${
                    balance > 0
                      ? `<span><span class="label">مستحق</span> <span class="remaining">${formatCurrency(balance)}</span></span>`
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
      if (!window.API || typeof window.API.getSuppliers !== "function") return;

      const allSuppliers = window.API.getSuppliers();
      const total = allSuppliers.length;
      const payables = allSuppliers.reduce((sum, s) => sum + s.balance, 0);
      const paid = allSuppliers.reduce((sum, s) => sum + s.totalPaid, 0);

      countEl.textContent = total;
      payablesEl.textContent = formatCurrency(payables);
      paidEl.textContent = formatCurrency(paid);
    }

    // ---- البحث الفوري ----
    searchInput.addEventListener("input", function () {
      renderSuppliers(this.value.trim());
    });

    // ============================================================
    // إضافة مورد جديد
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

    function handleSaveSupplier() {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();

      if (!name) {
        showToast("يرجى إدخال اسم المورد", "warning");
        nameInput.focus();
        return;
      }
      if (!phone) {
        showToast("يرجى إدخال رقم الجوال", "warning");
        phoneInput.focus();
        return;
      }

      try {
        window.API.addSupplier(name, phone, "", "");
        showToast(`تم إضافة المورد "${name}" بنجاح`, "success");
        renderSuppliers(searchInput.value.trim());
        updateSummary();
        closeAddModal();
      } catch (err) {
        showToast(err.message || "حدث خطأ أثناء إضافة المورد", "error");
      }
    }

    addHeaderBtn.addEventListener("click", openAddModal);
    fab.addEventListener("click", openAddModal);
    saveBtn.addEventListener("click", handleSaveSupplier);

    document
      .querySelectorAll('[data-close="addSupplierModal"]')
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
          handleSaveSupplier();
        }
      });
    });

    // ============================================================
    // تعديل مورد (بدون تصنيف وعنوان)
    // ============================================================
    function openEditModal(supplierId) {
      const supplier = window.API.getSupplier(supplierId);
      if (!supplier) {
        showToast("المورد غير موجود", "error");
        return;
      }
      editingSupplierId = supplierId;
      editName.value = supplier.name || "";
      editPhone.value = supplier.phone || "";
      editModal.classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(() => editName.focus(), 100);
    }

    function closeEditModal() {
      editModal.classList.remove("active");
      document.body.style.overflow = "";
      editingSupplierId = null;
    }

    function handleEditSupplier() {
      const name = editName.value.trim();
      const phone = editPhone.value.trim();

      if (!name) {
        showToast("يرجى إدخال اسم المورد", "warning");
        editName.focus();
        return;
      }
      if (!phone) {
        showToast("يرجى إدخال رقم الجوال", "warning");
        editPhone.focus();
        return;
      }

      try {
        // الحصول على القيم القديمة للتصنيف والعنوان للحفاظ عليها
        const supplier = window.API.getSupplier(editingSupplierId);
        const category = supplier ? supplier.category : "";
        const address = supplier ? supplier.address : "";
        window.API.updateSupplier(
          editingSupplierId,
          name,
          phone,
          address,
          category,
        );
        showToast(`تم تحديث المورد "${name}" بنجاح`, "success");
        renderSuppliers(searchInput.value.trim());
        updateSummary();
        closeEditModal();
      } catch (err) {
        showToast(err.message || "حدث خطأ أثناء التحديث", "error");
      }
    }

    saveEditBtn.addEventListener("click", handleEditSupplier);

    document
      .querySelectorAll('[data-close="editSupplierModal"]')
      .forEach((btn) => {
        btn.addEventListener("click", closeEditModal);
      });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && editModal.classList.contains("active")) {
        closeEditModal();
      }
    });

    // إضافة مستمعات الأحداث فقط للحقول الموجودة
    [editName, editPhone].forEach((input) => {
      if (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            handleEditSupplier();
          }
        });
      }
    });

    // ============================================================
    // حذف مورد
    // ============================================================
    function handleDeleteSupplier(id) {
      const supplier = window.API.getSupplier(id);
      if (!supplier) return;

      showConfirm({
        title: "حذف المورد",
        message: `هل أنت متأكد من حذف المورد "${supplier.name}"؟`,
        confirmText: "حذف",
        danger: true,
        onConfirm: function () {
          try {
            if (window.API.deleteSupplier) {
              window.API.deleteSupplier(id);
            } else {
              // محاكاة الحذف
              const suppliers = window.API.getSuppliers();
              const index = suppliers.findIndex((s) => s.id === id);
              if (index !== -1) {
                suppliers.splice(index, 1);
              }
            }
            showToast(`تم حذف المورد "${supplier.name}" بنجاح`, "success");
            renderSuppliers(searchInput.value.trim());
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
        const card = editBtn.closest(".supplier-card");
        if (card) {
          const id = parseInt(card.dataset.id);
          openEditModal(id);
        }
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const card = deleteBtn.closest(".supplier-card");
        if (card) {
          const id = parseInt(card.dataset.id);
          handleDeleteSupplier(id);
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
      renderSuppliers();
      updateSummary();
    }

    loadData();

    if (!window.layoutReady) {
      document.addEventListener("layout:ready", function () {
        renderSuppliers(searchInput.value.trim());
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