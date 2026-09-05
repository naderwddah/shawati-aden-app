document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const state = {
    suppliers: [],
    accounts: [],
    filtered: [],
    editingId: null,
    loading: false,
    saving: false
  };

  const els = {
    list: document.getElementById('suppliersList'),
    search: document.getElementById('supplierSearch'),
    count: document.getElementById('suppliersCount'),
    payables: document.getElementById('suppliersPayables'),
    paid: document.getElementById('suppliersPaid'),
    addBtn: document.getElementById('addSupplierBtn'),
    fab: document.getElementById('fab'),
    modal: document.getElementById('supplierModal'),
    modalTitle: document.getElementById('supplierModalTitle'),
    name: document.getElementById('supplierName'),
    phone: document.getElementById('supplierPhone'),
    notes: document.getElementById('supplierNotes'),
    active: document.getElementById('supplierActive'),
    save: document.getElementById('saveSupplierBtn')
  };

  function toast(message, type = 'info') {
    if (window.Layout && typeof Layout.showToast === 'function') {
      Layout.showToast(message, type);
      return;
    }

    if (window.Utils && typeof Utils.showToast === 'function') {
      Utils.showToast(message, type);
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
    const amount = Number(value || 0);

    if (window.Utils && typeof Utils.formatCurrency === 'function') {
      return Utils.formatCurrency(amount);
    }

    return `${amount.toLocaleString('ar-SA', {
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

  function getInitials(name) {
    const words = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) {
      return 'م';
    }

    return words
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  }

  function normalizeAccount(account) {
    if (!account) {
      return {
        totalInvoices: 0,
        totalPaid: 0,
        balance: 0
      };
    }

    return {
      totalInvoices: Number(
        account.total_invoices ??
        account.totalInvoices ??
        0
      ),
      totalPaid: Number(
        account.total_paid ??
        account.totalPaid ??
        0
      ),
      balance: Number(
        account.balance ??
        account.total_remaining ??
        account.totalRemaining ??
        0
      )
    };
  }

  function accountForSupplier(id) {
    const account = state.accounts.find(item => {
      return Number(item.supplier_id ?? item.id) === Number(id);
    });

    return normalizeAccount(account);
  }

  function updateSummary() {
    let totalPayables = 0;
    let totalPaid = 0;

    state.suppliers.forEach(supplier => {
      const account = accountForSupplier(supplier.id);

      if (account.balance > 0) {
        totalPayables += account.balance;
      }

      totalPaid += account.totalPaid;
    });

    els.count.textContent = String(state.suppliers.length);
    els.payables.textContent = currency(totalPayables);
    els.paid.textContent = currency(totalPaid);

    els.payables.className =
      totalPayables > 0
        ? 'summary-value danger'
        : 'summary-value';
  }

  function render() {
    const search = els.search.value.trim().toLowerCase();

    state.filtered = search
      ? state.suppliers.filter(supplier => {
          const name = String(supplier.name || '').toLowerCase();
          const phone = String(supplier.phone || '').toLowerCase();
          const notes = String(supplier.notes || '').toLowerCase();

          return (
            name.includes(search) ||
            phone.includes(search) ||
            notes.includes(search)
          );
        })
      : [...state.suppliers];

    if (!state.filtered.length) {
      els.list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-truck"></i>
          <h4>${search ? 'لا توجد نتائج مطابقة' : 'لا يوجد موردون'}</h4>
          <p>${search ? 'جرّب كلمة بحث مختلفة' : 'أضف أول مورد الآن'}</p>
        </div>
      `;
      return;
    }

    els.list.innerHTML = state.filtered.map(supplier => {
      const account = accountForSupplier(supplier.id);
      const balance = account.balance;

      return `
        <div class="supplier-card" data-id="${supplier.id}">
          <div class="supplier-main" data-action="view">
            <div class="supplier-avatar">
              ${escapeHtml(getInitials(supplier.name))}
            </div>

            <div class="supplier-info">
              <div class="supplier-name">
                ${escapeHtml(supplier.name || 'بدون اسم')}
              </div>

              <div class="supplier-phone">
                ${escapeHtml(supplier.phone || 'لا يوجد رقم')}
              </div>

              <div class="supplier-account">
                <span class="account-item">
                  <span class="account-label">فواتير:</span>
                  <span class="account-value">
                    ${currency(account.totalInvoices)}
                  </span>
                </span>

                <span class="account-item">
                  <span class="account-label">مدفوع:</span>
                  <span class="account-value success">
                    ${currency(account.totalPaid)}
                  </span>
                </span>

                <span class="account-item">
                  <span class="account-label">الرصيد:</span>
                  <span class="account-value ${balance > 0 ? 'danger' : 'success'}">
                    ${currency(Math.abs(balance))}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div class="supplier-actions">
            <button
              type="button"
              class="btn-icon-sm btn-icon-primary"
              data-action="edit"
              title="تعديل"
              aria-label="تعديل المورد"
            >
              <i class="fas fa-pen"></i>
            </button>

            <button
              type="button"
              class="btn-icon-sm btn-icon-danger"
              data-action="delete"
              title="حذف"
              aria-label="حذف المورد"
            >
              <i class="fas fa-trash"></i>
            </button>

            <span class="supplier-arrow">
              <i class="fas fa-chevron-left"></i>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadAccounts() {
    try {
      if (typeof API.getSupplierAccounts !== 'function') {
        state.accounts = [];
        return;
      }

      const data = await API.getSupplierAccounts();
      state.accounts = Array.isArray(data) ? data : [];
    } catch {
      state.accounts = [];
    }
  }

  async function loadSuppliers() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    els.list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <h4>جاري تحميل الموردين</h4>
        <p>يرجى الانتظار...</p>
      </div>
    `;

    try {
      const data = await API.getSuppliers();

      state.suppliers = Array.isArray(data) ? data : [];

      await loadAccounts();

      updateSummary();
      render();
    } catch (error) {
      console.error(error);

      els.list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-triangle-exclamation"></i>
          <h4>تعذر تحميل الموردين</h4>
          <p>${escapeHtml(error?.message || 'حدث خطأ أثناء الاتصال بالخادم')}</p>
        </div>
      `;

      toast(
        error?.message || 'حدث خطأ أثناء تحميل الموردين',
        'error'
      );
    } finally {
      state.loading = false;
    }
  }

  function openModal(supplier = null) {
    state.editingId = supplier ? Number(supplier.id) : null;

    els.modalTitle.textContent = supplier
      ? 'تعديل المورد'
      : 'إضافة مورد جديد';

    els.name.value = supplier?.name || '';
    els.phone.value = supplier?.phone || '';
    els.notes.value = supplier?.notes || '';
    els.active.checked =
      supplier?.is_active === undefined
        ? true
        : Boolean(supplier.is_active);

    els.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => els.name.focus(), 100);
  }

  function closeModal() {
    els.modal.classList.remove('active');
    document.body.style.overflow = '';
    state.editingId = null;
    state.saving = false;
  }

  async function saveSupplier() {
    if (state.saving) {
      return;
    }

    const name = els.name.value.trim();
    const phone = els.phone.value.trim();
    const notes = els.notes.value.trim();

    if (!name) {
      toast('يرجى إدخال اسم المورد', 'warning');
      els.name.focus();
      return;
    }

    state.saving = true;
    els.save.disabled = true;
    els.save.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      جاري الحفظ...
    `;

    const payload = {
      name,
      phone: phone || null,
      notes: notes || null,
      is_active: els.active.checked
    };

    try {
      if (state.editingId) {
        await API.updateSupplier(state.editingId, payload);
        toast('تم تحديث المورد بنجاح', 'success');
      } else {
        await API.createSupplier(payload);
        toast('تم إضافة المورد بنجاح', 'success');
      }

      closeModal();
      await loadSuppliers();
    } catch (error) {
      console.error(error);

      toast(
        error?.message || 'حدث خطأ أثناء حفظ المورد',
        'error'
      );
    } finally {
      state.saving = false;
      els.save.disabled = false;
      els.save.textContent = 'حفظ المورد';
    }
  }

  function deleteSupplier(id) {
    const supplier = state.suppliers.find(
      item => Number(item.id) === Number(id)
    );

    if (!supplier) {
      return;
    }

    const account = accountForSupplier(id);

    if (account.balance > 0) {
      toast(
        `لا يمكن حذف المورد لوجود مستحقات بقيمة ${currency(account.balance)}`,
        'error'
      );
      return;
    }

    confirmAction({
      title: 'حذف المورد',
      message: `هل أنت متأكد من حذف المورد "${supplier.name}"؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      danger: true,
      onConfirm: async () => {
        try {
          await API.deleteSupplier(id);

          toast('تم حذف المورد بنجاح', 'success');

          await loadSuppliers();
        } catch (error) {
          console.error(error);

          toast(
            error?.message || 'تعذر حذف المورد',
            'error'
          );
        }
      }
    });
  }

  function handleListClick(event) {
    const button = event.target.closest('[data-action]');

    if (!button) {
      return;
    }

    const card = button.closest('.supplier-card');

    if (!card) {
      return;
    }

    const id = Number(card.dataset.id);

    if (!id) {
      return;
    }

    const action = button.dataset.action;

    if (action === 'edit') {
      const supplier = state.suppliers.find(
        item => Number(item.id) === id
      );

      openModal(supplier);
      return;
    }

    if (action === 'delete') {
      deleteSupplier(id);
      return;
    }

    if (action === 'view') {
      window.location.href = `supplier-view.html?id=${id}`;
    }
  }

  function bindEvents() {
    els.addBtn?.addEventListener('click', () => {
      openModal();
    });

    els.fab?.addEventListener('click', () => {
      openModal();
    });

    els.search?.addEventListener('input', render);

    els.save?.addEventListener('click', saveSupplier);

    els.list?.addEventListener('click', handleListClick);

    document.querySelectorAll('[data-close="supplierModal"]')
      .forEach(element => {
        element.addEventListener('click', closeModal);
      });

    [els.name, els.phone, els.notes].forEach(input => {
      input?.addEventListener('keydown', event => {
        if (event.key === 'Enter' && input !== els.notes) {
          event.preventDefault();
          saveSupplier();
        }
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' &&
          els.modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  async function init() {
    if (!window.API) {
      setTimeout(init, 200);
      return;
    }

    bindEvents();
    await loadSuppliers();
  }

  init();
});