/* مطابخ شواطئ عدن — Guest menu shared logic. NO admin API, tokens or auth redirects. */
(() => {
  'use strict';
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const configured = typeof window.MENU_PUBLIC_API_BASE === 'string' ? window.MENU_PUBLIC_API_BASE.trim() : '';
  const defaultApi = local ? `http://${location.hostname}:8000/api` : 'https://api.restaurant.technova.fun/api';
  const API_BASE = (configured || defaultApi).replace(/\/+$/, '');
  const DEMO = new URLSearchParams(location.search).get('demo') === '1';
  const KEY = DEMO ? 'aden-menu-cart-DEMO-v1' : 'aden-menu-cart-v1';
  const fmt = new Intl.NumberFormat('ar-SA', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const countFmt = new Intl.NumberFormat('ar-SA');
  const fallbackRestaurant = { name: 'مطابخ شواطئ عدن', description: 'للحجوزات والولائم والمناسبات', phone: '', whatsapp: '', address: '', instagram: '', facebook: '', logo: '' };
  const sample = [
    {id: 90001, name: 'مندي لحم', description: 'طبق مندي بتتبيلة متوازنة وأرز بسمتي، يُجهّز حسب حجم المناسبة واحتياجها.', price: 280, sort_order: 1, is_published: true, media: []},
    {id: 90002, name: 'مظبي دجاج', description: 'دجاج مشوي بنكهة مميزة مع الأرز والإضافات المتفق عليها.', price: 85, sort_order: 2, is_published: true, media: []},
    {id: 90003, name: 'بوفيه مناسبات', description: 'ترتيب وجبات وبوفيه للمناسبات؛ تُحدّد التفاصيل النهائية بالتنسيق مع المطعم.', price: 0, sort_order: 3, is_published: true, media: []},
    {id: 90004, name: 'طباخ للمناسبة', description: 'خدمة طباخ للمناسبات والولائم، مع تحديد عدد الضيوف والمتطلبات.', price: 0, sort_order: 4, is_published: true, media: []},
    {id: 90005, name: 'سلطات ومقبلات', description: 'تشكيلة من المقبلات والسلطات، ويمكن طلب كميات متعددة.', price: 45, sort_order: 5, is_published: true, media: []},
    {id: 90006, name: 'تجهيز وتقديم', description: 'خدمة تنسيق وتقديم الوجبات للضيوف حسب اتفاقك مع المطعم.', price: 0, sort_order: 6, is_published: true, media: []},
  ];
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function val(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function money(value) { return fmt.format(val(value)) + ' ر.س'; }
  function priceText(value) { return val(value) > 0 ? money(value) : 'حسب الاتفاق'; }
  function imageUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(String(url), API_BASE.replace(/\/api\/?$/, '/') );
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch { return ''; }
  }
  function logoUrl(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^https?:\/\//i.test(raw)) return imageUrl(raw);
    if (raw.startsWith('/storage/')) return imageUrl(raw);
    return imageUrl('/storage/' + raw.replace(/^\/+/, ''));
  }
  function media(item, kind) { return (Array.isArray(item?.media) ? item.media : []).filter(m => m.type === kind && imageUrl(m.url)); }
  function firstImage(item) { return imageUrl(media(item, 'image')[0]?.url); }
  function safeExternal(value) {
    if (!value) return '';
    const src = String(value).trim();
    if (!/^https?:\/\//i.test(src)) return '';
    return imageUrl(src);
  }
  function whatsappDigits(restaurant) {
    const raw = String(restaurant?.whatsapp || restaurant?.phone || '').trim();
    let s = raw.replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('00')) s = s.slice(2);
    // For Saudi 05xxxxxxxx numbers, dial with country code; other international numbers unchanged.
    if (/^05\d{8}$/.test(s)) s = '966' + s.slice(1);
    return /^\d{8,15}$/.test(s) ? s : '';
  }
  function cartGet() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(it => Number.isInteger(Number(it.id)) && Number(it.id) > 0 && Number(it.quantity) > 0 && Number(it.quantity) <= 99)
        .map(it => ({id:Number(it.id), name:String(it.name || '').slice(0,200), price:Math.max(0,val(it.price)), quantity:Math.max(1,Math.min(99,Math.floor(val(it.quantity)))), image:imageUrl(it.image)})) : [];
    } catch { return []; }
  }
  function cartSet(cart) {
    const rows = cart.slice(0, 100).map(it => ({id:it.id, name:it.name, price:it.price, quantity:it.quantity, image:it.image || ''}));
    localStorage.setItem(KEY, JSON.stringify(rows));
    document.dispatchEvent(new CustomEvent('menu:cart-changed'));
  }
  function add(item, quantity = 1) {
    const cart = cartGet(); const id = Number(item.id);
    const found = cart.find(it => it.id === id);
    if (found) found.quantity = Math.min(99, found.quantity + quantity);
    else cart.push({id, name:item.name, price:val(item.price), quantity:Math.min(99, quantity), image:firstImage(item)});
    cartSet(cart);
  }
  function setQty(id, qty) {
    let cart = cartGet();
    const item = cart.find(it => it.id === Number(id));
    if (!item) return;
    if (qty <= 0) cart = cart.filter(it => it !== item);
    else item.quantity = Math.min(99, Math.max(1, Math.floor(qty)));
    cartSet(cart);
  }
  function cartSummary(cart = cartGet()) {
    return { quantity:cart.reduce((s, it) => s + it.quantity, 0), total:cart.reduce((s, it) => s + it.quantity * it.price, 0), needsQuote:cart.some(it => it.price <= 0) };
  }
  async function getJson(path, query = {}) {
    const url = new URL(API_BASE + path);
    for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const res = await fetch(url.href, {method:'GET', headers:{Accept:'application/json'}, cache:'no-store', credentials:'omit'});
    if (!res.ok) throw new Error(res.status === 404 ? 'المسار العام غير متاح (404). تحقق من تسجيل مسارات المنيو العامة في Laravel.' : `تعذر الاتصال ببيانات المطعم (HTTP ${res.status})`);
    const json = await res.json();
    if (json?.success === false) throw new Error(json.message || 'تعذر تحميل البيانات');
    return json;
  }
  async function restaurant() {
    if (DEMO) return {...fallbackRestaurant, address:'بيانات تجريبية — نسخة للمعاينة'};
    try { const json = await getJson('/public/restaurant'); return {...fallbackRestaurant, ...(json.data || {})}; }
    catch (err) { console.warn('Public restaurant endpoint:', err.message); return {...fallbackRestaurant, _loadError:err.message}; }
  }
  async function products(search = '') {
    if (DEMO) {
      const filtered = sample.filter(it => (it.name + ' ' + it.description).includes(search));
      return {items:filtered, total:filtered.length};
    }
    const all = []; let pages = 1;
    // Pagination is required by V14.1 publicIndex; fetch all published products so cart revalidation is reliable.
    for (let page = 1; page <= pages && page <= 100; page++) {
      const json = await getJson('/public/menu-items', {page, per_page:48, search});
      if (!Array.isArray(json.data)) throw new Error('استجابة المنيو لا تحتوي على المنتجات المتوقعة');
      all.push(...json.data);
      pages = Math.max(1, Number(json.pagination?.pages) || 1);
    }
    if (pages > 100) throw new Error('عدد صفحات المنيو كبير جدًا؛ يلزم تحسين استعلام المنتجات قبل متابعة الطلب.');
    return {items:all.filter(it => it.is_published !== false),total:all.length};
  }
  function toast(text, error = false) {
    const box = document.getElementById('guestToast'); if (!box) return;
    box.textContent = text; box.className = 'guest-toast show' + (error ? ' is-error' : '');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove('show'), 3400);
  }
  function renderBrand(r) {
    document.querySelectorAll('[data-shop-name]').forEach(el => el.textContent = r.name || fallbackRestaurant.name);
    document.querySelectorAll('[data-shop-about]').forEach(el => el.textContent = r.description || fallbackRestaurant.description);
    document.querySelectorAll('[data-shop-address]').forEach(el => el.textContent = r.address || 'للاستفسار عن الموقع تواصل معنا');
    document.querySelectorAll('[data-shop-phone]').forEach(el => el.textContent = r.phone || 'رقم التواصل غير مضاف');
    document.querySelectorAll('[data-shop-logo]').forEach(el => {
      const url = logoUrl(r.logo);
      if (!url) return;
      const img = document.createElement('img'); img.src = url; img.alt = `شعار ${r.name || 'المطعم'}`;
      img.onload = () => { el.replaceChildren(img); }; img.onerror = () => img.remove();
    });
    const whats = whatsappDigits(r);
    document.querySelectorAll('[data-shop-whatsapp]').forEach(el => {
      if (whats && !DEMO) { el.href = `https://wa.me/${whats}`; el.removeAttribute('aria-disabled'); }
      else { el.href = '#contact'; el.setAttribute('aria-disabled', 'true'); }
    });
    const insta = safeExternal(r.instagram), facebook = safeExternal(r.facebook);
    for (const [key,url] of [['instagram',insta],['facebook',facebook]]) {
      document.querySelectorAll(`[data-shop-${key}]`).forEach(el => { if (url) { el.href=url; el.hidden=false; } else el.hidden=true; });
    }
    if (r._loadError) document.querySelectorAll('[data-restaurant-error]').forEach(el => {el.textContent='تعذر تحميل تفاصيل التواصل؛ تحقق من مسار /api/public/restaurant قبل إرسال الطلبات.';el.hidden=false;});
  }
  const icon = (name) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const placeholder = () => `<div class="product-placeholder"><span class="plate-art"><span>✦</span></span></div>`;
  window.GuestMenu = {API_BASE,DEMO,KEY,fmt,countFmt,fallbackRestaurant,esc,val,money,priceText,imageUrl,logoUrl,media,firstImage,whatsappDigits,cartGet,cartSet,cartSummary,add,setQty,products,restaurant,toast,renderBrand,icon,placeholder};
})();
