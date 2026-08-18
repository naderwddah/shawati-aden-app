// ============================================================
// assets/js/pages/settings.js
// صفحة الإعدادات – إدارة الملف الشخصي، كلمة المرور، التفضيلات
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ============================================================
  // 1. تحميل بيانات الملف الشخصي من localStorage
  // ============================================================
  const PROFILE_KEY = 'app_profile';

  function getDefaultProfile() {
    return {
      name: 'شواطئ عدن',
      phone: '0500000000',
      address: 'الرياض - المملكة العربية السعودية',
      email: 'info@shawaetaden.com',
      logo: '' // base64 data URL
    };
  }

  function loadProfile() {
    let profile = localStorage.getItem(PROFILE_KEY);
    if (profile) {
      try {
        return JSON.parse(profile);
      } catch (e) {
        return getDefaultProfile();
      }
    }
    return getDefaultProfile();
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function applyProfileToUI(profile) {
    document.getElementById('businessName').textContent = profile.name || 'اسم المحل';
    document.getElementById('businessPhone').textContent = profile.phone || 'رقم الجوال';
    document.getElementById('businessAddress').textContent = profile.address || 'العنوان';
    document.getElementById('businessEmail').textContent = profile.email || 'البريد الإلكتروني';

    const logoImg = document.getElementById('logoImage');
    const logoPlaceholder = document.getElementById('logoPlaceholder');
    if (profile.logo && profile.logo.startsWith('data:image')) {
      logoImg.src = profile.logo;
      logoImg.style.display = 'block';
      logoPlaceholder.style.display = 'none';
    } else {
      logoImg.style.display = 'none';
      logoPlaceholder.style.display = 'block';
    }
  }

  // ============================================================
  // 2. تهيئة الصفحة
  // ============================================================
  let profile = loadProfile();
  applyProfileToUI(profile);

  // ============================================================
  // 3. تعديل الملف الشخصي (فتح المودال)
  // ============================================================
  const editProfileBtn = document.getElementById('editProfileBtn');
  const editProfileModal = document.getElementById('editProfileModal');
  const editName = document.getElementById('editBusinessName');
  const editPhone = document.getElementById('editBusinessPhone');
  const editAddress = document.getElementById('editBusinessAddress');
  const editEmail = document.getElementById('editBusinessEmail');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  editProfileBtn.addEventListener('click', function() {
    // تعبئة الحقول بالقيم الحالية
    editName.value = profile.name || '';
    editPhone.value = profile.phone || '';
    editAddress.value = profile.address || '';
    editEmail.value = profile.email || '';
    editProfileModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // إغلاق المودال
  document.querySelectorAll('[data-close="editProfileModal"]').forEach(btn => {
    btn.addEventListener('click', function() {
      editProfileModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // حفظ التغييرات
  saveProfileBtn.addEventListener('click', function() {
    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const address = editAddress.value.trim();
    const email = editEmail.value.trim();

    if (!name) {
      showToast('يرجى إدخال اسم المحل', 'warning');
      return;
    }
    if (!phone) {
      showToast('يرجى إدخال رقم الجوال', 'warning');
      return;
    }

    profile.name = name;
    profile.phone = phone;
    profile.address = address;
    profile.email = email;
    saveProfile(profile);
    applyProfileToUI(profile);
    editProfileModal.classList.remove('active');
    document.body.style.overflow = '';
    showToast('تم تحديث الملف الشخصي بنجاح', 'success');
  });

  // ============================================================
  // 4. تغيير كلمة المرور (مودال)
  // ============================================================
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordModal = document.getElementById('changePasswordModal');
  const oldPasswordInput = document.getElementById('oldPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const savePasswordBtn = document.getElementById('savePasswordBtn');

  changePasswordBtn.addEventListener('click', function() {
    // تفريغ الحقول
    oldPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    changePasswordModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => oldPasswordInput.focus(), 100);
  });

  document.querySelectorAll('[data-close="changePasswordModal"]').forEach(btn => {
    btn.addEventListener('click', function() {
      changePasswordModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  savePasswordBtn.addEventListener('click', function() {
    const old = oldPasswordInput.value.trim();
    const newPass = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();

    if (!old) {
      showToast('يرجى إدخال كلمة المرور الحالية', 'warning');
      oldPasswordInput.focus();
      return;
    }
    if (!newPass || newPass.length < 6) {
      showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'warning');
      newPasswordInput.focus();
      return;
    }
    if (newPass !== confirm) {
      showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين', 'warning');
      confirmPasswordInput.focus();
      return;
    }

    // في الواقع هنا يجب التحقق من كلمة المرور الحالية مع الخادم، لكننا نستخدم localStorage وهمي
    const storedPassword = localStorage.getItem('app_password') || '123456'; // كلمة مرور افتراضية
    if (old !== storedPassword) {
      showToast('كلمة المرور الحالية غير صحيحة', 'error');
      oldPasswordInput.focus();
      return;
    }

    // حفظ كلمة المرور الجديدة
    localStorage.setItem('app_password', newPass);
    changePasswordModal.classList.remove('active');
    document.body.style.overflow = '';
    showToast('تم تغيير كلمة المرور بنجاح', 'success');
  });

  // ============================================================
  // 5. تغيير الشعار (رفع صورة)
  // ============================================================
  const changeLogoBtn = document.getElementById('changeLogoBtn');
  const logoInput = document.getElementById('logoInput');

  changeLogoBtn.addEventListener('click', function() {
    logoInput.click();
  });

  logoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح', 'warning');
      logoInput.value = '';
      return;
    }

    // قراءة الملف كـ Data URL
    const reader = new FileReader();
    reader.onload = function(event) {
      const dataUrl = event.target.result;
      profile.logo = dataUrl;
      saveProfile(profile);
      applyProfileToUI(profile);
      showToast('تم تحديث الشعار بنجاح', 'success');
      logoInput.value = '';
    };
    reader.onerror = function() {
      showToast('حدث خطأ أثناء قراءة الصورة', 'error');
    };
    reader.readAsDataURL(file);
  });

  // ============================================================
  // 6. إدارة التفضيلات (toggles)
  // ============================================================
  document.querySelectorAll('.toggle input:not(#themeToggle)').forEach(toggle => {
    const key = toggle.dataset.name || toggle.id;
    const saved = localStorage.getItem('setting_' + key);
    if (saved !== null) {
      toggle.checked = saved === 'true';
    }
    toggle.addEventListener('change', function() {
      localStorage.setItem('setting_' + key, this.checked);
    });
  });

  // ============================================================
  // 7. مسح البيانات
  // ============================================================
  const clearBtn = document.getElementById('clearDataBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      showConfirm({
        title: 'مسح جميع البيانات',
        message: 'هل أنت متأكد من رغبتك في مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.',
        confirmText: 'مسح',
        danger: true,
        onConfirm: function() {
          // مسح كل شيء من localStorage ما عدا الإعدادات والملف الشخصي
          const keysToKeep = ['app_profile', 'theme', 'setting_تنبيهات الحجوزات', 'setting_المؤثرات الصوتية'];
          for (let key in localStorage) {
            if (!keysToKeep.includes(key) && localStorage.hasOwnProperty(key)) {
              localStorage.removeItem(key);
            }
          }
          showToast('تم مسح جميع البيانات بنجاح', 'success');
          // إعادة تحميل الصفحة لتحديث الواجهة
          setTimeout(() => window.location.reload(), 500);
        }
      });
    });
  }

  // ============================================================
  // 8. عناصر الإعدادات الأخرى (export, about, terms) – توجيهات بسيطة
  // ============================================================
  document.querySelectorAll('.settings-item[data-setting]').forEach(item => {
    item.addEventListener('click', function() {
      const setting = this.dataset.setting;
      if (setting === 'export') {
        showToast('سيتم فتح نافذة تصدير البيانات قريباً', 'info');
      } else if (setting === 'about') {
        showToast('شواطئ عدن – الإصدار 2.0.0', 'info');
      } else if (setting === 'terms') {
        showToast('سيتم عرض الشروط والأحكام', 'info');
      }
    });
  });

  // ============================================================
  // 9. إغلاق المودالات بالضغط على ESC (تم التعامل معها في layout.js)
  // ============================================================
  // لا حاجة لإضافة مستمع إضافي، layout.js يتولى ذلك.
});