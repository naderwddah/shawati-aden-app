"use strict";

let editingBookingId = null;
let selectedCustomer = null;
let itemsCatalog = [];
let paymentMethods = [];

document.addEventListener("DOMContentLoaded", async () => {
    editingBookingId = getBookingIdFromUrl();

    setupCustomerMode();
    setupCustomerSearch();
    setupBookingEvents();
    setupItemEvents();

    setDefaultDates();

    await loadCustomers();
    await loadItems();
    await loadPaymentMethods();

    if (editingBookingId) {
        await loadBookingForEdit(editingBookingId);
    } else {
        addItemRow();
        calculateTotals();
    }
});

function getBookingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function setupCustomerMode() {
    const existingBtn = document.getElementById("existingCustomerBtn");
    const newBtn = document.getElementById("newCustomerBtn");
    const existingSection = document.getElementById("existingCustomerSection");
    const newSection = document.getElementById("newCustomerSection");

    const showExisting = () => {
        if (existingBtn) existingBtn.classList.add("active");
        if (newBtn) newBtn.classList.remove("active");
        if (existingSection) existingSection.style.display = "";
        if (newSection) newSection.style.display = "none";
    };

    const showNew = () => {
        if (newBtn) newBtn.classList.add("active");
        if (existingBtn) existingBtn.classList.remove("active");
        if (existingSection) existingSection.style.display = "none";
        if (newSection) newSection.style.display = "";
        selectedCustomer = null;
    };

    if (existingBtn) existingBtn.addEventListener("click", showExisting);
    if (newBtn) newBtn.addEventListener("click", showNew);

    showExisting();
}

function setupCustomerSearch() {
    const searchInput = document.getElementById("customerSearch");
    const results = document.getElementById("customerResults");
    const changeBtn = document.getElementById("changeCustomerBtn");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const value = searchInput.value.trim().toLowerCase();

            if (!value) {
                if (results) {
                    results.innerHTML = "";
                    results.style.display = "none";
                }
                return;
            }

            const customers = window.__bookingCustomers || [];

            const filtered = customers.filter(customer => {
                const name = String(customer.name || "").toLowerCase();
                const phone = String(customer.phone || "").toLowerCase();

                return name.includes(value) || phone.includes(value);
            });

            renderCustomerResults(filtered);
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener("click", () => {
            selectedCustomer = null;

            const selectedBox = document.getElementById("selectedCustomer");
            const searchBox = document.getElementById("customerSearch");

            if (selectedBox) selectedBox.style.display = "none";
            if (searchBox) {
                searchBox.value = "";
                searchBox.style.display = "";
                searchBox.focus();
            }

            if (results) {
                results.innerHTML = "";
                results.style.display = "none";
            }
        });
    }
}

function renderCustomerResults(customers) {
    const results = document.getElementById("customerResults");

    if (!results) return;

    if (!customers.length) {
        results.innerHTML = `
            <div class="customer-result-empty">
                لا يوجد عميل مطابق
            </div>
        `;
        results.style.display = "";
        return;
    }

    results.innerHTML = customers.map(customer => `
        <button type="button"
                class="customer-result"
                data-id="${customer.id}">
            <span class="customer-result-name">${escapeHtml(customer.name || "")}</span>
            <span class="customer-result-phone">${escapeHtml(customer.phone || "")}</span>
        </button>
    `).join("");

    results.style.display = "";

    results.querySelectorAll("[data-id]").forEach(button => {
        button.addEventListener("click", () => {
            const customer = customers.find(
                item => String(item.id) === String(button.dataset.id)
            );

            if (customer) selectCustomer(customer);
        });
    });
}

function selectCustomer(customer) {
    selectedCustomer = customer;

    const searchInput = document.getElementById("customerSearch");
    const results = document.getElementById("customerResults");
    const selectedBox = document.getElementById("selectedCustomer");
    const avatar = document.getElementById("selectedCustomerAvatar");
    const name = document.getElementById("selectedCustomerName");
    const phone = document.getElementById("selectedCustomerPhone");

    if (searchInput) {
        searchInput.value = "";
        searchInput.style.display = "none";
    }

    if (results) {
        results.innerHTML = "";
        results.style.display = "none";
    }

    if (selectedBox) selectedBox.style.display = "";

    if (avatar) {
        avatar.textContent = getInitials(customer.name);
    }

    if (name) name.textContent = customer.name || "";
    if (phone) phone.textContent = customer.phone || "";
}

