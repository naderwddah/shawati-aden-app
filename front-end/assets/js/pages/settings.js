'use strict';

// Settings V13: restaurant profile, logo, local preferences and account security.
// Keep the public API and field IDs stable; UI state is isolated to this page.
function initializeRestaurantSettings() {
  const $ = id => document.getElementById(id);
  const state = { restaurant: null, busy: false, logoBusy: false, passwordBusy: false, loggingOut: false, lastFocus: null, confirmResolve: null };
  const STORAGE = { notifications:'banquet_booking_notifications', sounds:'banquet_sound_effects' };
  const MODALS = ['editProfileModal','changePasswordModal','settingsConfirmModal'];

  function message(text, type='info') {
    if (window.Layout?.showToast) return window.Layout.showToast(text, type);
    if (window.Utils?.notify) return window.Utils.notify(text, type);
    if (type==='error') console.error(text); else console.info(text);
  }
  function errorText(error) {
    if (window.Utils?.getErrorText) return Utils.getErrorText(error);
    return error?.message || 'تعذر إكمال العملية. حاول مجددًا.';
  }
  function showError(messageText) {
    $('settingsErrorText').textContent = messageText;
    $('settingsError').classList.add('show');
  }
  function hideError() { $('settingsError').classList.remove('show'); }
  function text(id, value) {
    const node = $(id);
    if (!node) return;
    const v = value == null ? '' : String(value).trim();
    node.textContent = v || '—';
    node.classList.toggle('empty', !v);
  }
  function unbox(result) { return result?.data ?? result; }
  function baseUrl() {
    const b = window.API?.BASE_URL;
    if (!b) return new URL('.', location.href).href;
    try { return new URL(b.replace(/\/api\/?$/, '') + '/').href; }
    catch { return new URL('.', location.href).href; }
  }
  function logoUrl(source) {
    const value = String(source || '').trim();
    if (!value) return '';
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\/\//.test(value) || /^[a-z]+:/i.test(value)) return '';
    const path = value.startsWith('/') ? value : (/^(storage|uploads)\//.test(value) ? '/' + value : '/storage/' + value);
    try { return new URL(path,baseUrl()).href; } catch { return ''; }
  }
  function displayLogo(source) {
    const image = $('logoImage'), placeholder = $('logoPlaceholder'), remove = $('removeLogoBtn');
    const url = logoUrl(source);
    if (remove) remove.hidden = !url;
    if (!url) {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      image.style.display = 'none'; placeholder.style.display = 'flex';
      return;
    }
    image.onload = () => { image.style.display = 'block'; placeholder.style.display = 'none'; };
    image.onerror = () => { image.style.display = 'none'; placeholder.style.display = 'flex'; };
    image.src = url;
  }
  function renderRestaurant(data) {
    if (!data || typeof data !== 'object') throw new Error('بيانات المطعم غير متاحة');
    state.restaurant = {...data};
    text('businessName', data.name);
    text('businessDescription', data.description);
    text('businessPhone', data.phone);
    text('businessWhatsapp', data.whatsapp);
    text('businessFacebook', data.facebook);
    text('businessInstagram', data.instagram);
    text('businessAddress', data.address);
    displayLogo(data.logo);
  }
  async function loadRestaurant() {
    hideError();
    $('editProfileBtn').disabled = true;
    $('changeLogoBtn').disabled = true;
    try {
      if (!window.API?.getRestaurant) throw new Error('واجهة API غير متاحة');
      const data = unbox(await API.getRestaurant());
      renderRestaurant(data);
    } catch (e) {
      console.error('Restaurant settings load:',e);
      showError('تعذر تحميل بيانات المطعم: ' + errorText(e));
    } finally {
      $('editProfileBtn').disabled = !state.restaurant;
      $('changeLogoBtn').disabled = !state.restaurant;
    }
  }
  function formValue(id, value) { $(id).value = value ?? ''; }
  function openDialog(id) {
    const modal = $(id); if (!modal) return;
    state.lastFocus = document.activeElement;
    modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    const focusTarget = modal.querySelector('input:not([type="hidden"]),button:not([data-close]),button');
    focusTarget?.focus();
  }
  function closeDialog(id) {
    const modal=$(id); if (!modal) return;
    modal.classList.remove('active'); modal.setAttribute('aria-hidden','true');
    if (!MODALS.some(key => $(key)?.classList.contains('active'))) document.body.style.overflow='';
    state.lastFocus?.focus?.(); state.lastFocus = null;
  }
  function openEdit() {
    if (!state.restaurant || state.busy) return;
    const r = state.restaurant;
    formValue('editBusinessNameInput',r.name);
    formValue('editBusinessDescriptionInput',r.description);
    formValue('editBusinessPhoneInput',r.phone);
    formValue('editBusinessWhatsappInput',r.whatsapp);
    formValue('editBusinessFacebookInput',r.facebook);
    formValue('editBusinessInstagramInput',r.instagram);
    formValue('editBusinessAddressInput',r.address);
    openDialog('editProfileModal');
    $('editBusinessNameInput').focus();
  }
  function setBusy(button, flag, label) {
    button.disabled=flag;
    if (flag) { button.dataset.originalHtml=button.innerHTML; button.innerHTML=`<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${label}`; }
    else if (button.dataset.originalHtml) {button.innerHTML=button.dataset.originalHtml; delete button.dataset.originalHtml;}
  }
  function validateSocialUrl(id) {
    const s = $(id).value.trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      throw new Error(`يرجى إدخال رابط يبدأ بـ https:// أو http:// في ${id==='editBusinessFacebookInput'?'فيسبوك':'إنستغرام'}`);
    }
    try { const url = new URL(s); if (!['http:','https:'].includes(url.protocol)) throw Error(); }
    catch { throw new Error('رابط التواصل الاجتماعي غير صحيح'); }
    return s;
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (state.busy) return;
    const form=$('editProfileForm');
    if (!form.reportValidity()) return;
    let payload;
    try {
      payload = {
        name: $('editBusinessNameInput').value.trim(),
        description: $('editBusinessDescriptionInput').value.trim() || null,
        phone: $('editBusinessPhoneInput').value.trim() || null,
        whatsapp: $('editBusinessWhatsappInput').value.trim() || null,
        facebook: validateSocialUrl('editBusinessFacebookInput'),
        instagram: validateSocialUrl('editBusinessInstagramInput'),
        address: $('editBusinessAddressInput').value.trim() || null
      };
      if (!payload.name) throw new Error('اسم المطعم مطلوب');
    } catch (e) { message(e.message,'warning'); return; }
    state.busy=true;
    setBusy($('saveProfileBtn'),true,'جاري الحفظ...');
    try {
      const updated = unbox(await API.updateRestaurant(payload));
      renderRestaurant(updated || {...state.restaurant,...payload});
      closeDialog('editProfileModal');
      message('تم تحديث بيانات المطعم بنجاح','success');
    } catch(e) { console.error('Restaurant update:',e);message(errorText(e),'error'); }
    finally {state.busy=false;setBusy($('saveProfileBtn'),false);}
  }
  async function uploadLogo(file) {
    if (!file || state.logoBusy) return;
    const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
    if (!allowed.has(file.type)) { message('صيغة الشعار المدعومة: PNG أو JPG أو WebP أو GIF','warning');$('logoInput').value=''; return; }
    if (file.size > 5*1024*1024) { message('حجم الشعار يجب ألا يتجاوز 5 ميجابايت','warning');$('logoInput').value=''; return; }
    state.logoBusy=true;
    setBusy($('changeLogoBtn'),true,'جاري الرفع...');
    try {
      const updated=unbox(await API.uploadRestaurantLogo(file));
      renderRestaurant(updated || state.restaurant);
      message('تم تحديث شعار المطعم بنجاح','success');
    } catch(e) {console.error('Logo upload:',e);message(errorText(e),'error');}
    finally {state.logoBusy=false;setBusy($('changeLogoBtn'),false);$('logoInput').value='';}
  }
  function askConfirmation(title, question, okLabel='تأكيد', danger=false) {
    if (state.confirmResolve) return Promise.resolve(false);
    $('settingsConfirmTitle').textContent=title;
    $('settingsConfirmMessage').textContent=question;
    $('settingsConfirmOk').textContent=okLabel;
    $('settingsConfirmOk').className=danger?'btn btn-danger':'btn btn-primary';
    openDialog('settingsConfirmModal');
    return new Promise(resolve => {state.confirmResolve=resolve;});
  }
  function settleConfirm(approved) {
    const resolve=state.confirmResolve;
    if (!resolve) return;
    state.confirmResolve=null;
    closeDialog('settingsConfirmModal');
    resolve(approved);
  }
  async function removeLogo() {
    if (!state.restaurant?.logo || state.logoBusy) return;
    const yes=await askConfirmation('حذف الشعار','هل تريد حذف شعار المطعم الحالي؟ سيظهر الرمز الافتراضي بدل الشعار.','حذف الشعار',true);
    if (!yes) return;
    state.logoBusy=true;
    const btn=$('removeLogoBtn');setBusy(btn,true,'جاري الحذف...');
    try {
      if (typeof API.deleteRestaurantLogo === 'function') await API.deleteRestaurantLogo();
      else await API.request('/restaurant/logo',{method:'DELETE'});
      renderRestaurant({...state.restaurant,logo:null});
      message('تم حذف شعار المطعم','success');
    } catch(e) {console.error('Logo delete:',e);message(errorText(e),'error');}
    finally {state.logoBusy=false;setBusy(btn,false);}
  }
  function readPreference(key,defaultValue) {
    try { const v=localStorage.getItem(key); return v===null?defaultValue:v==='true'; }
    catch {return defaultValue;}
  }
  function persist(key,value) {
    try { localStorage.setItem(key,String(Boolean(value))); }
    catch {message('تعذر حفظ التفضيل على هذا الجهاز','warning');}
  }
  function initPreferences() {
    $('bookingNotificationsToggle').checked=readPreference(STORAGE.notifications,true);
    $('soundEffectsToggle').checked=readPreference(STORAGE.sounds,false);
    const storedTheme = (() => {try {return localStorage.getItem('theme');}catch{return null;}})();
    $('themeToggle').checked=storedTheme==='dark' || (storedTheme===null && document.documentElement.classList.contains('dark-mode'));
    $('bookingNotificationsToggle').addEventListener('change',e=>{persist(STORAGE.notifications,e.target.checked);message('تم حفظ تفضيل التنبيهات محليًا؛ الإشعارات الفعلية تتطلب ربط الخدمة','info');});
    $('soundEffectsToggle').addEventListener('change',e=>{persist(STORAGE.sounds,e.target.checked);message('تم حفظ تفضيل الصوت محليًا؛ يتطلب التفعيل ربط المؤثرات','info');});
    $('themeToggle').addEventListener('change',e=>{
      if (window.Layout?.applyTheme) Layout.applyTheme(e.target.checked?'dark':'light');
      else {document.documentElement.classList.toggle('dark-mode',e.target.checked);try{localStorage.setItem('theme',e.target.checked?'dark':'light');}catch{}}
    });
    document.addEventListener('theme:changed',e=>{$('themeToggle').checked=e.detail?.theme==='dark';});
  }
  function openPassword() {
    $('changePasswordForm').reset(); updateStrength();
    document.querySelectorAll('#changePasswordModal [data-eye]').forEach(btn=>{
      const input=$(btn.dataset.eye);input.type='password';btn.querySelector('i').className='fas fa-eye';btn.setAttribute('aria-label','إظهار كلمة المرور');
    });
    openDialog('changePasswordModal');$('oldPasswordInput').focus();
  }
  function updateStrength() {
    const s=$('newPasswordInput').value;
    const score = (s.length>=8?1:0)+(s.length>=12?1:0)+(/[a-z]/i.test(s)&&/\d/.test(s)?1:0)+(/[^\w\s]/.test(s)?1:0);
    const bar=$('passwordStrengthBar');bar.style.width=(score*25)+'%';
    bar.style.background=score>=4?'#2e8b57':score>=3?'#bb8429':'#c43a3a';
    $('passwordStrengthText').textContent=!s?'8 أحرف على الأقل، ويفضل استخدام حروف وأرقام ورموز.':(score<=1?'كلمة مرور ضعيفة':score<=2?'قوة متوسطة':score===3?'كلمة مرور جيدة':'كلمة مرور قوية');
  }
  async function savePassword(event) {
    event.preventDefault();if(state.passwordBusy) return;
    if (!$('changePasswordForm').reportValidity()) return;
    const current=$('oldPasswordInput').value;
    const password=$('newPasswordInput').value;
    const confirmation=$('confirmPasswordInput').value;
    if(password.length<8){message('الحد الأدنى 8 أحرف','warning');return;}
    if(password!==confirmation){message('تأكيد كلمة المرور غير مطابق','warning');return;}
    if(current===password){message('اختر كلمة مرور جديدة تختلف عن الحالية','warning');return;}
    state.passwordBusy=true;setBusy($('savePasswordBtn'),true,'جاري التحديث...');
    try {
      if (!window.API?.request) throw new Error('واجهة API لا تدعم تغيير كلمة المرور');
      // This route is added by the accompanying backend files. The password is never logged or persisted locally.
      await API.request('/change-password',{method:'POST',body:{current_password:current,password,password_confirmation:confirmation}});
      $('changePasswordForm').reset();
      API.clearToken?.();
      message('تم تغيير كلمة المرور. سجل دخولك مجددًا.','success');
      window.location.replace('login.html');
    } catch(e) {
      console.error('Password update failed:', e?.status, e?.message);
      message(e?.status===404?'مسار تغيير كلمة المرور غير مُثبت على Backend. راجع تعليمات الحزمة.':errorText(e),'error');
    } finally {state.passwordBusy=false;setBusy($('savePasswordBtn'),false);}
  }
  async function logout() {
    if(state.loggingOut) return;
    const confirmed=await askConfirmation('تسجيل الخروج','هل تريد إنهاء الجلسة الحالية والعودة إلى شاشة تسجيل الدخول؟','تسجيل الخروج',true);
    if(!confirmed)return;
    state.loggingOut=true;
    try{await API.logout?.();}
    catch(e){console.warn('Logout server error:',e?.status);} // Local credentials must be cleared even if the server cannot be reached.
    finally {
      API.clearToken?.();
      localStorage.removeItem('banquet_kitchen_user');sessionStorage.removeItem('banquet_kitchen_user');
      window.location.replace('login.html');
    }
  }
  function bindEvents() {
    $('editProfileBtn').addEventListener('click',openEdit);
    $('editProfileForm').addEventListener('submit',saveProfile);
    $('retrySettingsBtn').addEventListener('click',loadRestaurant);
    $('changeLogoBtn').addEventListener('click',()=>$('logoInput').click());
    $('logoInput').addEventListener('change',e=>{if(e.target.files?.[0])uploadLogo(e.target.files[0]);});
    $('removeLogoBtn').addEventListener('click',removeLogo);
    $('changePasswordSetting').addEventListener('click',openPassword);
    $('changePasswordForm').addEventListener('submit',savePassword);
    $('newPasswordInput').addEventListener('input',updateStrength);
    $('settingsLogoutBtn').addEventListener('click',logout);
    document.querySelectorAll('[data-close]').forEach(element=>element.addEventListener('click',()=>{
      if(state.busy||state.passwordBusy)return;
      closeDialog(element.dataset.close);
    }));
    $('settingsConfirmModal').addEventListener('click',e=>{
      const btn=e.target.closest('[data-confirm]');
      if(btn)settleConfirm(btn.dataset.confirm==='accept');
    });
    document.querySelectorAll('[data-eye]').forEach(btn=>btn.addEventListener('click',()=>{
      const input=$(btn.dataset.eye);
      const showing=input.type==='text';input.type=showing?'password':'text';
      btn.querySelector('i').className=showing?'fas fa-eye':'fas fa-eye-slash';
      btn.setAttribute('aria-label',showing?'إظهار كلمة المرور':'إخفاء كلمة المرور');
    }));
    document.addEventListener('keydown',e=>{
      const opened=MODALS.map(id=>$(id)).filter(m=>m.classList.contains('active'));
      if(!opened.length)return;
      const current=opened.at(-1);
      if(e.key==='Escape'){
        if(current.id==='settingsConfirmModal')settleConfirm(false);
        else if(!state.busy&&!state.passwordBusy)closeDialog(current.id);
        return;
      }
      if(e.key!=='Tab')return;
      const focusable=[...current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(node=>node.getClientRects().length);
      if(!focusable.length)return;
      if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus();}
    });
  }
  function init() {
    $('settingsYear').textContent=String(new Date().getFullYear());
    initPreferences();bindEvents();loadRestaurant();
  }
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRestaurantSettings, { once: true });
} else {
  initializeRestaurantSettings();
}
