'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const state = {
        items: [],
        filteredItems: [],
        editingId: null,
        loading: false,
        saving: false
    };

    const $ = selector => document.querySelector(selector);

    const listEl = $('#itemsList');
    const searchInput = $('#itemSearch');

    const countEl = $('#itemsCount');
    const minPriceEl = $('#minPrice');
    const maxPriceEl = $('#maxPrice');

    const addItemBtn = $('#addItemBtn');
    const fab = $('#fab');

    const modal = $('#itemModal');
    const modalTitle = $('#itemModalTitle');

    const form = $('#itemForm');
    const nameInput = $('#itemName');
    const priceInput = $('#itemPrice');
    const noteInput = $('#itemNote');
    const saveBtn = $('#saveItemBtn');

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

    function formatCurrency(value) {
        if (
            window.Utils &&
            typeof Utils.formatCurrency === 'function'
        ) {
            return Utils.formatCurrency(value);
        }

        const number = Number(value) || 0;

        return `${number.toLocaleString('ar-SA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} ر.س`;
    }

    function escapeHtml(value) {
        if (
            window.Utils &&
            typeof Utils.escapeHtml === 'function'
        ) {
            return Utils.escapeHtml(value);
        }

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getErrorMessage(error) {
        if (
            window.Utils &&
            typeof Utils.getErrorText === 'function'
        ) {
            return Utils.getErrorText(error);
        }

        return error?.message ||
            'حدث خطأ أثناء تنفيذ العملية.';
    }

    function openModal() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            nameInput.focus();
        }, 100);
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';

        state.editingId = null;
        form.reset();

        modalTitle.textContent = 'إضافة صنف جديد';
        saveBtn.innerHTML =
            '<i class="fas fa-save"></i> حفظ الصنف';
    }

    function openAddModal() {
        state.editingId = null;

        form.reset();

        modalTitle.textContent = 'إضافة صنف جديد';

        saveBtn.innerHTML =
            '<i class="fas fa-save"></i> حفظ الصنف';

        openModal();
    }

    function openEditModal(item) {
        if (!item) return;

        state.editingId = Number(item.id);

        modalTitle.textContent = 'تعديل الصنف';

        nameInput.value = item.name || '';
        priceInput.value =
            item.default_price ?? '';
        noteInput.value =
            item.note || '';

        openModal();
    }

    function updateSummary() {
        const items = state.items;

        if (!items.length) {
            countEl.textContent = '0';
            minPriceEl.textContent = '0 ر.س';
            maxPriceEl.textContent = '0 ر.س';
            return;
        }

        const prices = items.map(item =>
            Number(item.default_price) || 0
        );

        const min = Math.min(...prices);
        const max = Math.max(...prices);

        countEl.textContent =
            items.length.toLocaleString('ar-SA');

        minPriceEl.textContent =
            formatCurrency(min);

        maxPriceEl.textContent =
            formatCurrency(max);
    }

    function filterItems() {
        const term =
            searchInput.value.trim().toLowerCase();

        if (!term) {
            state.filteredItems = [...state.items];
            return;
        }

        state.filteredItems = state.items.filter(item => {
            const name =
                String(item.name || '').toLowerCase();

            const note =
                String(item.note || '').toLowerCase();

            return (
                name.includes(term) ||
                note.includes(term)
            );
        });
    }

    function renderLoading() {
        listEl.innerHTML = `
            <div class="items-loading">
                <i class="fas fa-spinner fa-spin"></i>
                جاري تحميل الأصناف...
            </div>
        `;
    }

    function renderEmpty(searching = false) {
        listEl.innerHTML = `
            <div class="items-empty">
                <div class="items-empty-icon">
                    <i class="fas fa-${
                        searching
                            ? 'magnifying-glass'
                            : 'utensils'
                    }"></i>
                </div>

                <div class="items-empty-title">
                    ${
                        searching
                            ? 'لا توجد نتائج'
                            : 'لا توجد أصناف'
                    }
                </div>

                <div class="items-empty-text">
                    ${
                        searching
                            ? 'لم يتم العثور على صنف مطابق للبحث.'
                            : 'ابدأ بإضافة الأصناف المستخدمة في الحجوزات.'
                    }
                </div>

                ${
                    !searching
                        ? `
                            <button
                                type="button"
                                class="btn btn-primary"
                                id="emptyAddItemBtn"
                            >
                                <i class="fas fa-plus"></i>
                                إضافة صنف جديد
                            </button>
                        `
                        : ''
                }
            </div>
        `;

        const emptyAdd =
            $('#emptyAddItemBtn');

        emptyAdd?.addEventListener(
            'click',
            openAddModal
        );
    }

    function renderItems() {
        filterItems();

        const items = state.filteredItems;

        if (!items.length) {
            renderEmpty(
                Boolean(searchInput.value.trim())
            );
            return;
        }

        listEl.innerHTML = items.map(item => {

            const id = Number(item.id);

            const name =
                escapeHtml(item.name || 'بدون اسم');

            const price =
                formatCurrency(item.default_price);

            const note =
                item.note
                    ? `
                        <span class="item-note">
                            <i class="fas fa-note-sticky"></i>
                            ${escapeHtml(item.note)}
                        </span>
                    `
                    : '';

            return `
                <article
                    class="item-card"
                    data-id="${id}"
                >

                    <div class="item-icon">
                        <i class="fas fa-utensils"></i>
                    </div>

                    <div class="item-info">

                        <div class="item-name">
                            ${name}
                        </div>

                        <div class="item-details">

                            <span class="item-price">
                                ${price}
                            </span>

                            ${note}

                        </div>

                    </div>

                    <div class="item-actions">

                        <button
                            type="button"
                            class="btn-icon-sm btn-icon-primary"
                            data-action="edit"
                            title="تعديل"
                            aria-label="تعديل ${name}"
                        >
                            <i class="fas fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="btn-icon-sm btn-icon-danger"
                            data-action="delete"
                            title="حذف"
                            aria-label="حذف ${name}"
                        >
                            <i class="fas fa-trash"></i>
                        </button>

                    </div>

                </article>
            `;
        }).join('');
    }

    async function loadItems() {
        if (state.loading) return;

        state.loading = true;

        renderLoading();

        try {
            const data = await API.getItems();

            state.items =
                Array.isArray(data)
                    ? data
                    : [];

            state.filteredItems =
                [...state.items];

            updateSummary();
            renderItems();

        } catch (error) {
            console.error(
                'Failed to load items:',
                error
            );

            listEl.innerHTML = `
                <div class="items-empty">

                    <div class="items-empty-icon">
                        <i class="fas fa-triangle-exclamation"></i>
                    </div>

                    <div class="items-empty-title">
                        تعذر تحميل الأصناف
                    </div>

                    <div class="items-empty-text">
                        ${escapeHtml(
                            getErrorMessage(error)
                        )}
                    </div>

                    <button
                        type="button"
                        class="btn btn-primary"
                        id="retryItemsBtn"
                    >
                        <i class="fas fa-rotate"></i>
                        إعادة المحاولة
                    </button>

                </div>
            `;

            $('#retryItemsBtn')?.addEventListener(
                'click',
                loadItems
            );

        } finally {
            state.loading = false;
        }
    }

    async function saveItem() {
        if (state.saving) return;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name =
            nameInput.value.trim();

        const price =
            Number(priceInput.value);

        const note =
            noteInput.value.trim();

        if (!name) {
            showToast(
                'يرجى إدخال اسم الصنف',
                'warning'
            );

            nameInput.focus();
            return;
        }

        if (!Number.isFinite(price) || price < 0) {
            showToast(
                'يرجى إدخال سعر صحيح',
                'warning'
            );

            priceInput.focus();
            return;
        }

        const payload = {
            name,
            default_price: Number(
                price.toFixed(2)
            ),
            note: note || null
        };

        state.saving = true;

        if (
            window.Utils &&
            typeof Utils.setLoadingButton === 'function'
        ) {
            Utils.setLoadingButton(
                saveBtn,
                true,
                'جاري الحفظ...'
            );
        } else {
            saveBtn.disabled = true;
            saveBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        }

        try {

            if (state.editingId !== null) {

                await API.updateItem(
                    state.editingId,
                    payload
                );

                showToast(
                    'تم تحديث الصنف بنجاح',
                    'success'
                );

            } else {

                await API.createItem(
                    payload
                );

                showToast(
                    'تم إضافة الصنف بنجاح',
                    'success'
                );
            }

            closeModal();

            await loadItems();

        } catch (error) {

            console.error(
                'Failed to save item:',
                error
            );

            showToast(
                getErrorMessage(error),
                'error'
            );

        } finally {

            state.saving = false;

            if (
                window.Utils &&
                typeof Utils.setLoadingButton === 'function'
            ) {
                Utils.setLoadingButton(
                    saveBtn,
                    false
                );
            } else {
                saveBtn.disabled = false;
                saveBtn.innerHTML =
                    '<i class="fas fa-save"></i> حفظ الصنف';
            }
        }
    }

    function confirmDelete(item) {
        if (!item) return;

        const name =
            item.name || 'هذا الصنف';

        if (
            window.Layout &&
            typeof Layout.showConfirm === 'function'
        ) {
            Layout.showConfirm({
                title: 'حذف الصنف',
                message:
                    `هل أنت متأكد من حذف "${name}"؟ لا يمكن التراجع عن هذه العملية.`,
                confirmText: 'حذف',
                cancelText: 'إلغاء',
                danger: true,
                onConfirm: () => deleteItem(item)
            });

            return;
        }

        if (
            window.Utils &&
            typeof Utils.confirmAction === 'function'
        ) {
            if (
                Utils.confirmAction(
                    `هل أنت متأكد من حذف "${name}"؟`
                )
            ) {
                deleteItem(item);
            }

            return;
        }

        if (
            window.confirm(
                `هل أنت متأكد من حذف "${name}"؟`
            )
        ) {
            deleteItem(item);
        }
    }

    async function deleteItem(item) {
        try {

            await API.deleteItem(
                Number(item.id)
            );

            showToast(
                'تم حذف الصنف بنجاح',
                'success'
            );

            state.items =
                state.items.filter(
                    current =>
                        Number(current.id) !==
                        Number(item.id)
                );

            updateSummary();
            renderItems();

        } catch (error) {

            console.error(
                'Failed to delete item:',
                error
            );

            showToast(
                getErrorMessage(error),
                'error'
            );
        }
    }

    function handleListClick(event) {
        const button =
            event.target.closest(
                '[data-action]'
            );

        if (!button) return;

        const card =
            button.closest('.item-card');

        if (!card) return;

        const id =
            Number(card.dataset.id);

        if (!Number.isInteger(id)) return;

        const item =
            state.items.find(
                current =>
                    Number(current.id) === id
            );

        if (!item) return;

        const action =
            button.dataset.action;

        if (action === 'edit') {
            openEditModal(item);
        }

        if (action === 'delete') {
            confirmDelete(item);
        }
    }

    function bindEvents() {

        addItemBtn?.addEventListener(
            'click',
            openAddModal
        );

        fab?.addEventListener(
            'click',
            openAddModal
        );

        form?.addEventListener(
            'submit',
            event => {
                event.preventDefault();
                saveItem();
            }
        );

        searchInput?.addEventListener(
            'input',
            renderItems
        );

        listEl?.addEventListener(
            'click',
            handleListClick
        );

        document
            .querySelectorAll(
                '[data-close="itemModal"]'
            )
            .forEach(button => {
                button.addEventListener(
                    'click',
                    closeModal
                );
            });

        document.addEventListener(
            'keydown',
            event => {

                if (
                    event.key === 'Escape' &&
                    modal.classList.contains('active')
                ) {
                    closeModal();
                }
            }
        );

        document.addEventListener(
            'fab:modal:opened',
            event => {

                if (
                    event.detail?.modalId ===
                    'itemModal'
                ) {
                    openAddModal();
                }
            }
        );
    }

    async function init() {

        if (
            !window.API ||
            !window.Utils
        ) {
            setTimeout(
                init,
                100
            );
            return;
        }

        bindEvents();

        await loadItems();
    }

    init();

});