async function loadCustomers() {
    try {
        const response = await window.API.getCustomers();
        const customers = extractArray(response);

        window.__bookingCustomers = customers;
    } catch (error) {
        console.error(error);
        window.__bookingCustomers = [];
        showError("تعذر تحميل العملاء");
    }
}

async function loadItems() {
    try {
        const response = await window.API.getItems();
        itemsCatalog = extractArray(response);
    } catch (error) {
        console.error(error);
        itemsCatalog = [];
        showError("تعذر تحميل الأصناف");
    }
}

async function loadPaymentMethods() {
    try {
        const response = await window.API.getPaymentMethods({
            is_active: 1
        });

        paymentMethods = extractArray(response);

        if (!paymentMethods.length) {
            paymentMethods = [
                { id: 1, name: "نقدي" },
                { id: 2, name: "تحويل بنكي" },
                { id: 3, name: "شبكة" }
            ];
        }
    } catch (error) {
        console.error(error);

        paymentMethods = [
            { id: 1, name: "نقدي" },
            { id: 2, name: "تحويل بنكي" },
            { id: 3, name: "شبكة" }
        ];
    }

    renderPaymentMethods();
}

function renderPaymentMethods() {
    const container = document.getElementById("paymentMethods");

    if (!container) return;

    container.innerHTML = paymentMethods.map((method, index) => `
        <label class="payment-method-option">
            <input
                type="radio"
                name="payment_method_id"
                value="${method.id}"
                ${index === 0 ? "checked" : ""}
            >
            <span>${escapeHtml(method.name || "")}</span>
        </label>
    `).join("");
}
function setupFinanceEvents() {
    const initialPayment = document.getElementById("initialPayment");
    const plateDeposit = document.getElementById("plateDeposit");
    const plateReturned = document.getElementById("plateReturned");

    if (initialPayment) {
        initialPayment.addEventListener("input", () => {
            calculateTotals();
        });
    }

    if (plateDeposit) {
        plateDeposit.addEventListener("input", () => {
            calculateTotals();
        });
    }

    if (plateReturned) {
        plateReturned.addEventListener("input", () => {
            calculateTotals();
        });
    }

    document.addEventListener("change", event => {
        if (event.target.matches('input[name="payment_method_id"]')) {
            updateRemainingPreview();
        }
    });
}

function setupBookingEvents() {
    const saveBtn = document.getElementById("saveBookingBtn");
    const addItemBtn = document.getElementById("addItemBtn");

    if (saveBtn) {
        saveBtn.addEventListener("click", saveBooking);
    }

    if (addItemBtn) {
        addItemBtn.addEventListener("click", () => {
            addItemRow();
            calculateTotals();
        });
    }

    const initialPayment = document.getElementById("initialPayment");

    if (initialPayment) {
        initialPayment.addEventListener("input", updateRemainingPreview);
    }

    [
        "plateDeposit",
        "plateReturned"
    ].forEach(id => {
        const input = document.getElementById(id);

        if (input) {
            input.addEventListener("input", calculateTotals);
        }
    });
}

