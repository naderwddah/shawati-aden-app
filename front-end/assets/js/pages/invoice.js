/* فاتورة الوليمة A5 — الإصدار V6. تحفظ الهوية البصرية للفاتورة المعتمدة. */
(() => {
  'use strict';

  const STORAGE_KEY = 'preview_invoice_data';
  const MAX_AGE_MS = 30 * 60 * 1000;
  const MAX_ITEMS_PER_PAGE = 5;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const moneyNumber = (value) => { const result = Number(value); return Number.isFinite(result) ? result : 0; };
  const cents = (value) => Math.round(moneyNumber(value) * 100);
  const money = (value) => (moneyNumber(value)).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
  const safeImageUrl = (value, fallback) => {
    const source = String(value || '').trim();
    if (!source) return fallback;
    if (/^(https:\/\/|http:\/\/|\/|assets\/images\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(source)) return source;
    return fallback;
  };
  const statusLabels = {new:'جديد',confirmed:'مؤكد',completed:'مكتمل',cancelled:'ملغي'};

  function errorPage(message) {
    const wrapper = $('#pagesWrapper');
    if (wrapper) wrapper.innerHTML = `<div class="invoice-error" role="alert"><i class="fas fa-triangle-exclamation"></i><h2>تعذر إصدار الفاتورة</h2><p>${escapeHtml(message)}</p><a href="bookings.html">العودة للحجوزات</a></div>`;
    $('.actions .btn-print')?.setAttribute('disabled', 'disabled');
    $('.actions .btn-whatsapp')?.setAttribute('disabled', 'disabled');
    console.error('Invoice validation:', message);
  }

  function loadData() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
      // تنظيف أي لقطة قديمة محفوظة في localStorage من الإصدارات السابقة.
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    if (!raw) throw new Error('لا توجد بيانات حديثة للفاتورة. افتح الحجز مجددًا واختر «الفاتورة».');
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new Error('بيانات الفاتورة تالفة. أعد فتحها من الحجز.'); }
    if (!parsed || !Number.isSafeInteger(Number(parsed.id)) || Number(parsed.id) <= 0) {
      throw new Error('رقم الحجز غير صحيح. لا يمكن إصدار فاتورة بدون رقم أصلي.');
    }
    if (!parsed.generatedAt || !Number.isFinite(Date.parse(parsed.generatedAt)) ||
        Math.abs(Date.now() - Date.parse(parsed.generatedAt)) > MAX_AGE_MS) {
      throw new Error('انتهت صلاحية معاينة الفاتورة. افتحها مجددًا للحصول على أحدث بيانات الحجز.');
    }
    if (!Array.isArray(parsed.items) || !parsed.items.length) {
      throw new Error('لم يتم تحميل أصناف الحجز. أعد فتح الفاتورة من صفحة الحجوزات.');
    }
    return parsed;
  }

  let data;
  let finances;
  let pages;
  let invoiceReady = false;
  try {
    data = loadData();
    finances = financials(data);
    pages = paginate(data);
  } catch (error) {
    document.addEventListener('DOMContentLoaded', () => errorPage(error.message), {once:true});
    if (document.readyState !== 'loading') errorPage(error.message);
    return;
  }

  function financials(record) {
    const plateDeposit = Math.max(0, cents(record.platesDeposit));
    const returned = Math.max(0, cents(record.platesDepositReturned));
    if (returned > plateDeposit) throw new Error('قيمة التأمين المُعاد تتجاوز تأمين الصحون. تحقق من الحجز.');

    let itemsSubtotal = 0;
    const normalizedItems = record.items.map((item, index) => {
      const qty = Number(item.qty ?? item.quantity);
      const unit = cents(item.price ?? item.unit_price);
      if (!Number.isInteger(qty) || qty <= 0 || unit < 0) {
        throw new Error(`بيانات الكمية أو السعر غير صحيحة في الصنف ${index + 1}.`);
      }
      const lineTotal = qty * unit;
      if (item.total != null && Math.abs(cents(item.total) - lineTotal) > 1) {
        throw new Error(`إجمالي الصنف ${index + 1} لا يطابق الكمية والسعر.`);
      }
      itemsSubtotal += lineTotal;
      return {name:String(item.name ?? item.item_name ?? 'صنف'), qty, unit, total:lineTotal};
    });
    const payable = itemsSubtotal + plateDeposit;
    // الحقل total في مخرجات صفحات الحجز مُعرّف بأنه إجمالي مطلوب شاملًا التأمين.
    if (record.total == null || Math.abs(cents(record.total) - payable) > 1) {
      throw new Error('إجمالي الفاتورة لا يطابق الأصناف وتأمين الصحون. أعد فتح الفاتورة من الحجز وتحقق من بياناته.');
    }
    const paid = Math.max(0, cents(record.paidTotal ?? record.deposit));
    const remaining = Math.max(0, payable - paid);
    if (paid > payable + 1) {
      throw new Error('المبالغ المحصّلة تتجاوز إجمالي الفاتورة. يرجى مراجعة دفعات الحجز.');
    }
    return {itemsSubtotal, plateDeposit, returned, depositDue:plateDeposit-returned,
      payable, paid, remaining, normalizedItems};
  }

  // تحويل فواصل الأسطر في الملاحظات إلى فواصل عربية داخل فقرة متصلة.
  function normalizeInvoiceNotes(value) {
    return String(value ?? '')
      .replace(/[\t ]*(?:\r\n|\r|\n|\u2028|\u2029)(?:[\t ]*(?:\r\n|\r|\n|\u2028|\u2029))*[\t ]*/g, '، ')
      .replace(/\s+/g, ' ')
      .replace(/(?:،\s*){2,}/g, '، ')
      .trim();
  }

  function paginate(record) {
    const complete = finances.normalizedItems.map((it) => ({...it, deposit:false}));
    if (finances.plateDeposit) {
      complete.unshift({name:'تأمين الصحون (مسترد)',qty:1,unit:finances.plateDeposit,total:finances.plateDeposit,deposit:true});
    }
    const itemPages = [];
    for (let i=0; i<complete.length; i+=MAX_ITEMS_PER_PAGE) {
      itemPages.push({kind:'items',items:complete.slice(i,i+MAX_ITEMS_PER_PAGE),start:i,notes:''});
    }
    if (!itemPages.length) itemPages.push({kind:'items',items:[],start:0,notes:''});

    // ثابت داخل آخر صفحة أصناف، دون إنشاء صفحات إضافية بسبب طول الملاحظات.
    itemPages[itemPages.length - 1].notes = normalizeInvoiceNotes(record.notes);
    return itemPages;
  }

  const formatDDMMYYYY = (raw) => {
    const str=String(raw || '').trim();
    const match=str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : str;
  };

  function invoiceNumber() {return String(data.id).padStart(6,'0');}
  function invoicePage(page, index, pageCount) {
    const isLast = index===pageCount-1;
    const r = data.restaurant || {};
    const phone = r.phone || '0550724459';
    const secondPhone = r.secondaryPhone || '0566869958';
    const whatsapp = r.whatsapp || r.delivery || phone;
    const address = r.address || 'جدة - شارع جاك - جوار كودو';
    const status = statusLabels[String(data.status || '').toLowerCase()];
    const invoiceDate = formatDDMMYYYY(data.invoiceDate);
    let subtotal=0;
    let rows='';
    for (let i=0;i<MAX_ITEMS_PER_PAGE;i++) {
      const item = page.items[i];
      const count = page.start+i+1;
      if (item) {
        subtotal += item.total;
        rows+=`<tr><td class="line-no">${count}</td><td class="line-name ${item.deposit?'deposit-item':''}">${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${money(item.unit/100)}</td><td class="line-total">${money(item.total/100)}</td></tr>`;
      } else {
        rows+=`<tr><td class="line-no">${count}</td><td>&nbsp;</td><td></td><td></td><td></td></tr>`;
      }
    }
    const title = 'فاتورة وليمة';
    const noteMarkup = `<div class="invoice-notes"><span>ملاحظة :</span><div class="note-viewport"><p class="note-content">${escapeHtml(page.notes || '')}</p></div></div>`;
    const summaryMarkup = isLast ? `
      <div class="invoice-totals" data-summary="final">
        <strong>الإجمالي النهائي :</strong><b>${money(finances.payable/100)}</b>
        <div class="paid-summary">المحصّل: <em>${money(finances.paid/100)}</em><br>المتبقي: <em class="pending">${money(finances.remaining/100)}</em></div>
      </div>
      ${finances.plateDeposit?`<div class="deposit-summary">تأمين الصحون: ${money(finances.plateDeposit/100)} · المُعاد: ${money(finances.returned/100)} · لم يُسترد: ${money(finances.depositDue/100)}</div>`:''}` : `<div class="invoice-totals page-subtotal"><strong>مجموع هذه الصفحة :</strong><b>${money(subtotal/100)}</b></div>`;
    const customer = data.customer || {};
    const booking = data.booking || {};
    const method = data.paymentMethod || (finances.paid ? 'غير محددة' : 'لم يتم الدفع');
    const logo = safeImageUrl(r.logo,'assets/images/logo.png');
    return `<section class="invoice-page" data-invoice-page="${index+1}" data-page-count="${pageCount}">
      <div class="watermark"><img src="assets/images/watermark.png" alt="" aria-hidden="true"></div>
      <div class="invoice-inner">
        <header class="header">
          <div class="header-right"><div class="title">${escapeHtml(r.name || 'مطابخ شواطئ عدن')}</div>
            <div class="subtitle">${escapeHtml(r.subtitle || 'للحجوزات والولائم والمناسبات')}</div>
            <div class="phone"><i class="fas fa-phone" aria-hidden="true"></i><span>${escapeHtml(phone)}</span></div>
          </div>
          <div class="logo-center"><img src="${escapeHtml(logo)}" class="main-logo" alt="شعار المطعم"></div>
          <div class="social-box"><div class="social-icons">
            <span class="social-icon"><i class="fab fa-snapchat-ghost"></i></span>
            <span class="social-icon"><i class="fab fa-instagram"></i></span>
            <span class="social-icon"><i class="fab fa-tiktok"></i></span>
            <span class="social-icon"><i class="fab fa-x-twitter"></i></span>
          </div><div class="social-text">مطابخ شواطئ عدن</div><div class="social-text en">SHAWATI ADEN KITCHENS</div></div>
        </header>
        <div class="invoice-bar"><div class="invoice-no">No./ <span>${invoiceNumber()}</span></div>
          <div class="invoice-badge-container"><span class="invoice-badge">${title} ${pageCount>1?`(${index+1}/${pageCount})`:''}</span></div>
          <div class="invoice-state">${status?escapeHtml(status):''}</div>
        </div>
        <section class="customer-box" aria-label="بيانات العميل">
          <div class="customer-row"><div class="customer-field"><span class="customer-label">اسم العميل :</span><span class="customer-value wide">${escapeHtml(customer.name || '')}</span></div>
            <div class="customer-field"><span class="customer-label">الجوال :</span><span class="customer-value">${escapeHtml(customer.phone || '')}</span></div></div>
          <div class="customer-row"><div class="customer-field"><span class="customer-label">اليوم :</span><span class="customer-value">${escapeHtml(booking.day || '')}</span></div>
            <div class="customer-field"><span class="customer-label">الساعة :</span><span class="customer-value">${escapeHtml(booking.time || '')} ${escapeHtml(booking.deliveryTime || '')}</span></div>
            <div class="customer-field"><span class="customer-label">التاريخ :</span><span class="customer-value">${escapeHtml(booking.date || '')}</span></div></div>
          <div class="customer-row"><div class="customer-field"><span class="customer-label">موقع التوصيل :</span><span class="customer-value wide">${escapeHtml(customer.location || '')}</span></div>
            <div class="customer-field"><span class="customer-label">العلامة :</span><span class="customer-value">${escapeHtml(booking.mark || '')}</span></div></div>
        </section>
        ${invoiceDate?`<div class="issue-date">تاريخ إصدار الفاتورة: ${escapeHtml(invoiceDate)}</div>`:''}
        <div class="table-container"><table class="items-table"><thead><tr><th style="width:6%"></th><th style="width:44%">الصنف</th><th style="width:15%">العدد</th><th style="width:15%">السعر</th><th style="width:20%">الإجمالي</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${noteMarkup}
        ${summaryMarkup}
        <div class="footer-wave"><svg viewBox="0 0 800 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,67 C55,54 105,52 160,57 C225,63 285,82 350,87 C420,92 475,82 530,68 C585,54 635,51 690,57 C735,61 770,69 800,76" fill="none" stroke="#420A09" stroke-width="9"/><path d="M0,75 C55,62 105,60 160,65 C225,71 285,90 350,95 C420,100 475,90 530,76 C585,62 635,59 690,65 C735,69 770,77 800,84" fill="none" stroke="#8B6914" stroke-width="2.5"/></svg></div>
        <div class="warning-note">ملاحظة : أي تعديل في محتوى الفاتورة يكون قبل الموعد بساعة</div>
        <footer class="footer-content">
          <div class="qr-box"><img src="assets/images/location-qr.png" class="qr-image" alt="رمز الاستجابة لموقع المطعم"><span class="qr-label">الموقع</span></div>
          <div class="footer-center"><div class="footer-contact"><div class="address-location"><i class="fas fa-location-dot"></i><span>${escapeHtml(address)}</span></div>
             <div class="phones"><span><i class="fab fa-whatsapp"></i> ${escapeHtml(whatsapp)}</span><span><i class="fas fa-phone"></i> ${escapeHtml(secondPhone)}</span></div></div>
             <div class="payment-box"><span>طريقة الدفع :</span><span class="payment-line">${escapeHtml(method)}</span></div>
          </div>
          <div class="qr-box"><img src="assets/images/whatsapp-qr.png" class="qr-image" alt="رمز الاستجابة لقناة واتساب"><span class="qr-label">قناة واتساب</span></div>
        </footer>
      </div>
    </section>`;
  }

  // ملاءمة كامل النص داخل صندوق الملاحظات الثابت (18mm) دون نقل أي جزء إلى ورقة أخرى.
  // ننقص حجم الخط عند الحاجة؛ للنصوص الاستثنائية الضخمة نضغط الارتفاع فقط
  // كي لا يُفقد أي سطر بالصمت أو يخرج النص من حدود A5.
  function fitInvoiceNotes() {
    document.querySelectorAll('.invoice-notes .note-viewport').forEach((viewport) => {
      const content = viewport.querySelector('.note-content');
      if (!content || !content.textContent.trim()) return;
      const available = viewport.clientHeight;
      if (!available) return;

      content.style.transform = '';
      let size = 11;
      content.style.fontSize = `${size}px`;
      while (content.scrollHeight > available + 1 && size > 5) {
        size = Math.max(5, size - 0.5);
        content.style.fontSize = `${size}px`;
      }
      if (content.scrollHeight > available + 1) {
        const ratio = available / content.scrollHeight;
        content.style.transformOrigin = 'top right';
        content.style.transform = `scaleY(${ratio})`;
      }
    });
  }

  function renderInvoice() {
    const wrapper = $('#pagesWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = pages.map((page,index)=>invoicePage(page,index,pages.length)).join('');
    fitInvoiceNotes();
    if (document.fonts?.ready) document.fonts.ready.then(fitInvoiceNotes).catch(() => {});
    invoiceReady=true;
  }
  window.addEventListener('beforeprint', fitInvoiceNotes);

  function waitForImages(container) {
    return Promise.all(Array.from(container.querySelectorAll('img')).map(img => {
      if (img.complete) return Promise.resolve(img.naturalWidth > 0);
      return new Promise(resolve => { img.onload=()=>resolve(true); img.onerror=()=>resolve(false); });
    }));
  }

  window.shareInvoiceWhatsApp = async () => {
    if (!invoiceReady) return;
    const wrapper = $('#pagesWrapper');
    const button = $('.btn-whatsapp');
    if (!wrapper || !button) return;
    const previous=button.innerHTML;
    const actionBar=$('.actions');
    try {
      button.disabled=true;
      button.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري تجهيز PDF...';
      if (!window.jspdf?.jsPDF || typeof window.html2canvas !== 'function') throw new Error('مكتبات PDF غير متاحة. استخدم زر طباعة / PDF.');
      if (document.fonts?.ready) await document.fonts.ready;
      fitInvoiceNotes();
      const imagesReady=await waitForImages(wrapper);
      if (imagesReady.some(v=>!v)) throw new Error('تعذر تحميل الشعار أو رمز QR. تأكد من وجود الصور ثم أعد المحاولة.');
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({unit:'mm',format:'a5',orientation:'portrait'});
      const pageEls=wrapper.querySelectorAll('.invoice-page');
      for (let i=0;i<pageEls.length;i++) {
        if (i) pdf.addPage();
        const canvas=await window.html2canvas(pageEls[i],{scale:2,useCORS:true,logging:false,backgroundColor:'#fafbf6',windowWidth:1000});
        pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,148,210);
      }
      const name = String(data.customer?.name || 'عميل').replace(/[\\/:*?"<>|]/g,'').slice(0,60);
      const filename=`فاتورة_${invoiceNumber()}_${name}.pdf`;
      const pdfBlob=pdf.output('blob');
      const file=new File([pdfBlob],filename,{type:'application/pdf'});
      if (navigator.canShare && navigator.canShare({files:[file]}) && typeof navigator.share==='function') {
        try {await navigator.share({title:`فاتورة وليمة #${invoiceNumber()}`,files:[file],text:'فاتورة وليمة - مطابخ شواطئ عدن'});}
        catch(error) {if (error?.name!=='AbortError') throw error;}
      } else {
        const url=URL.createObjectURL(pdfBlob);
        const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),10000);
        alert('تم تنزيل الفاتورة PDF؛ يمكنك إرسالها عبر واتساب.');
      }
    } catch(error) { console.error('Invoice PDF:',error); alert(error.message || 'تعذر تجهيز الفاتورة.'); }
    finally {button.disabled=false;button.innerHTML=previous;if(actionBar) actionBar.style.display='';}
  };

  window.invoiceBack = () => {
    // العودة من صفحة العميل أو الحجوزات مع تجنب توجيه المستخدم إلى موقع خارجي.
    const previous=String(sessionStorage.getItem('invoice_return_to') || '');
    if (/^customer-view\.html\?id=\d+$/.test(previous) || previous==='bookings.html') location.href=previous;
    else location.href='bookings.html';
  };
  window.__invoiceDebug = () => ({id:data.id,pages:pages.length,itemsTotal:finances.itemsSubtotal/100,
    payable:finances.payable/100,paid:finances.paid/100,remaining:finances.remaining/100,
    platesDepositReturned:finances.returned/100});

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',renderInvoice,{once:true});
  else renderInvoice();
})();
