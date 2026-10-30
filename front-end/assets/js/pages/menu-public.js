(() => {
  'use strict';
  const M = window.GuestMenu;
  const $ = id => document.getElementById(id);
  const state = {items:[], visible:[], selected:null, galleryIndex:0, restaurant:null, requestId:0};
  function cartPaint() {
    const cart = M.cartGet(), totals = M.cartSummary(cart);
    $('cartCount').textContent = totals.quantity;
    $('mobileCartCount').textContent = totals.quantity;
    $('mobileCartTotal').textContent = M.money(totals.total) + (totals.needsQuote ? ' + حسب الاتفاق' : '');
    $('cartPanelCount').textContent = totals.quantity + ' منتجات';
    $('cartPanelTotal').textContent = M.money(totals.total) + (totals.needsQuote ? ' + حسب الاتفاق' : '');
    $('cartCheckout').disabled = !cart.length;
    $('drawerCartList').innerHTML = cart.length ? cart.map(it => `<article class="cart-line" data-id="${it.id}">
      <div class="cart-mini-photo">${it.image ? `<img src="${M.esc(it.image)}" alt="">` : M.icon('food')}</div>
      <div class="cart-line-body"><strong>${M.esc(it.name)}</strong><span>${M.priceText(it.price)}</span>
      <div class="quantity-control"><button type="button" data-cart-minus="${it.id}" aria-label="تقليل العدد">−</button><output>${it.quantity}</output><button type="button" data-cart-plus="${it.id}" aria-label="زيادة العدد">+</button></div></div>
      <button type="button" class="remove-line" data-cart-remove="${it.id}" aria-label="حذف المنتج">${M.icon('close')}</button>
      </article>`).join('') : `<div class="empty-cart">${M.icon('bag')}<h3>السلة فارغة</h3><p>اختر ما يعجبك من الأطباق والخدمات وأضفه هنا.</p></div>`;
  }
  function itemCard(it, index) {
    const imgs = M.media(it,'image');const video=M.media(it,'video');
    return `<article class="product-card" data-id="${it.id}">
      <button type="button" class="product-image" data-details="${it.id}" aria-label="عرض تفاصيل ${M.esc(it.name)}">
        ${imgs.length ? `<img src="${M.esc(M.imageUrl(imgs[0].url))}" alt="${M.esc(it.name)}" loading="lazy">` : M.placeholder()}
        ${video.length ? `<span class="media-tag">${M.icon('play')} فيديو</span>` : ''}
        ${imgs.length > 1 ? `<span class="photos-tag">${imgs.length} صور</span>` : ''}
      </button>
      <div class="product-copy"><div class="product-kicker">${M.esc(index.toString().padStart(2,'0'))} · من قائمتنا</div>
        <h3>${M.esc(it.name)}</h3><p>${M.esc(it.description || 'اطلع على تفاصيل الطبق أو الخدمة وتواصل معنا لتحديد طلبك.')}</p>
        <div class="product-bottom"><div class="price-label"><span>السعر</span><strong>${M.priceText(it.price)}</strong></div>
        <button type="button" class="add-product" data-add="${it.id}" aria-label="إضافة ${M.esc(it.name)} للسلة">${M.icon('plus')}</button></div>
      </div>
    </article>`;
  }
  function renderProducts() {
    $('productCount').textContent = `${M.countFmt.format(state.visible.length)} منتج وخدمة`;
    $('productGrid').innerHTML = state.visible.length ? state.visible.map(itemCard).join('') : `<div class="menu-empty">${M.icon('search')}<h3>لا توجد منتجات مطابقة</h3><p>جرّب كلمة أخرى للبحث.</p><button type="button" id="clearSearch">إظهار الكل</button></div>`;
    $('clearSearch')?.addEventListener('click',()=>{$('menuSearch').value=''; applySearch();});
  }
  function applySearch() {
    const query = $('menuSearch').value.trim().toLocaleLowerCase('ar');
    state.visible = state.items.filter(it => (it.name+' '+(it.description||'')).toLocaleLowerCase('ar').includes(query));
    renderProducts();
  }
  function renderHero() {
    const pics = state.items.filter(it => M.firstImage(it)).slice(0,3);
    const main = $('heroPhoto');
    if (pics.length) main.innerHTML = `<img src="${M.esc(M.firstImage(pics[0]))}" alt="من أطباق المطعم">`;
    else main.innerHTML = `<div class="hero-placeholder"><span class="hero-star">✳</span><div class="hero-plate">${M.icon('food')}</div><span class="hero-ph-label">نكهة تليق بمناسبتك</span></div>`;
    const little=$('heroMiniPhoto');
    if (pics.length>1) little.innerHTML=`<img src="${M.esc(M.firstImage(pics[1]))}" alt="طبق آخر">`;
    else little.innerHTML = `<div class="mini-placeholder">${M.icon('sparkle')}<span>طعام · ضيافة · مناسبات</span></div>`;
  }
  function gallery() {
    const it=state.selected;if(!it)return;
    const photos=M.media(it,'image'),video=M.media(it,'video');
    const imgs=photos.map(x=>({kind:'image',url:M.imageUrl(x.url)}));
    const media=[...imgs,...video.map(x=>({kind:'video',url:M.imageUrl(x.url)}))];
    state.galleryIndex=Math.min(state.galleryIndex,Math.max(0,media.length-1));
    const active=media[state.galleryIndex];
    $('detailMedia').innerHTML=active ? (active.kind==='video' ? `<video src="${M.esc(active.url)}" controls playsinline preload="metadata" aria-label="فيديو ${M.esc(it.name)}"></video>` : `<img src="${M.esc(active.url)}" alt="${M.esc(it.name)}">`) : M.placeholder();
    $('detailThumbs').innerHTML=media.map((m,i)=>`<button type="button" data-gallery="${i}" class="thumb ${i===state.galleryIndex?'active':''}" aria-label="وسائط ${i+1}">${m.kind==='video' ? M.icon('play') : `<img src="${M.esc(m.url)}" alt="">`}</button>`).join('');
  }
  function openDetails(id) {
    state.selected=state.items.find(it=>Number(it.id)===Number(id));if(!state.selected)return;
    state.galleryIndex=0;
    $('detailName').textContent=state.selected.name;
    $('detailDescription').textContent=state.selected.description||'يمكنك إضافته للسلة والاستفسار عن تفاصيله عبر واتساب.';
    $('detailPrice').textContent=M.priceText(state.selected.price);
    $('detailQty').value='1';
    gallery();modalOpen('detailsModal');
  }
  function modalOpen(id) {$(id).hidden=false;document.body.classList.add('no-scroll');$(id).querySelector('[data-close]')?.focus();}
  function modalClose(id) {$(id).hidden=true;document.body.classList.remove('no-scroll');$('detailMedia')?.querySelector('video')?.pause();}
  function cartOpen(){cartPaint();modalOpen('cartDrawer');}
  function cartClick(e) {
    const plus=e.target.closest('[data-cart-plus]'),minus=e.target.closest('[data-cart-minus]'),remove=e.target.closest('[data-cart-remove]');
    if (plus) {const id=Number(plus.dataset.cartPlus);const it=M.cartGet().find(x=>x.id===id);if(it)M.setQty(id,it.quantity+1);}
    else if(minus){const id=Number(minus.dataset.cartMinus);const it=M.cartGet().find(x=>x.id===id);if(it)M.setQty(id,it.quantity-1);}
    else if(remove)M.setQty(Number(remove.dataset.cartRemove),0);
  }
  async function load() {
    const req=++state.requestId;
    $('productGrid').innerHTML=`<div class="menu-loading"><div class="spin"></div><h3>نجهّز لك القائمة...</h3></div>`;
    $('catalogError').hidden=true;
    try {
      const result=await M.products();if(req!==state.requestId)return;
      state.items=result.items;
      applySearch();renderHero();
      if ($('totalCatalog')) $('totalCatalog').textContent=M.countFmt.format(state.items.length);
      if(!state.items.length){$('catalogError').hidden=false;$('catalogError').innerHTML='لا توجد منتجات منشورة حاليًا. أضف منتجًا وانشره من لوحة الإدارة.';}
    }catch(err){
      $('productGrid').innerHTML='';$('catalogError').hidden=false;
      $('catalogError').innerHTML=`<strong>لم نتمكن من جلب المنتجات.</strong><p>${M.esc(err.message)}</p><button type="button" id="reloadCatalog">إعادة المحاولة</button>`;
      $('reloadCatalog')?.addEventListener('click',load);
      $('productCount').textContent='لم يتم تحميل القائمة';
    }
  }
  async function init() {
    if(M.DEMO){$('demoBar').hidden=false;$('guestHomeLink').href='menu.html?demo=1';}
    cartPaint();
    document.addEventListener('menu:cart-changed',cartPaint);
    window.addEventListener('storage',cartPaint);
    M.restaurant().then(r=>{state.restaurant=r;M.renderBrand(r);});
    await load();
    let debounce; $('menuSearch').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(applySearch,180);});
    document.addEventListener('click',e=>{
      const add=e.target.closest('[data-add]'),details=e.target.closest('[data-details]'),showCart=e.target.closest('[data-open-cart]');
      if(add){const item=state.items.find(x=>x.id===Number(add.dataset.add));if(item){M.add(item);M.toast('أُضيف المنتج إلى السلة');}} 
      else if(details)openDetails(details.dataset.details);
      else if(showCart)cartOpen();
      const close=e.target.closest('[data-close]');if(close){const modal=close.closest('.guest-overlay');if(modal)modalClose(modal.id);}
      const galleryButton=e.target.closest('[data-gallery]');if(galleryButton){state.galleryIndex=Number(galleryButton.dataset.gallery);gallery();}
    });
    $('drawerCartList').addEventListener('click',cartClick);
    $('detailQtyMinus').addEventListener('click',()=>{$('detailQty').value=Math.max(1,Number($('detailQty').value||1)-1);});
    $('detailQtyPlus').addEventListener('click',()=>{$('detailQty').value=Math.min(99,Number($('detailQty').value||1)+1);});
    $('detailAddToCart').addEventListener('click',()=>{if(state.selected){M.add(state.selected,Math.min(99,Math.max(1,Number($('detailQty').value)||1)));modalClose('detailsModal');M.toast('تمت الإضافة إلى السلة');}});
    $('cartCheckout').addEventListener('click',()=>{location.href='menu-checkout.html'+(M.DEMO?'?demo=1':'');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.guest-overlay:not([hidden])').forEach(x=>modalClose(x.id));});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
