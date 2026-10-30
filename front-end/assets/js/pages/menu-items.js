'use strict';
(() => {
  const state = {
    items: [], page: 1, pages: 1, total: 0, loading: false, saving: false,
    editing: null, removedMedia: new Set(), previewUrls: [], requestId: 0,
    searchTimer: null,
  };
  const $ = id => document.getElementById(id);
  const e = value => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const fmt = value => new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  const images = item => (item.media || []).filter(m => m.type === 'image');
  const video = item => (item.media || []).find(m => m.type === 'video');

  function notify(message, kind = 'info') {
    if (window.Layout?.showToast) window.Layout.showToast(message, kind);
    else if (window.Utils?.showToast) window.Utils.showToast(message, kind);
    else if (kind === 'error') console.error(message);
    else console.info(message);
  }
  function message(text = '') {
    const box = $('menuMessage');
    if (!box) return;
    box.hidden = !text;
    box.textContent = text;
  }
  function setStats(counts) {
    if (!counts) return;
    $('menuCountAll').textContent = counts.all;
    $('menuCountPublished').textContent = counts.published;
    $('menuCountHidden').textContent = counts.hidden;
  }
  function setBusy(busy) {
    state.saving = busy;
    $('menuSubmitBtn').disabled = busy;
    $('menuResetBtn').disabled = busy;
    $('menuSubmitBtn').innerHTML = busy
      ? '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'
      : `<i class="fas fa-floppy-disk"></i> ${state.editing ? 'حفظ التعديلات' : 'حفظ المنتج'}`;
  }
  function revokePreviews() {
    state.previewUrls.forEach(url => URL.revokeObjectURL(url));
    state.previewUrls = [];
  }
  function fileUrl(file) {
    const url = URL.createObjectURL(file);
    state.previewUrls.push(url);
    return url;
  }
  function renderSelectedFiles() {
    revokePreviews();
    const selectedImages = [...$('menuImages').files];
    $('menuImagesPreview').innerHTML = selectedImages.map((file, i) =>
      `<div class="menu-media-thumb"><img src="${fileUrl(file)}" alt="صورة جديدة ${i + 1}"></div>`
    ).join('');
    const chosenVideo = $('menuVideo').files[0];
    $('menuVideoPreview').textContent = chosenVideo ? `الفيديو المختار: ${chosenVideo.name} (${(chosenVideo.size / (1024 * 1024)).toFixed(1)} ميجابايت)` : '';
  }
  function renderExistingMedia() {
    const existing = state.editing?.media || [];
    $('menuExistingMedia').hidden = !existing.length;
    $('menuExistingMediaGrid').innerHTML = existing.map(m => {
      const removed = state.removedMedia.has(Number(m.id));
      return `<div class="menu-media-thumb ${removed ? 'is-removed' : ''}" data-media-id="${m.id}">
        ${m.type === 'image'
          ? `<img src="${e(m.url)}" alt="صورة محفوظة" loading="lazy">`
          : `<video muted preload="none" controls playsinline src="${e(m.url)}"></video>`}
        <button type="button" data-remove-media="${m.id}" aria-label="${removed ? 'تراجع عن الإزالة' : 'إزالة الملف'}">${removed ? 'تراجع' : 'إزالة'}</button>
      </div>`;
    }).join('');
  }
  function resetForm() {
    if (state.saving) return;
    $('menuForm').reset();
    $('menuEditingId').value = '';
    $('menuPublished').checked = true;
    $('menuSortOrder').value = '0';
    state.editing = null;
    state.removedMedia.clear();
    revokePreviews();
    $('menuImagesPreview').innerHTML = '';
    $('menuVideoPreview').textContent = '';
    $('menuExistingMedia').hidden = true;
    $('menuExistingMediaGrid').innerHTML = '';
    $('menuFormHeading').textContent = 'إضافة منتج جديد';
    setBusy(false);
  }
  function startEdit(item) {
    resetForm();
    state.editing = item;
    $('menuEditingId').value = item.id;
    $('menuName').value = item.name || '';
    $('menuDescription').value = item.description || '';
    $('menuPrice').value = item.price ?? 0;
    $('menuSortOrder').value = item.sort_order || 0;
    $('menuPublished').checked = !!item.is_published;
    $('menuFormHeading').textContent = `تعديل: ${item.name}`;
    renderExistingMedia();
    setBusy(false);
    $('menuFormSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('menuName').focus({ preventScroll: true });
  }
  function card(item) {
    const image = images(item)[0];
    const hasVideo = !!video(item);
    const img = image
      ? `<img src="${e(image.url)}" loading="lazy" alt="${e(item.name)}">`
      : '<i class="fas fa-utensils menu-card-placeholder" aria-hidden="true"></i>';
    return `<article class="menu-card" data-item-id="${item.id}">
      <div class="menu-card-image">${img}
        <span class="menu-card-status ${item.is_published ? '' : 'hidden'}">${item.is_published ? 'منشور' : 'غير منشور'}</span>
        ${hasVideo ? '<span class="menu-video-pill"><i class="fas fa-play"></i> فيديو</span>' : ''}
      </div>
      <div class="menu-card-body"><div class="menu-card-kicker">${images(item).length ? images(item).length + ' صور' : 'بدون صور'}${hasVideo ? ' · فيديو' : ''}</div>
        <h3 class="menu-card-name" title="${e(item.name)}">${e(item.name)}</h3>
        <p class="menu-card-desc">${e(item.description || 'لا يوجد وصف لهذا المنتج.')}</p>
        <p class="menu-card-price">${fmt(item.price)} <small>ر.س</small></p>
      </div>
      <div class="menu-card-actions">
        <button type="button" data-menu-action="edit" data-id="${item.id}" title="تعديل المنتج"><i class="fas fa-pen"></i> تعديل</button>
        <button type="button" data-menu-action="publish" data-id="${item.id}" title="${item.is_published ? 'إخفاء من صفحة العملاء' : 'إظهار للعميل'}"><i class="fas fa-${item.is_published ? 'eye-slash' : 'eye'}"></i> ${item.is_published ? 'إخفاء' : 'نشر'}</button>
        <button type="button" class="is-danger" data-menu-action="delete" data-id="${item.id}" title="حذف المنتج"><i class="fas fa-trash"></i></button>
      </div></article>`;
  }
  function renderCards() {
    const grid = $('menuGrid');
    if (!state.items.length) {
      grid.innerHTML = `<div class="menu-empty"><i class="fas fa-box-open"></i><h3>لا توجد منتجات مطابقة</h3><p>أضف أول منتج من النموذج أو غيّر خيارات البحث والتصفية.</p></div>`;
    } else grid.innerHTML = state.items.map(card).join('');
    $('menuResultsInfo').textContent = `${state.items.length} من ${state.total} منتج`;
    $('menuLoadMore').hidden = state.page >= state.pages;
    $('menuLoadMore').disabled = state.loading;
  }
  async function fetchPage(page = 1, append = false) {
    if (!window.API?.request) {
      message('تعذر الاتصال بواجهة API. تأكد من تحميل api.js وتسجيل الدخول.');
      return;
    }
    const requestId = ++state.requestId;
    state.loading = true;
    message('');
    if (!append) {
      $('menuGrid').innerHTML = `<div class="menu-empty"><i class="fas fa-spinner fa-spin"></i><h3>جاري تحميل المنتجات...</h3></div>`;
    }
    $('menuRefreshBtn').disabled = true;
    $('menuLoadMore').disabled = true;
    try {
      const response = await API.request('/menu-items', {
        query: {
          page, per_page: 24, search: $('menuSearch').value.trim(),
          status: $('menuFilterStatus').value,
        },
      });
      if (requestId !== state.requestId) return;
      if (!Array.isArray(response?.data)) throw new Error('تنسيق استجابة المنتجات غير متوقع.');
      state.items = append ? [...state.items, ...response.data] : response.data;
      state.page = response.pagination?.page || page;
      state.pages = response.pagination?.pages || 1;
      state.total = response.pagination?.total ?? state.items.length;
      setStats(response.counts);
      renderCards();
    } catch (error) {
      if (requestId !== state.requestId) return;
      message(error?.message || 'تعذر تحميل المنتجات. تحقق من الخادم ثم أعد المحاولة.');
      if (!append) {
        state.items = [];
        state.total = 0;
        renderCards();
      }
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        $('menuRefreshBtn').disabled = false;
        $('menuLoadMore').disabled = false;
      }
    }
  }
  function validateFiles() {
    const selected = [...$('menuImages').files];
    const existingImages = (state.editing?.media || [])
      .filter(m => m.type === 'image' && !state.removedMedia.has(Number(m.id))).length;
    if (selected.length + existingImages > 6) throw new Error('الحد الأقصى 6 صور للمنتج. قم بإزالة صور محفوظة قبل إضافة غيرها.');
    if (selected.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) {
      throw new Error('اختر صور JPG أو PNG أو WEBP أو GIF بحجم لا يزيد عن 5 ميجابايت للصورة.');
    }
    const selectedVideo = $('menuVideo').files[0];
    if (selectedVideo && (selectedVideo.size > 50 * 1024 * 1024 || !['video/mp4','video/webm','video/quicktime'].includes(selectedVideo.type))) {
      throw new Error('الفيديو يجب أن يكون MP4 أو WEBM أو MOV وحجمه لا يزيد عن 50 ميجابايت.');
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (state.saving) return;
    try {
      const name = $('menuName').value.trim();
      const priceInput = $('menuPrice').value;
      const price = Number(priceInput);
      if (!name) throw new Error('اسم المنتج مطلوب.');
      if (priceInput === '' || !Number.isFinite(price) || price < 0) throw new Error('أدخل سعرًا صحيحًا غير سالب.');
      validateFiles();
      const body = new FormData();
      body.append('name', name);
      body.append('description', $('menuDescription').value.trim());
      body.append('price', price.toFixed(2));
      body.append('sort_order', $('menuSortOrder').value || '0');
      body.append('is_published', $('menuPublished').checked ? '1' : '0');
      [...$('menuImages').files].forEach(file => body.append('images[]', file));
      const chosenVideo = $('menuVideo').files[0];
      if (chosenVideo) body.append('video', chosenVideo);
      state.removedMedia.forEach(id => body.append('remove_media_ids[]', String(id)));
      const editId = state.editing?.id;
      if (editId) body.append('_method', 'PUT');
      setBusy(true);
      await API.request(editId ? `/menu-items/${editId}` : '/menu-items', {
        method: 'POST', body,
      });
      notify(editId ? 'تم حفظ تعديلات المنتج.' : 'تم إضافة المنتج إلى المنيو.', 'success');
      setBusy(false);
      resetForm();
      await fetchPage(1);
    } catch (error) {
      console.error('Menu item save:', error);
      notify(error?.message || 'تعذر حفظ المنتج.', 'error');
    } finally {
      setBusy(false);
    }
  }
  async function togglePublish(item, button) {
    button.disabled = true;
    try {
      const form = new FormData();
      form.append('_method', 'PUT');
      form.append('is_published', item.is_published ? '0' : '1');
      await API.request(`/menu-items/${item.id}`, { method: 'POST', body: form });
      notify(item.is_published ? 'تم إخفاء المنتج.' : 'تم نشر المنتج.', 'success');
      if (Number(state.editing?.id) === Number(item.id)) $('menuPublished').checked = !item.is_published;
      await fetchPage(1);
    } catch (error) {
      notify(error?.message || 'تعذر تغيير حالة النشر.', 'error');
      button.disabled = false;
    }
  }
  async function deleteItem(item, button) {
    if (!window.confirm(`حذف «${item.name}» نهائيًا مع جميع صوره وفيديوهاته؟\nلا يمكن استرجاع هذه العملية.`)) return;
    button.disabled = true;
    try {
      await API.request(`/menu-items/${item.id}`, { method: 'DELETE' });
      if (Number(state.editing?.id) === Number(item.id)) resetForm();
      notify('تم حذف المنتج.', 'success');
      await fetchPage(1);
    } catch (error) {
      notify(error?.message || 'تعذر حذف المنتج.', 'error');
      button.disabled = false;
    }
  }
  function bind() {
    $('menuForm').addEventListener('submit', submit);
    $('menuResetBtn').addEventListener('click', () => resetForm());
    ['menuImages', 'menuVideo'].forEach(id => $(id).addEventListener('change', renderSelectedFiles));
    $('menuExistingMediaGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-media]');
      if (!button) return;
      const id = Number(button.dataset.removeMedia);
      if (state.removedMedia.has(id)) state.removedMedia.delete(id);
      else state.removedMedia.add(id);
      renderExistingMedia();
    });
    $('menuGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-menu-action]');
      if (!button || state.saving) return;
      const item = state.items.find(x => Number(x.id) === Number(button.dataset.id));
      if (!item) return;
      if (button.dataset.menuAction === 'edit') startEdit(item);
      else if (button.dataset.menuAction === 'publish') togglePublish(item, button);
      else if (button.dataset.menuAction === 'delete') deleteItem(item, button);
    });
    $('menuRefreshBtn').addEventListener('click', () => fetchPage(1));
    $('menuLoadMore').addEventListener('click', () => fetchPage(state.page + 1, true));
    $('menuSearch').addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => fetchPage(1), 330);
    });
    $('menuFilterStatus').addEventListener('change', () => fetchPage(1));
    window.addEventListener('pagehide', revokePreviews);
  }
  function init() {
    bind();
    fetchPage(1);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
