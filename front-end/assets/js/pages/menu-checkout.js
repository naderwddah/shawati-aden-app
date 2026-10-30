(() => {
  'use strict';
  const M=window.GuestMenu;
  const $=id=>document.getElementById(id);
  const state={restaurant:null,validated:false,preparedMessage:'',whatsapp:''};
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  function paint() {
    const cart=M.cartGet(),sum=M.cartSummary(cart);
    $('checkoutCount').textContent=sum.quantity+' عناصر';
    $('summaryCount').textContent=M.countFmt.format(sum.quantity);
    $('summaryTotal').textContent=M.money(sum.total);
    $('quoteNotice').hidden=!sum.needsQuote;
    $('checkoutLines').innerHTML=cart.map(it=>`<article class="checkout-line" data-id="${it.id}">
      <div class="checkout-photo">${it.image?`<img src="${M.esc(it.image)}" alt="">`:M.icon('food')}</div>
      <div class="checkout-info"><strong>${M.esc(it.name)}</strong><span>${M.priceText(it.price)}</span>
        <div class="quantity-control"><button type="button" data-minus="${it.id}" aria-label="تقليل">−</button><output>${it.quantity}</output><button type="button" data-plus="${it.id}" aria-label="زيادة">+</button></div></div>
      <div class="checkout-end"><b>${it.price>0?M.money(it.quantity*it.price):'بالاتفاق'}</b><button type="button" data-remove="${it.id}" aria-label="إزالة">${M.icon('close')}</button></div>
    </article>`).join('');
    $('emptyCheckout').hidden=cart.length>0;
    $('checkoutBody').hidden=!cart.length;
    $('sendPreview').disabled=!cart.length;
    $('noteCart').textContent=`${M.countFmt.format(sum.quantity)} عناصر تم اختيارها. يتم الاتفاق على التكلفة النهائية مع المطعم.`;
  }
  function updateDelivery(){const delivery=$('fulfillment').value==='delivery';$('addressGroup').hidden=!delivery;$('customerAddress').required=delivery;}
  function getFields() {
    const name=$('customerName').value.trim(), phone=$('customerPhone').value.trim();
    const digits=phone.replace(/\D/g,'');
    if(name.length<2)throw new Error('اكتب اسمًا صحيحًا للعميل.');
    if(digits.length<8||digits.length>15)throw new Error('أدخل رقم جوال صالحًا للتواصل.');
    if($('fulfillment').value==='delivery'&&!$('customerAddress').value.trim())throw new Error('اكتب عنوان التوصيل.');
    const eventDate=$('eventDate').value, eventTime=$('eventTime').value;
    if(eventDate&&eventDate<today())throw new Error('تاريخ المناسبة لا يمكن أن يكون في الماضي.');
    return {name,phone,orderKind:$('orderKind').value,fulfillment:$('fulfillment').value,
      address:$('customerAddress').value.trim(), eventDate,eventTime, guests:$('guestCount').value.trim(), notes:$('customerNotes').value.trim()};
  }
  function message(fields,cart) {
    const sum=M.cartSummary(cart);
    const lines=cart.map((it,i)=>`${i+1}. ${it.name}\n   الكمية: ${it.quantity}\n   السعر: ${it.price>0?M.money(it.price)+' × '+it.quantity+' = '+M.money(it.price*it.quantity):'يُحدّد بالاتفاق'}`);
    return [
      'السلام عليكم ورحمة الله وبركاته 🌿',
      'أرغب بالاستفسار عن طلب من قائمة مطابخ شواطئ عدن:',
      '', '🛒 *الأطباق والخدمات المطلوبة:*',...lines,'',
      `*الإجمالي المبدئي للمنتجات محددة السعر:* ${M.money(sum.total)}`,
      ...(sum.needsQuote?['*تنبيه:* بعض الخدمات أسعارها حسب الاتفاق.']:[]),
      '', '👤 *بيانات العميل:*',
      `الاسم: ${fields.name}`,`الجوال: ${fields.phone}`,`نوع الطلب: ${fields.orderKind}`,
      `الاستلام: ${fields.fulfillment==='delivery'?'توصيل':'استلام من المطعم'}`,
      ...(fields.fulfillment==='delivery'?[`العنوان: ${fields.address}`]:[]),
      ...(fields.eventDate?[`تاريخ المناسبة: ${fields.eventDate}`]:[]),
      ...(fields.eventTime?[`الوقت: ${fields.eventTime}`]:[]),
      ...(fields.guests?[`عدد الضيوف: ${fields.guests}`]:[]),
      ...(fields.notes?[`ملاحظات: ${fields.notes}`]:[]),
      '', 'يرجى تأكيد التوفر والتكلفة النهائية والتفاصيل. شكرًا لكم.',
      '— هذا طلب استفسار وليس حجزًا مؤكدًا —'
    ].join('\n');
  }
  function previewOpen(text){$('messagePreview').textContent=text;$('previewOverlay').hidden=false;document.body.classList.add('no-scroll');$('sendWhatsapp').focus();}
  function previewClose(){$('previewOverlay').hidden=true;document.body.classList.remove('no-scroll');}
  async function review(e) {
    e.preventDefault();const btn=$('sendPreview');if(btn.disabled)return;
    try {
      const fields=getFields();const cart=M.cartGet();if(!cart.length)throw new Error('أضف منتجًا واحدًا على الأقل.');
      btn.disabled=true;btn.textContent='جاري التحقق من المنتجات...';
      if(!M.DEMO){
        // Only current published products / server prices are trusted when making a draft order.
        const listing=await M.products();const byId=new Map(listing.items.map(it=>[Number(it.id),it]));
        const missing=cart.filter(it=>!byId.has(it.id));
        if(missing.length)throw new Error('بعض المنتجات لم تعد منشورة. راجع السلة واحذف المنتجات غير المتاحة ثم أعد المحاولة.');
        const changed=cart.map(it=>{const current=byId.get(it.id);return {...it,name:current.name,price:M.val(current.price),image:M.firstImage(current)};});
        const priceChanges=cart.some((it,i)=>it.price!==changed[i].price||it.name!==changed[i].name);
        if(priceChanges){M.cartSet(changed);paint();throw new Error('تم تحديث أسماء أو أسعار بعض المنتجات وفق البيانات الحالية. راجع الإجمالي ثم اضغط معاينة الرسالة مجددًا.');}
      }
      state.whatsapp=M.whatsappDigits(state.restaurant);
      if(!M.DEMO&&!state.whatsapp)throw new Error('رقم واتساب المطعم غير متاح أو غير صحيح. أضفه من إعدادات المطعم وتأكد من فتح مسار معلومات المطعم العام.');
      state.preparedMessage=message(fields,cart);
      $('sendWhatsapp').hidden=M.DEMO;
      $('demoMessage').hidden=!M.DEMO;
      previewOpen(state.preparedMessage);
    }catch(err){M.toast(err.message||'تعذر تجهيز الطلب',true);}
    finally{btn.disabled=!M.cartGet().length;btn.innerHTML='مراجعة الرسالة '+M.icon('arrow');}
  }
  function send() {
    if(M.DEMO||!state.whatsapp||!state.preparedMessage)return;
    const link=`https://wa.me/${state.whatsapp}?text=${encodeURIComponent(state.preparedMessage)}`;
    // Synchronous navigation from an explicit click: avoids popup blockers.
    // Same-tab navigation avoids popup blockers and accidental duplicate WhatsApp tabs.
    window.location.assign(link);
    previewClose();
    // Deliberately do not clear cart: WhatsApp opening is not proof that an order was sent.
    M.toast('تم فتح واتساب. أرسل الرسالة من المحادثة لإكمال الاستفسار.');
  }
  function bind() {
    $('checkoutLines').addEventListener('click',e=>{
      const plus=e.target.closest('[data-plus]'),minus=e.target.closest('[data-minus]'),remove=e.target.closest('[data-remove]');
      if(plus){const id=Number(plus.dataset.plus),it=M.cartGet().find(x=>x.id===id);if(it)M.setQty(id,it.quantity+1);}
      if(minus){const id=Number(minus.dataset.minus),it=M.cartGet().find(x=>x.id===id);if(it)M.setQty(id,it.quantity-1);}
      if(remove)M.setQty(Number(remove.dataset.remove),0);
    });
    $('fulfillment').addEventListener('change',updateDelivery);
    $('customerForm').addEventListener('submit',review);
    $('sendWhatsapp').addEventListener('click',send);
    $('copyMessage').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.preparedMessage);M.toast('تم نسخ نص الرسالة');}catch{M.toast('تعذر النسخ التلقائي؛ حدد النص لنسخه يدويًا',true);}});
    document.addEventListener('click',e=>{if(e.target.closest('[data-close-preview]'))previewClose();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('previewOverlay').hidden)previewClose();});
    document.addEventListener('menu:cart-changed',paint);
    window.addEventListener('storage',paint);
  }
  async function init() {
    if(M.DEMO)$('demoBar').hidden=false;
    $('backMenu').href='menu.html'+(M.DEMO?'?demo=1':'');
    $('continueBrowsing').href='menu.html'+(M.DEMO?'?demo=1':'');
    $('emptyBack').href='menu.html'+(M.DEMO?'?demo=1':'');
    $('eventDate').min=today();
    paint();updateDelivery();bind();
    state.restaurant=await M.restaurant();M.renderBrand(state.restaurant);
    if(state.restaurant?._loadError)M.toast('يلزم تشغيل مسار معلومات المطعم العام لاستقبال الطلبات.',true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