function setupItemEvents() {
    const container = document.getElementById("itemsContainer");

    if (!container) return;

    container.addEventListener("input", event => {
        if (
            event.target.matches(".item-quantity") ||
            event.target.matches(".item-unit-price")
        ) {
            updateItemRowTotal(event.target.closest(".booking-item-row"));
            calculateTotals();
        }
    });

    container.addEventListener("change", event => {
        if (event.target.matches(".item-select")) {
            const row = event.target.closest(".booking-item-row");
            const itemId = event.target.value;

            const item = itemsCatalog.find(
                catalogItem => String(catalogItem.id) === String(itemId)
            );

            if (item && row) {
                const priceInput = row.querySelector(".item-unit-price");

                if (priceInput && !priceInput.value) {
                    priceInput.value = Number(item.default_price || 0);
                }

                updateItemRowTotal(row);
                calculateTotals();
            }
        }
    });

    container.addEventListener("click", event => {
        const removeButton = event.target.closest(".remove-item-btn");

        if (!removeButton) return;

        const rows = container.querySelectorAll(".booking-item-row");

        if (rows.length <= 1) {
            const row = removeButton.closest(".booking-item-row");

            if (row) {
                const select = row.querySelector(".item-select");
                const quantity = row.querySelector(".item-quantity");
                const price = row.querySelector(".item-unit-price");
                const total = row.querySelector(".item-total");

                if (select) select.value = "";
                if (quantity) quantity.value = 1;
                if (price) price.value = "";
                if (total) total.value = "0";
            }
        } else {
            const row = removeButton.closest(".booking-item-row");
            if (row) row.remove();
        }

        calculateTotals();
    });
}

function addItemRow(item = null) {
    const container = document.getElementById("itemsContainer");

    if (!container) return;

    const row = document.createElement("div");
    row.className = "booking-item-row";

    const options = [
        `<option value="">اختر الصنف</option>`,
        ...itemsCatalog.map(catalogItem => `
            <option
                value="${catalogItem.id}"
                ${item && item.item_id && String(item.item_id) === String(catalogItem.id) ? "selected" : ""}
            >
                ${escapeHtml(catalogItem.name || "")}
            </option>
        `)
    ].join("");

    const selectedName = item?.item_name || item?.name || "";

    if (selectedName && !item?.item_id) {
        options.concat("");
    }

    row.innerHTML = `
        <div class="item-field item-name-field">
            <label>الصنف</label>
            <select class="item-select">
                ${options}
            </select>
            <input
                type="text"
                class="item-name-input"
                value="${escapeAttribute(selectedName)}"
                placeholder="اسم الصنف"
                style="${selectedName && !item?.item_id ? "" : "display:none;"}"
            >
        </div>

        <div class="item-field">
            <label>الكمية</label>
            <input
                type="number"
                class="item-quantity"
                min="1"
                step="1"
                value="${Number(item?.quantity || 1)}"
            >
        </div>

        <div class="item-field">
            <label>سعر الوحدة</label>
            <input
                type="number"
                class="item-unit-price"
                min="0"
                step="0.01"
                value="${item?.unit_price != null ? Number(item.unit_price) : ""}"
            >
        </div>

        <div class="item-field">
            <label>الإجمالي</label>
            <input
                type="number"
                class="item-total"
                value="${Number(item?.total_price || 0)}"
                readonly
            >
        </div>

        <button
            type="button"
            class="remove-item-btn"
            aria-label="حذف الصنف"
        >
            ×
        </button>
    `;

    container.appendChild(row);

    const select = row.querySelector(".item-select");
    const nameInput = row.querySelector(".item-name-input");

    if (select) {
        select.addEventListener("change", () => {
            if (!nameInput) return;

            const selected = itemsCatalog.find(
                catalogItem => String(catalogItem.id) === String(select.value)
            );

            if (selected) {
                nameInput.style.display = "none";
                nameInput.value = selected.name || "";
            } else {
                nameInput.style.display = "";
                nameInput.value = "";
            }
        });
    }

    updateItemRowTotal(row);
}

function updateItemRowTotal(row) {
    if (!row) return;

    const quantityInput = row.querySelector(".item-quantity");
    const priceInput = row.querySelector(".item-unit-price");
    const totalInput = row.querySelector(".item-total");

    const quantity = Math.max(
        0,
        Number(quantityInput?.value || 0)
    );

    const price = Math.max(
        0,
        Number(priceInput?.value || 0)
    );

    const total = quantity * price;

    if (totalInput) {
        totalInput.value = total.toFixed(2);
    }
}

