/* Suppliers list: account totals, create/update, safe deletion, independent loads. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const state = { suppliers: [], accounts: [], accountsReady: false, loading: false, saving: false, editingId: null };
  const byId = (id) => document.getElementById(id);
  const ui = {
    list: byId('suppliersList'), search: byId('supplierSearch'), count: byId('suppliersCount'),
    payables: byId('suppliersPayables'), paid: byId('suppliersPaid'), notice: byId('suppliersDataNotice'),
    add: byId('addSupplierBtn'), modal: byId('supplierModal'), title: byId('supplierModalTitle'),
    name: byId('supplierName'), phone: byId('supplierPhone'), notes: byId('supplierNotes'),
    active: byId('supplierActive'), save: byId('saveSupplierBtn')
  };
  if (!ui.list) return;

  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'}[c])); }
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function money(v) { return window.API?.formatCurrency?.(num(v)) ?? num(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س'; }
  function toast(message, type = 'info') {
    if (window.Layout?.showToast) return window.Layout.showToast(message, type);
    const el = byId('toastContainer');
    if (el) { const b = document.createElement('div'); b.className = `toast toast-${type}`; b.textContent = message; el.appendChild(b); setTimeout(() => b.remove(), 3500); }
    else console[type === 'error' ? 'error' : 'log'](message);
  }
  function initials(name) { return String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'م'; }
  function accountFor(id) {
    if (!state.accountsReady) return null;
    const a = state.accounts.find(x => Number(x.supplier_id ?? x.supplier?.id ?? x.id) === Number(id));
    if (!a) return null;
    const invoices = num(a.invoices_total ?? a.total_invoices ?? a.totalInvoices);
    const payments = num(a.payments_total ?? a.total_paid ?? a.totalPaid);
    return {
      invoices, payments, balance: num(a.balance ?? invoices - payments),
      invoicesCount: a.invoices_count === undefined ? null : num(a.invoices_count),
      paymentsCount: a.payments_count === undefined ? null : num(a.payments_count)
    };
  }
  function notice(msg) {
    if (!ui.notice) return;
    ui.notice.hidden = !msg;
    ui.notice.textContent = msg || '';
  }
  function summary() {
    ui.count.textContent = state.suppliers.length.toLocaleString('ar-SA');
    if (!state.accountsReady || state.suppliers.some(s => !accountFor(s.id))) {
      ui.payables.textContent = '—'; ui.paid.textContent = '—';
      notice('تعذر تحميل جميع الحسابات المالية. لا تعتمد على الأرصدة حتى إعادة المحاولة.');
      return;
    }
    const totals = state.suppliers.reduce((a, s) => {
      const x = accountFor(s.id);
      a.payables += Math.max(0, x.balance);
      a.paid += x.payments;
      return a;
    }, { payables: 0, paid: 0 });
    ui.payables.textContent = money(totals.payables);
    ui.paid.textContent = money(totals.paid);
    notice('');
  }
  function render() {
    const q = (ui.search?.value || '').trim().toLowerCase();
    const matches = state.suppliers.filter(s => [s.name, s.phone, s.notes].some(x => String(x ?? '').toLowerCase().includes(q)));
    if (!matches.length) {
      ui.list.innerHTML = `<div class="empty-state"><i class="fas fa-truck"></i><h4>${q ? 'لا توجد نتائج مطابقة' : 'لا يوجد موردون'}</h4><p>${q ? 'جرّب كلمة بحث أخرى' : 'أضف أول مورد الآن'}</p></div>`;
      return;
    }
    ui.list.innerHTML = matches.map(s => {
      const a = accountFor(s.id);
      let balances = '<span class="account-item"><span class="account-label">البيانات المالية</span><strong>غير متاحة</strong></span>';
      if (a) {
        const balanceLabel = a.balance > 0.005 ? 'مستحق' : a.balance < -0.005 ? 'رصيد دائن' : 'الرصيد';
        const value = Math.abs(a.balance) < 0.005 ? 0 : Math.abs(a.balance);
        balances = `<span class="account-item"><span class="account-label">فواتير:</span><span class="account-value">${money(a.invoices)}</span></span>
          <span class="account-item"><span class="account-label">مدفوع:</span><span class="account-value success">${money(a.payments)}</span></span>
          <span class="account-item"><span class="account-label">${balanceLabel}:</span><span class="account-value ${a.balance > 0.005 ? 'danger' : a.balance < -0.005 ? 'credit' : 'success'}">${money(value)}</span></span>`;
      }
      const active = s.is_active !== false && s.is_active !== 0;
      return `<article class="supplier-card ${active ? '' : 'inactive'}" data-id="${esc(s.id)}">
        <a class="supplier-main" href="supplier-view.html?id=${encodeURIComponent(s.id)}" aria-label="ملف المورد ${esc(s.name)}">
          <div class="supplier-avatar">${esc(initials(s.name))}</div><div class="supplier-info"><div class="supplier-name">${esc(s.name || 'بدون اسم')}</div>
          <div class="supplier-phone">${esc(s.phone || '—')}</div><div class="supplier-account">${balances}</div>
          ${!active ? '<span class="supplier-inactive-label">غير نشط</span>' : ''}</div></a>
        <div class="supplier-actions"><button type="button" class="btn-icon-sm btn-icon-primary" data-action="edit" aria-label="تعديل المورد" title="تعديل"><i class="fas fa-pen"></i></button>
        <button type="button" class="btn-icon-sm btn-icon-danger" data-action="delete" aria-label="حذف المورد" title="حذف"><i class="fas fa-trash"></i></button></div></article>`;
    }).join('');
  }
  function unwrapArray(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    throw new Error('تنسيق البيانات الواردة من الخادم غير متوقع');
  }
  async function load() {
    if (state.loading) return;
    state.loading = true;
    ui.list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>جاري تحميل الموردين...</h4></div>';
    try {
      const [suppliersResult, accountsResult] = await Promise.allSettled([
        window.API.getSuppliers(), window.API.getSupplierAccounts()
      ]);
      if (suppliersResult.status !== 'fulfilled') throw suppliersResult.reason;
      state.suppliers = unwrapArray(suppliersResult.value);
      state.accountsReady = accountsResult.status === 'fulfilled';
      try { state.accounts = state.accountsReady ? unwrapArray(accountsResult.value) : []; }
      catch (e) { state.accountsReady = false; state.accounts = []; }
      summary(); render();
    } catch (err) {
      state.accountsReady = false; state.suppliers = []; state.accounts = [];
      ui.count.textContent = '—'; ui.payables.textContent = '—'; ui.paid.textContent = '—';
      notice('تعذر تحميل الموردين.');
      ui.list.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>تعذر تحميل البيانات</h4><p>${esc(err?.message || 'حدث خطأ في الاتصال')}</p><button type="button" class="btn btn-primary" id="retrySuppliers">إعادة المحاولة</button></div>`;
      byId('retrySuppliers')?.addEventListener('click', load);
    } finally { state.loading = false; }
  }
  function openModal(s = null) {
    if (state.saving) return;
    state.editingId = s?.id ?? null;
    ui.title.textContent = s ? 'تعديل المورد' : 'إضافة مورد جديد';
    ui.name.value = s?.name || ''; ui.phone.value = s?.phone || ''; ui.notes.value = s?.notes || '';
    ui.active.checked = s ? s.is_active !== false && s.is_active !== 0 : true;
    ui.save.textContent = s ? 'حفظ التعديلات' : 'حفظ المورد';
    ui.modal.classList.add('active'); document.body.style.overflow = 'hidden';
    ui.name.focus();
  }
  function closeModal() {
    if (state.saving) return;
    ui.modal.classList.remove('active'); document.body.style.overflow = '';
    state.editingId = null;
  }
  async function save() {
    if (state.saving) return;
    const name = ui.name.value.trim(), phone = ui.phone.value.trim();
    if (!name || !phone) { toast('اسم المورد ورقم الجوال مطلوبان', 'warning'); (!name ? ui.name : ui.phone).focus(); return; }
    const other = state.suppliers.find(s => String(s.phone || '').trim() === phone && String(s.id) !== String(state.editingId));
    if (other) { toast('رقم الجوال مستخدم لدى مورد آخر', 'warning'); ui.phone.focus(); return; }
    state.saving = true; ui.save.disabled = true; ui.save.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الحفظ...';
    try {
      const payload = { name, phone, notes: ui.notes.value.trim() || null, is_active: Boolean(ui.active.checked) };
      if (state.editingId) await API.updateSupplier(state.editingId, payload);
      else await API.createSupplier(payload);
      state.saving = false; closeModal(); toast('تم حفظ بيانات المورد', 'success'); await load();
    } catch (e) { toast(e?.message || 'تعذر حفظ المورد', 'error'); }
    finally { state.saving = false; ui.save.disabled = false; ui.save.textContent = state.editingId ? 'حفظ التعديلات' : 'حفظ المورد'; }
  }
  async function askConfirm(title, message) {
    // Native confirm is used here because some installed Layout versions do not resolve on cancellation.
    return window.confirm(`${title}\n\n${message}`);
  }
  async function remove(id) {
    const s = state.suppliers.find(x => Number(x.id) === Number(id)); if (!s) return;
    const a = accountFor(id);
    if (a && (a.invoicesCount > 0 || a.paymentsCount > 0)) {
      toast('لا يمكن حذف المورد لوجود فواتير أو دفعات مرتبطة به. يمكنك تعطيله من التعديل.', 'warning'); return;
    }
    if (!await askConfirm('حذف المورد', `هل تريد حذف المورد «${s.name}»؟\nلا يمكن حذف مورد له معاملات مالية.`)) return;
    try { await API.deleteSupplier(id); toast('تم حذف المورد', 'success'); await load(); }
    catch (e) { toast(e?.message || 'تعذر حذف المورد', 'error'); }
  }
  ui.add?.addEventListener('click', () => openModal());
  ui.search?.addEventListener('input', render);
  ui.save?.addEventListener('click', save);
  ui.list.addEventListener('click', e => {
    const button = e.target.closest('[data-action]'); if (!button) return;
    const id = Number(button.closest('.supplier-card')?.dataset.id);
    if (button.dataset.action === 'edit') openModal(state.suppliers.find(s => Number(s.id) === id));
    if (button.dataset.action === 'delete') remove(id);
  });
  document.querySelectorAll('[data-close="supplierModal"]').forEach(x => x.addEventListener('click', closeModal));
  document.addEventListener('fab:modal:opened', e => { if (e.detail?.modalId === 'supplierModal') openModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal?.classList.contains('active')) closeModal(); });
  [ui.name, ui.phone].forEach(x => x?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }));
  load();
});
