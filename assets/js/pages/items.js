// ============================================================
// assets/js/pages/items.js
// (معدل لإزالة مستمع FAB والاعتماد على layout.js)
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ---- الحالة (State) ----
  let items = [];
  let editingId = null;

  // ---- عناصر DOM ----
  const listEl = document.getElementById('itemsList');
  const searchInput = document.getElementById('itemSearch');
  const countEl = document.getElementById('itemsCount');
  const minPriceEl = document.getElementById('minPrice');
  const maxPriceEl = document.getElementById('maxPrice');

  const modal = document.getElementById('itemModal');
  const modalTitle = document.getElementById('itemModalTitle');
  const nameInput = document.getElementById('itemName');
  const priceInput = document.getElementById('itemPrice');
  const saveBtn = document.getElementById('saveItemBtn');
  const addBtn = document.getElementById('addItemBtn');
  // تم إزالة fab لأنه سيتم التحكم به من layout.js

  // ---- دوال مساعدة ----
  function formatCurrency(amount) {
    if (window.API && typeof window.API.formatCurrency === 'function') {
      return window.API.formatCurrency(amount);
    }
    return Number(amount).toLocaleString('ar-SA') + ' ر.س';
  }

  // ---- تحميل البيانات ----
  function loadItems() {
    if (!window.API || typeof window.API.getItems !== 'function') {
      console.warn('API not ready, retrying...');
      setTimeout(loadItems, 100);
      return;
    }
    items = window.API.getItems();
    renderItems();
    updateSummary();
  }

  // ---- عرض الأصناف ----
  function renderItems(filter = '') {
    if (!items || items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tags"></i>
          <h4>لا توجد أصناف</h4>
          <p>${filter ? 'لم يتم العثور على أصناف مطابقة للبحث' : 'أضف أول صنف لك الآن'}</p>
        </div>
      `;
      return;
    }

    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tags"></i>
          <h4>لا توجد أصناف</h4>
          <p>لم يتم العثور على أصناف مطابقة للبحث</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(item => `
      <div class="item-card" data-id="${item.id}">
        <div class="icon"><i class="fas fa-utensils"></i></div>
        <div class="info">
          <div class="name">${item.name}</div>
          <div class="details">
            <span class="price">${formatCurrency(item.price)}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn-icon-sm btn-icon-primary" data-action="edit" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="btn-icon-sm btn-icon-danger" data-action="delete" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // ---- تحديث الملخص ----
  function updateSummary() {
    if (!items || items.length === 0) {
      countEl.textContent = '0';
      minPriceEl.textContent = '0 ر.س';
      maxPriceEl.textContent = '0 ر.س';
      return;
    }
    const total = items.length;
    const prices = items.map(i => i.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    countEl.textContent = total;
    minPriceEl.textContent = formatCurrency(min);
    maxPriceEl.textContent = formatCurrency(max);
  }

  // ---- فتح المودال (إضافة أو تعديل) ----
  function openModal(item = null) {
    if (item) {
      editingId = item.id;
      modalTitle.textContent = 'تعديل الصنف';
      nameInput.value = item.name || '';
      priceInput.value = item.price || '';
    } else {
      editingId = null;
      modalTitle.textContent = 'إضافة صنف جديد';
      nameInput.value = '';
      priceInput.value = '';
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => nameInput.focus(), 100);
  }

  // ---- إغلاق المودال ----
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
  }

  // ---- حفظ الصنف ----
  function handleSaveItem() {
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);

    if (!name) {
      showToast('يرجى إدخال اسم الصنف', 'warning');
      nameInput.focus();
      return;
    }
    if (!price || price <= 0) {
      showToast('يرجى إدخال سعر صحيح', 'warning');
      priceInput.focus();
      return;
    }

    try {
      if (editingId) {
        const existing = items.find(i => i.id === editingId);
        const unit = (existing && existing.unit) || 'قطعة';
        window.API.updateItem(editingId, name, unit, price);
        showToast(`تم تحديث الصنف "${name}" بنجاح`, 'success');
      } else {
        window.API.addItem(name, 'قطعة', price);
        showToast(`تم إضافة الصنف "${name}" بنجاح`, 'success');
      }

      items = window.API.getItems();
      renderItems(searchInput.value.trim());
      updateSummary();
      closeModal();

    } catch (err) {
      showToast(err.message || 'حدث خطأ أثناء حفظ الصنف', 'error');
    }
  }

  // ---- حذف صنف ----
  function handleDeleteItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    showConfirm({
      title: 'حذف الصنف',
      message: `هل أنت متأكد من حذف الصنف "${item.name}"؟`,
      confirmText: 'حذف',
      danger: true,
      onConfirm: function() {
        try {
          window.API.deleteItem(id);
          showToast(`تم حذف الصنف "${item.name}" بنجاح`, 'success');
          items = window.API.getItems();
          renderItems(searchInput.value.trim());
          updateSummary();
        } catch (err) {
          showToast(err.message || 'حدث خطأ أثناء حذف الصنف', 'error');
        }
      }
    });
  }

  // ---- تهيئة الصفحة ----
  function init() {
    if (!window.API) {
      console.warn('API not found, waiting...');
      setTimeout(init, 200);
      return;
    }

    loadItems();

    // ---- البحث ----
    searchInput.addEventListener('input', function() {
      renderItems(this.value.trim());
    });

    // ---- زر "إضافة صنف" في الـ Header ----
    addBtn.addEventListener('click', function() {
      openModal(null);
    });

    // ---- استماع لحدث فتح المودال من FAB (الذي يديره layout.js) ----
    document.addEventListener('fab:modal:opened', function(e) {
      if (e.detail.modalId === 'itemModal') {
        // فتح المودال في وضع الإضافة (تفريغ الحقول)
        openModal(null);
      }
    });

    // ---- حفظ الصنف ----
    saveBtn.addEventListener('click', handleSaveItem);

    // ---- إغلاق المودال ----
    document.querySelectorAll('[data-close="itemModal"]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // ---- إغلاق المودال بالـ ESC ----
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    // ---- الضغط على Enter ----
    [nameInput, priceInput].forEach(input => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveItem();
        }
      });
    });

    // ---- أحداث التعديل والحذف ----
    listEl.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const card = btn.closest('.item-card');
      if (!card) return;

      const id = parseInt(card.dataset.id);
      const action = btn.dataset.action;

      if (action === 'edit') {
        const item = items.find(i => i.id === id);
        if (item) openModal(item);
      } else if (action === 'delete') {
        handleDeleteItem(id);
      }
    });
  }

  // ---- بدء التشغيل ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
});