function collectItems() {
    const container = document.getElementById("itemsContainer");

    if (!container) return [];

    const rows = container.querySelectorAll(".booking-item-row");
    const items = [];

    rows.forEach(row => {
        const select = row.querySelector(".item-select");
        const nameInput = row.querySelector(".item-name-input");
        const quantityInput = row.querySelector(".item-quantity");
        const priceInput = row.querySelector(".item-unit-price");

        const selectedCatalogItem = itemsCatalog.find(
            item => String(item.id) === String(select?.value)
        );

        const itemName =
            selectedCatalogItem?.name ||
            nameInput?.value?.trim() ||
            "";

        const quantity = Number(quantityInput?.value || 0);
        const unitPrice = Number(priceInput?.value || 0);
        const totalPrice = quantity * unitPrice;

        if (!itemName || quantity <= 0) return;

        items.push({
            item_name: itemName,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice
        });
    });

    return items;
}

function calculateTotals() {
    const items = collectItems();

    const itemsTotal = items.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
    );

    const deposit = Number(
        document.getElementById("plateDeposit")?.value || 0
    );

    const initialPayment = Number(
        document.getElementById("initialPayment")?.value || 0
    );

    const grandTotal = itemsTotal;
    const remaining = Math.max(
        0,
        grandTotal - initialPayment
    );

    setText("itemsTotal", formatCurrency(itemsTotal));
    setText("grandTotal", formatCurrency(grandTotal));
    setText("remainingAmount", formatCurrency(remaining));

    const plateDisplay = document.getElementById("bookingPlateDisplay");

    if (plateDisplay) {
        plateDisplay.textContent =
            deposit > 0 ? formatCurrency(deposit) : "لا يوجد";
    }

    updateRemainingPreview();

    return {
        itemsTotal,
        grandTotal,
        deposit,
        initialPayment,
        remaining
    };
}

function updateRemainingPreview() {
    const grandTotal = calculateItemsTotalOnly();

    const initialPayment = Number(
        document.getElementById("initialPayment")?.value || 0
    );

    const remaining = Math.max(
        0,
        grandTotal - initialPayment
    );

    setText(
        "remainingAmount",
        formatCurrency(remaining)
    );
}

function calculateItemsTotalOnly() {
    return collectItems().reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
    );
}

async function saveBooking() {
    if (editingBookingId) {
        await updateExistingBooking();
    } else {
        await saveNewBooking();
    }
}

async function saveNewBooking() {
    try {
        const customerData = await resolveCustomer();

        if (!customerData) return;

        const payload = collectBookingPayload(customerData);

        validateBookingPayload(payload);

        const response = await window.API.createBooking(payload);

        if (response) {
            showSuccess("تم حفظ الحجز بنجاح");
            setTimeout(() => {
                window.location.href = "bookings.html";
            }, 500);
        }
    } catch (error) {
        console.error(error);
        showError(error?.message || "تعذر حفظ الحجز");
    }
}

async function updateExistingBooking() {
    try {
        const customerData = await resolveCustomer();

        if (!customerData) return;

        const payload = collectBookingPayload(customerData);

        validateBookingPayload(payload);

        const response = await window.API.updateBooking(
            editingBookingId,
            payload
        );

        if (response) {
            showSuccess("تم تحديث الحجز بنجاح");

            setTimeout(() => {
                window.location.href = "bookings.html";
            }, 500);
        }
    } catch (error) {
        console.error(error);
        showError(error?.message || "تعذر تحديث الحجز");
    }
}

async function resolveCustomer() {
    const selectedExisting = selectedCustomer;

    if (selectedExisting?.id) {
        return {
            customer_id: selectedExisting.id
        };
    }

    const nameInput = document.getElementById("customerName");
    const phoneInput = document.getElementById("customerPhone");
    const notesInput = document.getElementById("customerNotes");

    const name = nameInput?.value?.trim() || "";
    const phone = phoneInput?.value?.trim() || "";
    const notes = notesInput?.value?.trim() || "";

    if (!name) {
        throw new Error("اسم العميل مطلوب");
    }

    const existingCustomers = window.__bookingCustomers || [];

    const existing = existingCustomers.find(customer => {
        if (!phone) return false;

        return String(customer.phone || "").trim() === phone;
    });

    if (existing) {
        selectedCustomer = existing;

        return {
            customer_id: existing.id
        };
    }

    const response = await window.API.createCustomer({
        name,
        phone,
        notes
    });

    const customer = response?.data ?? response;

    if (!customer?.id) {
        throw new Error("تعذر إنشاء العميل");
    }

    selectedCustomer = customer;

    window.__bookingCustomers = [
        ...existingCustomers,
        customer
    ];

    return {
        customer_id: customer.id
    };
}

