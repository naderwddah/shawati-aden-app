'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');
    const errorText = document.getElementById('errorText');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheck = document.getElementById('rememberMe');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const submitBtn = document.querySelector('.btn-login');

    if (!form || !emailInput || !passwordInput || !submitBtn) {
        return;
    }

    const showError = message => {
        if (errorText) {
            errorText.textContent = message;
        }

        if (errorBox) {
            errorBox.classList.add('show');
        }
    };

    const hideError = () => {
        if (errorBox) {
            errorBox.classList.remove('show');
        }
    };

    const resetButton = () => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-arrow-left"></i> تسجيل الدخول';
    };

    const setLoading = () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
    };

    const validateEmail = email => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', hideError);

        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                hideError();
            }
        });
    });

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';

            passwordInput.type = isPassword ? 'text' : 'password';

            togglePasswordBtn.classList.toggle('fa-lock', !isPassword);
            togglePasswordBtn.classList.toggle('fa-eye', isPassword);
        });
    }

    const checkExistingToken = async () => {
        if (!window.API || typeof window.API.isAuthenticated !== 'function') {
            return;
        }

        if (!window.API.isAuthenticated()) {
            return;
        }

        try {
            if (typeof window.API.getUser !== 'function') {
                return;
            }

            const user = await window.API.getUser();

            if (user && user.id) {
                window.location.replace('index.html');
            }
        } catch {
            if (typeof window.API.clearToken === 'function') {
                window.API.clearToken();
            }
        }
    };

    form.addEventListener('submit', async event => {
        event.preventDefault();

        hideError();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const remember = Boolean(
            rememberMeCheck?.checked
        );

        if (!email || !password) {
            showError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
            return;
        }

        if (!validateEmail(email)) {
            showError('يرجى إدخال بريد إلكتروني صحيح');
            emailInput.focus();
            return;
        }

        if (password.length < 1) {
            showError('يرجى إدخال كلمة المرور');
            passwordInput.focus();
            return;
        }

        if (!window.API || typeof window.API.login !== 'function') {
            showError('خدمة تسجيل الدخول غير متاحة');
            return;
        }

        setLoading();

        try {
            const response = await window.API.login(
                email,
                password,
                remember
            );

            const token =
                response?.token ||
                response?.data?.token;

            const user =
                response?.user ||
                response?.data?.user;

            if (!token) {
                throw new Error(
                    response?.message ||
                    'لم يتم استلام رمز الدخول من الخادم'
                );
            }

            if (typeof window.API.setToken === 'function') {
                window.API.setToken(token, remember);
            } else {
                const storage = remember
                    ? localStorage
                    : sessionStorage;

                storage.setItem(
                    'banquet_kitchen_token',
                    token
                );
            }

            if (user) {
                const storage = remember
                    ? localStorage
                    : sessionStorage;

                storage.setItem(
                    'banquet_kitchen_user',
                    JSON.stringify(user)
                );
            }

            if (
                window.Layout &&
                typeof window.Layout.showToast === 'function'
            ) {
                window.Layout.showToast(
                    'تم تسجيل الدخول بنجاح',
                    'success'
                );
            }

            window.location.replace('index.html');
        } catch (error) {
            const message =
                typeof window.Utils?.getErrorText === 'function'
                    ? window.Utils.getErrorText(error)
                    : error?.message ||
                      'فشل تسجيل الدخول، يرجى المحاولة مرة أخرى';

            showError(message);

            passwordInput.value = '';
            passwordInput.focus();

            resetButton();
        }
    });

    checkExistingToken();
});