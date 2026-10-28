'use strict';

const Utils = (() => {
    const DEFAULT_CURRENCY = 'ر.س';

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    function toNumber(value, fallback = 0) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    }

    function formatNumber(value, decimals = 2) {
        const number = toNumber(value);

        return new Intl.NumberFormat('ar-SA', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    function formatInteger(value) {
        const number = toNumber(value);

        return new Intl.NumberFormat('ar-SA', {
            maximumFractionDigits: 0
        }).format(number);
    }

    function formatCurrency(value, currency = DEFAULT_CURRENCY) {
        return `${formatNumber(value, 2)} ${currency}`;
    }

    function formatCompactCurrency(value, currency = DEFAULT_CURRENCY) {
        const number = toNumber(value);

        return `${new Intl.NumberFormat('ar-SA', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(number)} ${currency}`;
    }

    function parseDate(value) {
        if (!value) return null;

        const date = value instanceof Date
            ? new Date(value.getTime())
            : new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value, options = {}) {
        const date = parseDate(value);

        if (!date) return '—';

        return new Intl.DateTimeFormat('ar-SA', {
            calendar: 'gregory',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            ...options
        }).format(date);
    }

    function formatDateLong(value) {
        const date = parseDate(value);

        if (!date) return '—';

        return new Intl.DateTimeFormat('ar-SA', {
            calendar: 'gregory',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    }

    function formatDateTime(value) {
        const date = parseDate(value);

        if (!date) return '—';

        return new Intl.DateTimeFormat('ar-SA', {
            calendar: 'gregory',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function formatTime(value) {
        if (!value) return '—';

        const string = String(value);

        const match = string.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

        if (!match) return escapeHtml(string);

        const hours = Number(match[1]);
        const minutes = Number(match[2]);

        if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
            return escapeHtml(string);
        }

        const date = new Date();

        date.setHours(hours, minutes, 0, 0);

        return new Intl.DateTimeFormat('ar-SA', {
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    function toInputDate(value) {
        if (!value) return '';

        const date = parseDate(value);

        if (!date) {
            const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
            return match ? match[1] : '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    function toInputDateTime(value) {
        if (!value) return '';

        const date = parseDate(value);

        if (!date) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function toInputTime(value) {
        if (!value) return '';

        const match = String(value).match(/^(\d{1,2}):(\d{2})/);

        if (!match) return '';

        return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
    }

    function today() {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    function addDays(value, days) {
        const date = parseDate(value);

        if (!date) return null;

        date.setDate(date.getDate() + Number(days));

        return toInputDate(date);
    }

    function startOfDay(value = new Date()) {
        const date = parseDate(value);

        if (!date) return null;

        date.setHours(0, 0, 0, 0);

        return date;
    }

    function endOfDay(value = new Date()) {
        const date = parseDate(value);

        if (!date) return null;

        date.setHours(23, 59, 59, 999);

        return date;
    }

    function calculateItemTotal(quantity, unitPrice) {
        return Number(
            (toNumber(quantity) * toNumber(unitPrice)).toFixed(2)
        );
    }

    function calculateBookingTotal(items = []) {
        if (!Array.isArray(items)) return 0;

        return Number(
            items
                .reduce((total, item) => {
                    const itemTotal = item.total_price !== undefined
                        ? toNumber(item.total_price)
                        : calculateItemTotal(
                            item.quantity,
                            item.unit_price
                        );

                    return total + itemTotal;
                }, 0)
                .toFixed(2)
        );
    }

    function normalizeBookingItems(items = []) {
        if (!Array.isArray(items)) return [];

        return items.map(item => {
            const quantity = toNumber(item.quantity);
            const unitPrice = toNumber(item.unit_price);

            return {
                ...item,
                quantity,
                unit_price: unitPrice,
                total_price: calculateItemTotal(
                    quantity,
                    unitPrice
                )
            };
        });
    }

    function getInitials(name, fallback = '؟') {
        if (!name) return fallback;

        const words = String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) return fallback;

        if (words.length === 1) {
            return words[0].substring(0, 2);
        }

        return `${words[0][0]}${words[1][0]}`;
    }

    function getFirstName(name) {
        if (!name) return '';

        return String(name)
            .trim()
            .split(/\s+/)[0] || '';
    }

    function normalizePhone(phone) {
        if (!phone) return '';

        return String(phone)
            .replace(/[^\d+]/g, '')
            .trim();
    }

    function formatPhone(phone) {
        if (!phone) return '—';

        const value = normalizePhone(phone);

        if (value.startsWith('+')) {
            return value;
        }

        return value;
    }

    function isValidPhone(phone) {
        if (!phone) return false;

        const value = normalizePhone(phone);

        return /^\+?\d{8,15}$/.test(value);
    }

    function isValidEmail(email) {
        if (!email) return false;

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            String(email).trim()
        );
    }

    function isPositiveNumber(value) {
        return toNumber(value) > 0;
    }

    function isNonNegativeNumber(value) {
        return toNumber(value) >= 0;
    }

    function debounce(callback, delay = 300) {
        let timeout = null;

        return function (...args) {
            clearTimeout(timeout);

            timeout = setTimeout(() => {
                callback.apply(this, args);
            }, delay);
        };
    }

    function throttle(callback, delay = 300) {
        let lastCall = 0;
        let timeout = null;

        return function (...args) {
            const now = Date.now();
            const remaining = delay - (now - lastCall);

            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                lastCall = now;
                callback.apply(this, args);
                return;
            }

            if (!timeout) {
                timeout = setTimeout(() => {
                    lastCall = Date.now();
                    timeout = null;
                    callback.apply(this, args);
                }, remaining);
            }
        };
    }

    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function qsa(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function show(element) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.hidden = false;
        element.style.display = '';
        element.classList.remove('hidden');
    }

    function hide(element) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.hidden = true;
        element.style.display = 'none';
        element.classList.add('hidden');
    }

    function toggle(element, visible) {
        if (visible === undefined) {
            const target = typeof element === 'string'
                ? qs(element)
                : element;

            if (!target) return;

            visible = target.hidden || target.style.display === 'none';
        }

        visible ? show(element) : hide(element);
    }

    function setText(element, value, fallback = '—') {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        const text =
            value === null ||
            value === undefined ||
            value === ''
                ? fallback
                : String(value);

        element.textContent = text;
    }

    function setHtml(element, html) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.innerHTML = html ?? '';
    }

    function setValue(element, value = '') {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.value =
            value === null || value === undefined
                ? ''
                : value;
    }

    function getValue(element) {
        if (!element) return '';

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return '';

        return element.value;
    }

    function setDisabled(element, disabled = true) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.disabled = Boolean(disabled);
    }

    function clearElement(element) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.innerHTML = '';
    }

    function showLoading(element, text = 'جاري التحميل...') {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.innerHTML = `
            <div class="loading-state" role="status">
                <span class="loading-spinner"></span>
                <span>${escapeHtml(text)}</span>
            </div>
        `;
    }

    function showEmpty(
        element,
        text = 'لا توجد بيانات'
    ) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">
                    ${escapeHtml(text)}
                </div>
            </div>
        `;
    }

    function showError(
        element,
        text = 'حدث خطأ أثناء تحميل البيانات.'
    ) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.innerHTML = `
            <div class="error-state">
                <div class="error-state-text">
                    ${escapeHtml(text)}
                </div>
            </div>
        `;
    }

    function setLoadingButton(button, loading, loadingText = 'جاري التنفيذ...') {
        if (!button) return;

        if (typeof button === 'string') {
            button = qs(button);
        }

        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.innerHTML;
            }

            button.disabled = true;
            button.innerHTML = `
                <span class="loading-spinner loading-spinner-small"></span>
                <span>${escapeHtml(loadingText)}</span>
            `;
        } else {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    function getStatusLabel(status) {
        const labels = {
            new: 'جديد',
            pending: 'معلق',
            confirmed: 'مؤكد',
            preparing: 'قيد التجهيز',
            ready: 'جاهز',
            delivered: 'تم التسليم',
            completed: 'مكتمل',
            cancelled: 'ملغي',
            canceled: 'ملغي'
        };

        return labels[String(status || '').toLowerCase()] || status || '—';
    }

    function getStatusClass(status) {
        const classes = {
            new: 'status-new',
            pending: 'status-pending',
            confirmed: 'status-confirmed',
            preparing: 'status-preparing',
            ready: 'status-ready',
            delivered: 'status-delivered',
            completed: 'status-completed',
            cancelled: 'status-cancelled',
            canceled: 'status-cancelled'
        };

        return classes[String(status || '').toLowerCase()] || 'status-default';
    }

    function statusBadge(status) {
        return `
            <span class="status-badge ${escapeAttribute(getStatusClass(status))}">
                ${escapeHtml(getStatusLabel(status))}
            </span>
        `;
    }

    function getPaymentMethodLabel(method) {
        if (!method) return '—';

        if (typeof method === 'string') {
            return method;
        }

        return method.name || '—';
    }

    function getBalanceLabel(balance, balanceType) {
        const value = toNumber(balance);

        if (balanceType === 'credit') {
            return `له ${formatCurrency(Math.abs(value))}`;
        }

        if (balanceType === 'settled') {
            return 'متسوى';
        }

        return `عليه ${formatCurrency(Math.abs(value))}`;
    }

    function getBalanceClass(balanceType) {
        if (balanceType === 'credit') return 'balance-credit';
        if (balanceType === 'settled') return 'balance-settled';
        return 'balance-due';
    }

    function balanceBadge(balance, balanceType) {
        return `
            <span class="balance-badge ${escapeAttribute(getBalanceClass(balanceType))}">
                ${escapeHtml(getBalanceLabel(balance, balanceType))}
            </span>
        `;
    }

    function confirmAction(message = 'هل أنت متأكد؟') {
        return window.confirm(message);
    }

    function formToObject(form) {
        if (!form) return {};

        const formData = new FormData(form);
        const object = {};

        formData.forEach((value, key) => {
            if (object[key] !== undefined) {
                if (!Array.isArray(object[key])) {
                    object[key] = [object[key]];
                }

                object[key].push(value);
            } else {
                object[key] = value;
            }
        });

        return object;
    }

    function cleanObject(object = {}) {
        const result = {};

        Object.entries(object).forEach(([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ''
            ) {
                result[key] = value;
            }
        });

        return result;
    }

    function serializeQuery(params = {}) {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (
                value === undefined ||
                value === null ||
                value === ''
            ) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach(item => {
                    searchParams.append(key, item);
                });

                return;
            }

            searchParams.append(key, value);
        });

        return searchParams.toString();
    }

    function generateId(prefix = 'id') {
        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        ) {
            return `${prefix}-${crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 10)}`;
    }

    function scrollToElement(element, behavior = 'smooth') {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        element.scrollIntoView({
            behavior,
            block: 'center'
        });
    }

    function focusElement(element) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        requestAnimationFrame(() => {
            element.focus();
        });
    }

    function parseJson(value, fallback = null) {
        if (typeof value !== 'string') return value;

        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function truncate(value, length = 50) {
        if (value === null || value === undefined) {
            return '';
        }

        const text = String(value);

        if (text.length <= length) {
            return text;
        }

        return `${text.substring(0, length)}…`;
    }

    function pluralize(count, singular, plural) {
        return toNumber(count) === 1
            ? singular
            : plural;
    }

    function getAgeInDays(date) {
        const target = parseDate(date);

        if (!target) return null;

        const now = new Date();

        const difference =
            startOfDay(now).getTime() -
            startOfDay(target).getTime();

        return Math.floor(
            difference / (1000 * 60 * 60 * 24)
        );
    }

    function isToday(value) {
        const date = parseDate(value);

        if (!date) return false;

        return toInputDate(date) === today();
    }

    function isPast(value) {
        const date = parseDate(value);

        if (!date) return false;

        return startOfDay(date) < startOfDay(new Date());
    }

    function isFuture(value) {
        const date = parseDate(value);

        if (!date) return false;

        return startOfDay(date) > startOfDay(new Date());
    }

    function sortByDate(array, field, descending = true) {
        if (!Array.isArray(array)) return [];

        return [...array].sort((a, b) => {
            const dateA = parseDate(a?.[field]);
            const dateB = parseDate(b?.[field]);

            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;

            return descending
                ? dateB - dateA
                : dateA - dateB;
        });
    }

    function groupBy(array, field) {
        if (!Array.isArray(array)) return {};

        return array.reduce((groups, item) => {
            const key = item?.[field] ?? 'undefined';

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);

            return groups;
        }, {});
    }

    function uniqueBy(array, field) {
        if (!Array.isArray(array)) return [];

        const seen = new Set();

        return array.filter(item => {
            const value = item?.[field];

            if (seen.has(value)) {
                return false;
            }

            seen.add(value);
            return true;
        });
    }

    function downloadBlob(blob, filename) {
        if (!(blob instanceof Blob)) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function printElement(element) {
        if (!element) return;

        if (typeof element === 'string') {
            element = qs(element);
        }

        if (!element) return;

        const printWindow = window.open(
            '',
            '_blank',
            'width=1000,height=800'
        );

        if (!printWindow) return;

        const styles = Array.from(
            document.querySelectorAll('link[rel="stylesheet"], style')
        )
            .map(style => style.outerHTML)
            .join('\n');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>طباعة</title>
                ${styles}
            </head>
            <body>
                ${element.outerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();

        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    }

    function getFileExtension(filename) {
        if (!filename) return '';

        const parts = String(filename).split('.');

        return parts.length > 1
            ? parts.pop().toLowerCase()
            : '';
    }

    function formatFileSize(bytes) {
        const size = toNumber(bytes);

        if (size === 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB'];
        const index = Math.floor(
            Math.log(size) / Math.log(1024)
        );

        const value = size / Math.pow(1024, index);

        return `${formatNumber(value, index === 0 ? 0 : 2)} ${units[index] || 'GB'}`;
    }

    function isImageFile(file) {
        if (!file) return false;

        if (file.type) {
            return file.type.startsWith('image/');
        }

        return [
            'jpg',
            'jpeg',
            'png',
            'webp',
            'gif',
            'svg'
        ].includes(getFileExtension(file.name));
    }

    function createImagePreview(file, callback) {
        if (!file || !isImageFile(file)) return;

        const reader = new FileReader();

        reader.onload = event => {
            if (typeof callback === 'function') {
                callback(event.target.result);
            }
        };

        reader.readAsDataURL(file);
    }

    function getErrorText(error) {
        if (!error) {
            return 'حدث خطأ غير معروف.';
        }

        if (error.errors && typeof error.errors === 'object') {
            const messages = [];

            Object.values(error.errors).forEach(value => {
                if (Array.isArray(value)) {
                    messages.push(...value);
                } else if (value) {
                    messages.push(String(value));
                }
            });

            if (messages.length) {
                return messages.join('\n');
            }
        }

        if (error.message) {
            return error.message;
        }

        return 'حدث خطأ أثناء تنفيذ العملية.';
    }

    function notify(message, type = 'info') {
        if (
            window.Toast &&
            typeof window.Toast[type] === 'function'
        ) {
            window.Toast[type](message);
            return;
        }

        if (
            window.Swal &&
            typeof window.Swal.fire === 'function'
        ) {
            window.Swal.fire({
                text: message,
                icon: type === 'error'
                    ? 'error'
                    : type === 'success'
                        ? 'success'
                        : 'info',
                confirmButtonText: 'حسنًا'
            });

            return;
        }

        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    function success(message) {
        notify(message, 'success');
    }

    function error(message) {
        notify(message, 'error');
    }

    function info(message) {
        notify(message, 'info');
    }

    function warn(message) {
        notify(message, 'warning');
    }

    return {
        escapeHtml,
        escapeAttribute,

        toNumber,
        formatNumber,
        formatInteger,
        formatCurrency,
        formatCompactCurrency,

        parseDate,
        formatDate,
        formatDateLong,
        formatDateTime,
        formatTime,
        toInputDate,
        toInputDateTime,
        toInputTime,

        today,
        addDays,
        startOfDay,
        endOfDay,

        calculateItemTotal,
        calculateBookingTotal,
        normalizeBookingItems,

        getInitials,
        getFirstName,

        normalizePhone,
        formatPhone,
        isValidPhone,
        isValidEmail,
        isPositiveNumber,
        isNonNegativeNumber,

        debounce,
        throttle,

        qs,
        qsa,
        byId,

        show,
        hide,
        toggle,

        setText,
        setHtml,
        setValue,
        getValue,
        setDisabled,
        clearElement,

        showLoading,
        showEmpty,
        showError,
        setLoadingButton,

        getStatusLabel,
        getStatusClass,
        statusBadge,

        getPaymentMethodLabel,

        getBalanceLabel,
        getBalanceClass,
        balanceBadge,

        confirmAction,

        formToObject,
        cleanObject,
        serializeQuery,

        generateId,

        scrollToElement,
        focusElement,

        parseJson,
        truncate,
        pluralize,

        getAgeInDays,
        isToday,
        isPast,
        isFuture,

        sortByDate,
        groupBy,
        uniqueBy,

        downloadBlob,
        printElement,

        getFileExtension,
        formatFileSize,
        isImageFile,
        createImagePreview,

        getErrorText,

        notify,
        success,
        error,
        info,
        warn
    };
})();

window.Utils = Utils;