function collectBookingPayload(customerData) {
    const date = document.getElementById("invoiceDate")?.value || "";
    const eventDate = document.getElementById("eventDate")?.value || "";
    const deliveryTime = document.getElementById("deliveryTime")?.value || "";
    const deliveryPeriod = document.getElementById("deliveryPeriod")?.value || "";
    const deliveryAddress = document.getElementById("deliveryAddress")?.value?.trim() || "";
    const mark = document.getElementById("mark")?.value?.trim() || "";
    const status = document.getElementById("status")?.value || "new";
    const notes = document.getElementById("bookingNotes")?.value?.trim() || "";

    const plateDeposit = Number(
        document.getElementById("plateDeposit")?.value || 0
    );

    const plateReturnedInput =
        document.getElementById("plateReturned");

    const plateReturnedValue =
        plateReturnedInput?.value === ""
            ? null
            : Number(plateReturnedInput.value);

    const items = collectItems();

    const totalAmount = items.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
    );

    const initialPayment = Number(
        document.getElementById("initialPayment")?.value || 0
    );

    const paymentMethodInput = document.querySelector(
        'input[name="payment_method_id"]:checked'
    );

    const paymentMethodId = paymentMethodInput
        ? Number(paymentMethodInput.value)
        : null;

    const paymentNotes =
        document.getElementById("paymentNotes")?.value?.trim() || "";

    const payload = {
        ...customerData,
        invoice_date: date || null,
        event_date: eventDate || null,
        delivery_time: deliveryTime || null,
        delivery_period: deliveryPeriod || null,
        delivery_address: deliveryAddress || null,
        mark: mark || null,
        total_amount: totalAmount,
        plate_deposit: plateDeposit > 0 ? plateDeposit : null,
        plate_deposit_returned:
            plateReturnedValue != null
                ? plateReturnedValue
                : null,
        status,
        notes: notes || null,
        items
    };

    if (!editingBookingId && initialPayment > 0) {
        payload.initial_payment = initialPayment;
        payload.payment_method_id = paymentMethodId;
        payload.payment_date =
            document.getElementById("invoiceDate")?.value || null;
        payload.payment_notes = paymentNotes || null;
    }

    return payload;
}

function validateBookingPayload(payload) {
    if (!payload.customer_id) {
        throw new Error("يجب اختيار العميل");
    }

    if (!payload.event_date) {
        throw new Error("تاريخ المناسبة مطلوب");
    }

    if (!payload.items.length) {
        throw new Error("أضف صنفًا واحدًا على الأقل");
    }

    if (
        payload.plate_deposit_returned !== null &&
        payload.plate_deposit_returned >
        Number(payload.plate_deposit || 0)
    ) {
        throw new Error(
            "قيمة المبلغ المرتجع لا يمكن أن تتجاوز عربون الصحون"
        );
    }

    const initialPayment = Number(
        document.getElementById("initialPayment")?.value || 0
    );

    if (
        !editingBookingId &&
        initialPayment > Number(payload.total_amount || 0)
    ) {
        throw new Error(
            "الدفعة الأولية لا يمكن أن تتجاوز إجمالي الفاتورة"
        );
    }
}

