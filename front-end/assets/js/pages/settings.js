'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const $ = selector => document.querySelector(selector);

    const businessName = $('#businessName');
    const businessDescription = $('#businessDescription');
    const businessDescriptionInfo = $('#businessDescriptionInfo');
    const businessPhone = $('#businessPhone');
    const businessWhatsapp = $('#businessWhatsapp');
    const businessFacebook = $('#businessFacebook');
    const businessInstagram = $('#businessInstagram');
    const businessAddress = $('#businessAddress');

    const logoImage = $('#logoImage');
    const logoPlaceholder = $('#logoPlaceholder');
    const logoInput = $('#logoInput');
    const changeLogoBtn = $('#changeLogoBtn');

    const editProfileBtn = $('#editProfileBtn');
    const editProfileModal = $('#editProfileModal');
    const editProfileForm = $('#editProfileForm');
    const saveProfileBtn = $('#saveProfileBtn');

    const editName = $('#editBusinessNameInput');
    const editDescription = $('#editBusinessDescriptionInput');
    const editPhone = $('#editBusinessPhoneInput');
    const editWhatsapp = $('#editBusinessWhatsappInput');
    const editFacebook = $('#editBusinessFacebookInput');
    const editInstagram = $('#editBusinessInstagramInput');
    const editAddress = $('#editBusinessAddressInput');

    const changePasswordBtn = $('#changePasswordBtn');
    const changePasswordSetting = $('#changePasswordSetting');
    const changePasswordModal = $('#changePasswordModal');
    const changePasswordForm = $('#changePasswordForm');

    const oldPassword = $('#oldPasswordInput');
    const newPassword = $('#newPasswordInput');
    const confirmPassword = $('#confirmPasswordInput');
    const savePasswordBtn = $('#savePasswordBtn');

    const logoutBtn = $('#logoutBtn');

    const bookingNotificationsToggle =
        $('#bookingNotificationsToggle');

    const soundEffectsToggle =
        $('#soundEffectsToggle');

    const themeToggle =
        $('#themeToggle');

    let restaurant = null;

    function showToast(message, type = 'info') {
        if (
            window.Layout &&
            typeof Layout.showToast === 'function'
        ) {
            Layout.showToast(message, type);
            return;
        }

        if (
            window.Utils &&
            typeof Utils.notify === 'function'
        ) {
            Utils.notify(message, type);
            return;
        }

        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    function confirmAction(message) {
        if (
            window.Layout &&
            typeof Layout.showConfirm === 'function'
        ) {
            return new Promise(resolve => {
                Layout.showConfirm({
                    title: 'تأكيد',
                    message,
                    confirmText: 'تأكيد',
                    cancelText: 'إلغاء',
                    danger: true,
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });
        }

        return Promise.resolve(
            window.confirm(message)
        );
    }

    function setText(element, value) {
        if (!element) return;

        element.textContent =
            value === null ||
            value === undefined ||
            value === ''
                ? '—'
                : String(value);
    }

    function getLogoUrl(value) {
        if (!value) return '';

        const url = String(value);

        if (
            url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('data:')
        ) {
            return url;
        }

        if (url.startsWith('/')) {
            return `http://127.0.0.1:8000${url}`;
        }

        return `http://127.0.0.1:8000/storage/${url}`;
    }

    function renderLogo(value) {
        const url = getLogoUrl(value);

        if (!logoImage || !logoPlaceholder) {
            return;
        }

        if (!url) {
            logoImage.removeAttribute('src');
            logoImage.style.display = 'none';
            logoPlaceholder.style.display = 'flex';
            return;
        }

        logoImage.onload = () => {
            logoImage.style.display = 'block';
            logoPlaceholder.style.display = 'none';
        };

        logoImage.onerror = () => {
            logoImage.removeAttribute('src');
            logoImage.style.display = 'none';
            logoPlaceholder.style.display = 'flex';
        };

        logoImage.src = url;
    }

    function renderRestaurant(data) {
        if (!data) return;

        restaurant = { ...data };

        setText(businessName, data.name);
        setText(businessDescription, data.description);
        setText(businessDescriptionInfo, data.description);
        setText(businessPhone, data.phone);
        setText(businessWhatsapp, data.whatsapp);
        setText(businessFacebook, data.facebook);
        setText(businessInstagram, data.instagram);
        setText(businessAddress, data.address);

        renderLogo(data.logo);
    }

    async function loadRestaurant() {
        try {
            const data = await API.getRestaurant();

            renderRestaurant(data);
        } catch (error) {
            console.error(
                'Failed to load restaurant:',
                error
            );

            showToast(
                Utils.getErrorText(error),
                'error'
            );
        }
    }

    function openModal(modal) {
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openEditProfile() {
        if (!restaurant) {
            showToast(
                'بيانات المطعم غير محملة بعد',
                'warning'
            );
            return;
        }

        editName.value = restaurant.name || '';
        editDescription.value = restaurant.description || '';
        editPhone.value = restaurant.phone || '';
        editWhatsapp.value = restaurant.whatsapp || '';
        editFacebook.value = restaurant.facebook || '';
        editInstagram.value = restaurant.instagram || '';
        editAddress.value = restaurant.address || '';

        openModal(editProfileModal);

        setTimeout(() => {
            editName.focus();
        }, 100);
    }

    async function saveProfile() {
        if (!editProfileForm.checkValidity()) {
            editProfileForm.reportValidity();
            return;
        }

        const payload = {
            name: editName.value.trim(),
            description: editDescription.value.trim() || null,
            phone: editPhone.value.trim() || null,
            whatsapp: editWhatsapp.value.trim() || null,
            facebook: editFacebook.value.trim() || null,
            instagram: editInstagram.value.trim() || null,
            address: editAddress.value.trim() || null
        };

        if (!payload.name) {
            showToast(
                'اسم المطعم مطلوب',
                'warning'
            );
            editName.focus();
            return;
        }

        Utils.setLoadingButton(
            saveProfileBtn,
            true,
            'جاري الحفظ...'
        );

        try {
            const updated = await API.updateRestaurant(
                payload
            );

            renderRestaurant(updated);

            closeModal(editProfileModal);

            showToast(
                'تم حفظ بيانات المطعم بنجاح',
                'success'
            );
        } catch (error) {
            console.error(
                'Failed to update restaurant:',
                error
            );

            showToast(
                Utils.getErrorText(error),
                'error'
            );
        } finally {
            Utils.setLoadingButton(
                saveProfileBtn,
                false
            );
        }
    }

    async function uploadLogo(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast(
                'يرجى اختيار ملف صورة صالح',
                'warning'
            );

            logoInput.value = '';
            return;
        }

        const maxSize = 5 * 1024 * 1024;

        if (file.size > maxSize) {
            showToast(
                'حجم الشعار يجب ألا يتجاوز 5 ميجابايت',
                'warning'
            );

            logoInput.value = '';
            return;
        }

        try {
            changeLogoBtn.disabled = true;
            changeLogoBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

            const updated = await API.uploadRestaurantLogo(
                file
            );

            renderRestaurant(updated);

            showToast(
                'تم تحديث شعار المطعم بنجاح',
                'success'
            );
        } catch (error) {
            console.error(
                'Failed to upload logo:',
                error
            );

            showToast(
                Utils.getErrorText(error),
                'error'
            );
        } finally {
            changeLogoBtn.disabled = false;
            changeLogoBtn.innerHTML =
                '<i class="fas fa-camera"></i> تغيير';

            logoInput.value = '';
        }
    }

    function loadLocalPreferences() {
        const notifications =
            localStorage.getItem(
                'banquet_booking_notifications'
            );

        const sounds =
            localStorage.getItem(
                'banquet_sound_effects'
            );

        const darkMode =
            localStorage.getItem(
                'banquet_dark_mode'
            );

        if (notifications !== null) {
            bookingNotificationsToggle.checked =
                notifications === 'true';
        }

        if (sounds !== null) {
            soundEffectsToggle.checked =
                sounds === 'true';
        }

        if (darkMode !== null) {
            themeToggle.checked =
                darkMode === 'true';
        }

        applyTheme(themeToggle.checked);
    }

    function applyTheme(dark) {
        document.documentElement.classList.toggle(
            'dark',
            Boolean(dark)
        );

        document.body.classList.toggle(
            'dark',
            Boolean(dark)
        );
    }

    function savePreference(key, value) {
        localStorage.setItem(
            key,
            String(Boolean(value))
        );
    }

    function handlePreferences() {
        bookingNotificationsToggle?.addEventListener(
            'change',
            () => {
                savePreference(
                    'banquet_booking_notifications',
                    bookingNotificationsToggle.checked
                );
            }
        );

        soundEffectsToggle?.addEventListener(
            'change',
            () => {
                savePreference(
                    'banquet_sound_effects',
                    soundEffectsToggle.checked
                );
            }
        );

        themeToggle?.addEventListener(
            'change',
            () => {
                applyTheme(themeToggle.checked);

                savePreference(
                    'banquet_dark_mode',
                    themeToggle.checked
                );
            }
        );
    }

    function openChangePassword() {
        changePasswordForm.reset();

        openModal(changePasswordModal);

        setTimeout(() => {
            oldPassword.focus();
        }, 100);
    }

    async function saveNewPassword() {
        if (!changePasswordForm.checkValidity()) {
            changePasswordForm.reportValidity();
            return;
        }

        const current = oldPassword.value;
        const password = newPassword.value;
        const confirmation = confirmPassword.value;

        if (password.length < 8) {
            showToast(
                'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل',
                'warning'
            );
            newPassword.focus();
            return;
        }

        if (password !== confirmation) {
            showToast(
                'تأكيد كلمة المرور غير مطابق',
                'warning'
            );
            confirmPassword.focus();
            return;
        }

        if (current === password) {
            showToast(
                'كلمة المرور الجديدة يجب أن تختلف عن الحالية',
                'warning'
            );
            newPassword.focus();
            return;
        }

        if (
            !API ||
            typeof API.changePassword !== 'function'
        ) {
            showToast(
                'خدمة تغيير كلمة المرور غير متاحة حاليًا',
                'error'
            );
            return;
        }

        Utils.setLoadingButton(
            savePasswordBtn,
            true,
            'جاري التغيير...'
        );

        try {
            await API.changePassword(
                current,
                password,
                confirmation
            );

            closeModal(changePasswordModal);

            showToast(
                'تم تغيير كلمة المرور بنجاح',
                'success'
            );
        } catch (error) {
            console.error(
                'Failed to change password:',
                error
            );

            showToast(
                Utils.getErrorText(error),
                'error'
            );
        } finally {
            Utils.setLoadingButton(
                savePasswordBtn,
                false
            );
        }
    }

    async function logout() {
        const confirmed = await confirmAction(
            'هل تريد تسجيل الخروج من النظام؟'
        );

        if (!confirmed) return;

        try {
            await API.logout();
        } catch (error) {
            console.error(
                'Logout error:',
                error
            );
        } finally {
            if (typeof API.clearToken === 'function') {
                API.clearToken();
            }

            localStorage.removeItem(
                'banquet_kitchen_user'
            );

            sessionStorage.removeItem(
                'banquet_kitchen_user'
            );

            window.location.replace(
                'login.html'
            );
        }
    }

    function bindModalCloseEvents() {
        document
            .querySelectorAll(
                '[data-close="editProfileModal"]'
            )
            .forEach(element => {
                element.addEventListener(
                    'click',
                    () => closeModal(editProfileModal)
                );
            });

        document
            .querySelectorAll(
                '[data-close="changePasswordModal"]'
            )
            .forEach(element => {
                element.addEventListener(
                    'click',
                    () => closeModal(changePasswordModal)
                );
            });

        document.addEventListener(
            'keydown',
            event => {
                if (event.key !== 'Escape') {
                    return;
                }

                closeModal(editProfileModal);
                closeModal(changePasswordModal);
            }
        );
    }

    function bindEvents() {
        editProfileBtn?.addEventListener(
            'click',
            openEditProfile
        );

        saveProfileBtn?.addEventListener(
            'click',
            saveProfile
        );

        editProfileForm?.addEventListener(
            'submit',
            event => {
                event.preventDefault();
                saveProfile();
            }
        );

        changeLogoBtn?.addEventListener(
            'click',
            () => logoInput?.click()
        );

        logoInput?.addEventListener(
            'change',
            event => {
                const file = event.target.files?.[0];

                if (file) {
                    uploadLogo(file);
                }
            }
        );

        changePasswordBtn?.addEventListener(
            'click',
            openChangePassword
        );

        changePasswordSetting?.addEventListener(
            'click',
            openChangePassword
        );

        savePasswordBtn?.addEventListener(
            'click',
            saveNewPassword
        );

        changePasswordForm?.addEventListener(
            'submit',
            event => {
                event.preventDefault();
                saveNewPassword();
            }
        );

        logoutBtn?.addEventListener(
            'click',
            logout
        );

        bindModalCloseEvents();
        handlePreferences();
    }

    async function init() {
        if (!window.API || !window.Utils) {
            setTimeout(init, 100);
            return;
        }

        loadLocalPreferences();
        bindEvents();
        await loadRestaurant();
    }

    init();
});