async function loadBookingForEdit(id) {
    try {
        const response = await window.API.getBooking(id);
        const booking = response?.data ?? response;

        if (!booking) {
            throw new Error("الحجز غير موجود");
        }

        fillBookingForm(booking);

        const saveBtn = document.getElementById("saveBookingBtn");

        if (saveBtn) {
            saveBtn.textContent = "حفظ التعديلات";
        }

        setText(
            "pageTitle",
            "تعديل الحجز"
        );

        setText(
            "pageSubtitle",
            `تعديل الحجز رقم ${booking.id}`
        );
    } catch (error) {
        console.error(error);
        showError(error?.message || "تعذر تحميل بيانات الحجز");
    }
}

function fillBookingForm(booking) {
    setInputValue("invoiceDate", normalizeDate(booking.invoice_date));
    setInputValue("eventDate", normalizeDate(booking.event_date));
    setInputValue("deliveryTime", normalizeTime(booking.delivery_time));
    setInputValue("deliveryPeriod", booking.delivery_period || "");
    setInputValue("deliveryAddress", booking.delivery_address || "");
    setInputValue("mark", booking.mark || "");
    setInputValue("status", booking.status || "new");
    setInputValue("bookingNotes", booking.notes || "");

    setInputValue(
        "plateDeposit",
        booking.plate_deposit ?? ""
    );

    setInputValue(
        "plateReturned",
        booking.plate_deposit_returned ?? ""
    );

    const customer =
        booking.customer ||
        findCustomerById(booking.customer_id);

    if (customer) {
        selectCustomer(customer);
    }

    const container = document.getElementById("itemsContainer");

    if (container) {
        container.innerHTML = "";

        const bookingItems = Array.isArray(booking.items)
            ? booking.items
            : Array.isArray(booking.booking_items)
                ? booking.booking_items
                : [];

        if (bookingItems.length) {
            bookingItems.forEach(item => {
                const catalogItem = itemsCatalog.find(
                    catalog =>
                        String(catalog.id) === String(item.item_id)
                );

                addItemRow({
                    ...item,
                    item_id: item.item_id || catalogItem?.id || null,
                    item_name:
                        item.item_name ||
                        item.name ||
                        catalogItem?.name ||
                        ""
                });
            });
        } else {
            addItemRow();
        }
    }

    calculateTotals();
}

function findCustomerById(id) {
    const customers = window.__bookingCustomers || [];

    return customers.find(
        customer => String(customer.id) === String(id)
    );
}

function setDefaultDates() {
    const today = new Date();
    const dateString = formatDateForInput(today);

    const invoiceDate = document.getElementById("invoiceDate");

    if (invoiceDate && !invoiceDate.value) {
        invoiceDate.value = dateString;
    }
}

function normalizeDate(value) {
    if (!value) return "";

    return String(value).substring(0, 10);
}

function normalizeTime(value) {
    if (!value) return "";

    return String(value).substring(0, 5);
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function extractArray(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.items)) {
        return response.items;
    }

    if (Array.isArray(response?.data?.data)) {
        return response.data.data;
    }

    return [];
}

function getInitials(name) {
    const value = String(name || "").trim();

    if (!value) return "؟";

    const parts = value.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].substring(0, 2);
    }

    return (
        parts[0].substring(0, 1) +
        parts[1].substring(0, 1)
    );
}

function formatCurrency(value) {
    const amount = Number(value || 0);

    if (
        window.API &&
        typeof window.API.formatCurrency === "function"
    ) {
        return window.API.formatCurrency(amount);
    }

    return new Intl.NumberFormat("ar-SA", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function setInputValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function showSuccess(message) {
    if (
        window.Utils &&
        typeof window.Utils.showToast === "function"
    ) {
        window.Utils.showToast(message, "success");
        return;
    }

    if (
        typeof window.showToast === "function"
    ) {
        window.showToast(message, "success");
        return;
    }

    alert(message);
}

function showError(message) {
    if (
        window.Utils &&
        typeof window.Utils.showToast === "function"
    ) {
        window.Utils.showToast(message, "error");
        return;
    }

    if (
        typeof window.showToast === "function"
    ) {
        window.showToast(message, "error");
        return;
    }

    alert(message);
}

window.BookingForm = {
    loadCustomers,
    loadItems,
    loadPaymentMethods,
    addItemRow,
    calculateTotals,
    collectItems,
    saveBooking
};