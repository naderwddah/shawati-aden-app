/* =========================================================
 * Banquet Kitchen - Booking Form
 * =========================================================
 * Supports:
 * 1. Booking for an existing customer
 * 2. Creating a new customer and then creating the booking
 * 3. Initial payment linked to the created booking/customer
 * 4. Booking items from the items catalog
 * 5. Creating and updating bookings
 *
 * UI: works with the mobile-first booking-form.html layout
 * ========================================================= */

(function () {
  "use strict";

  /* =========================================================
   * State
   * ========================================================= */

  const state = {
    mode: "existing",

    customers: [],
    items: [],
    paymentMethods: [],

    selectedCustomer: null,

    bookingId: null,
    editing: false,

    bookingItems: [],

    saving: false,

    // Preserved when editing because the fields are hidden
    // in the simplified UI.
    editingBookingStatus: null,
    editingPlateReturned: null,

    customerSearchTimer: null
  };


  /* =========================================================
   * DOM helpers
   * ========================================================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));


  /* =========================================================
   * General helpers
   * ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeNumber(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return number;
  }

  function roundMoney(value) {
    return Math.round((normalizeNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(value) {
    const amount = normalizeNumber(value);
    try {
      return new Intl.NumberFormat("ar-SA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount) + " ر.س";
    } catch (error) {
      return amount.toFixed(2) + " ر.س";
    }
  }

  function todayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getApiData(response) {
    if (response && typeof response === "object" && "data" in response) {
      return response.data;
    }
    return response;
  }

  function getCollection(response) {
    const data = getApiData(response);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function getCustomerId(customer) {
    if (!customer) return null;
    return customer.id ?? customer.customer_id ?? null;
  }

  function getItemId(item) {
    if (!item) return null;
    return item.id ?? item.item_id ?? null;
  }

  function getItemName(item) {
    if (!item) return "";
    return item.name ?? item.item_name ?? item.title ?? "";
  }

  function getItemPrice(item) {
    if (!item) return 0;
    return normalizeNumber(
      item.default_price ?? item.price ?? item.unit_price ?? 0
    );
  }

  function getPaymentMethodId(method) {
    if (!method) return null;
    return method.id ?? method.payment_method_id ?? null;
  }

  function getPaymentMethodName(method) {
    if (!method) return "";
    return method.name ?? method.title ?? method.method_name ?? "";
  }


  /* =========================================================
   * Alert helpers
   * ========================================================= */

  function showAlert(message, type = "error") {
    const alert = $("#formAlert");
    if (!alert) return;

    if (!message) {
      alert.textContent = "";
      alert.style.background = "";
      alert.style.color = "";
      alert.style.borderColor = "";
      return;
    }

    alert.textContent = message;

    if (type === "success") {
      alert.style.background = "var(--success-soft, #e6f4ea)";
      alert.style.color = "var(--success, #155724)";
      alert.style.borderColor = "var(--success, #155724)";
    } else {
      alert.style.background = "";
      alert.style.color = "";
      alert.style.borderColor = "";
    }

    alert.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function hideAlert() {
    showAlert("");
  }

  function clearFieldErrors() {
    $$(".field-error").forEach((element) => element.remove());
    $$(".is-invalid").forEach((element) =>
      element.classList.remove("is-invalid")
    );
  }

  function markFieldInvalid(input, message) {
    if (!input) return;

    input.classList.add("is-invalid");

    const field =
      input.closest(".form-group") ||
      input.closest(".financial-row") ||
      input.parentElement;

    if (!field) return;

    let error = $(".field-error", field);
    if (!error) {
      error = document.createElement("div");
      error.className = "field-error";
      error.style.cssText =
        "color:var(--danger);font-size:12px;margin-top:4px;font-weight:700;";
      field.appendChild(error);
    }
    error.textContent = message;
  }


  /* =========================================================
   * Customer mode (existing / new)
   * ========================================================= */

  function setCustomerMode(mode) {
    state.mode = mode === "new" ? "new" : "existing";

    const existingSection = $("#existingCustomerSection");
    const newSection = $("#newCustomerSection");
    const existingButton = $("#existingCustomerBtn");
    const newButton = $("#newCustomerBtn");

    if (existingSection) {
      existingSection.style.display =
        state.mode === "existing" ? "block" : "none";
    }

    if (newSection) {
      newSection.style.display =
        state.mode === "new" ? "block" : "none";
    }

    if (existingButton) {
      existingButton.classList.toggle(
        "active",
        state.mode === "existing"
      );
      existingButton.setAttribute(
        "aria-selected",
        state.mode === "existing" ? "true" : "false"
      );
    }

    if (newButton) {
      newButton.classList.toggle("active", state.mode === "new");
      newButton.setAttribute(
        "aria-selected",
        state.mode === "new" ? "true" : "false"
      );
    }

    if (state.mode === "existing") {
      clearNewCustomerFields();
    } else {
      clearExistingCustomerSelection();
    }

    hideAlert();
    clearFieldErrors();
  }

  function clearNewCustomerFields() {
    const name = $("#customerName");
    const phone = $("#customerPhone");
    const notes = $("#customerNotes");

    if (name) name.value = "";
    if (phone) phone.value = "";
    if (notes) notes.value = "";
  }

  function clearExistingCustomerSelection() {
    state.selectedCustomer = null;

    const search = $("#customerSearch");
    const selectedCustomer = $("#selectedCustomer");
    const selectedName = $("#selectedCustomerName");
    const selectedPhone = $("#selectedCustomerPhone");
    const selectedAvatar = $("#selectedCustomerAvatar");
    const results = $("#customerResults");

    if (search) search.value = "";
    if (selectedCustomer) selectedCustomer.style.display = "none";
    if (selectedName) selectedName.textContent = "";
    if (selectedPhone) selectedPhone.textContent = "";
    if (selectedAvatar) selectedAvatar.textContent = "ع";
    if (results) {
      results.innerHTML = "";
      results.style.display = "none";
    }
  }


  /* =========================================================
   * Existing customer search
   * ========================================================= */

  function renderCustomerResults(customers) {
    const results = $("#customerResults");
    if (!results) return;

    if (!customers.length) {
      results.innerHTML = `
        <div class="customer-result-empty">
          لا توجد نتائج مطابقة.
        </div>`;
      results.style.display = "block";
      return;
    }

    results.innerHTML = customers
      .map((customer) => {
        const id = getCustomerId(customer);
        const name = customer.name ?? "بدون اسم";
        const phone = customer.phone ?? "";

        return `
          <button type="button"
                  class="customer-result"
                  data-customer-id="${escapeHtml(id)}">
            <span class="customer-result-name">
              ${escapeHtml(name)}
            </span>
            ${
              phone
                ? `<span class="customer-result-phone">${escapeHtml(phone)}</span>`
                : ""
            }
          </button>`;
      })
      .join("");

    results.style.display = "block";
  }

  function selectCustomer(customer) {
    if (!customer) return;

    state.selectedCustomer = customer;

    const search = $("#customerSearch");
    const results = $("#customerResults");
    const selectedCustomer = $("#selectedCustomer");
    const selectedName = $("#selectedCustomerName");
    const selectedPhone = $("#selectedCustomerPhone");
    const selectedAvatar = $("#selectedCustomerAvatar");

    const name = customer.name ?? "";
    const phone = customer.phone ?? "";

    if (search) search.value = "";
    if (results) {
      results.innerHTML = "";
      results.style.display = "none";
    }

    if (selectedCustomer) {
      selectedCustomer.style.display = "flex";
    }

    if (selectedName) selectedName.textContent = name || "بدون اسم";
    if (selectedPhone) selectedPhone.textContent = phone || "—";
    if (selectedAvatar) {
      selectedAvatar.textContent =
        String(name).trim().charAt(0) || "ع";
    }

    hideAlert();
  }

  function bindCustomerSearch() {
    const search = $("#customerSearch");
    const results = $("#customerResults");
    if (!search) return;

    search.addEventListener("input", () => {
      clearTimeout(state.customerSearchTimer);
      const query = search.value.trim().toLowerCase();

      if (!query) {
        if (results) {
          results.innerHTML = "";
          results.style.display = "none";
        }
        return;
      }

      state.customerSearchTimer = setTimeout(() => {
        const filtered = state.customers.filter((customer) => {
          const name = String(customer.name ?? "").toLowerCase();
          const phone = String(customer.phone ?? "").toLowerCase();
          return name.includes(query) || phone.includes(query);
        });
        renderCustomerResults(filtered);
      }, 150);
    });

    search.addEventListener("focus", () => {
      if (search.value.trim()) {
        search.dispatchEvent(new Event("input"));
      }
    });

    document.addEventListener("click", (event) => {
      if (!results) return;
      if (
        !results.contains(event.target) &&
        event.target !== search
      ) {
        results.style.display = "none";
      }
    });
  }

  function bindCustomerResultClicks() {
    const results = $("#customerResults");
    if (!results) return;

    results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-customer-id]");
      if (!button) return;

      const id = Number(button.dataset.customerId);
      const customer = state.customers.find(
        (item) => Number(getCustomerId(item)) === id
      );

      if (customer) selectCustomer(customer);
    });
  }

  function bindChangeCustomerButton() {
    const button = $("#changeCustomerBtn");
    if (!button) return;

    button.addEventListener("click", () => {
      state.selectedCustomer = null;

      const selectedCustomer = $("#selectedCustomer");
      if (selectedCustomer) selectedCustomer.style.display = "none";

      const search = $("#customerSearch");
      if (search) {
        search.value = "";
        search.focus();
      }
    });
  }


  /* =========================================================
   * Loading data
   * ========================================================= */

  async function loadCustomers() {
    try {
      const response = await API.getCustomers();
      state.customers = getCollection(response);
      return state.customers;
    } catch (error) {
      console.error("Failed to load customers:", error);
      state.customers = [];
      throw error;
    }
  }

  async function loadItems() {
    try {
      const response = await API.getItems();
      state.items = getCollection(response);
      return state.items;
    } catch (error) {
      console.error("Failed to load items:", error);
      state.items = [];
      throw error;
    }
  }

  async function loadPaymentMethods() {
    try {
      let response;

      if (
        API.paymentMethods &&
        typeof API.paymentMethods.list === "function"
      ) {
        response = await API.paymentMethods.list();
      } else if (typeof API.getPaymentMethods === "function") {
        response = await API.getPaymentMethods();
      } else {
        state.paymentMethods = [];
        renderPaymentMethods();
        return [];
      }

      state.paymentMethods = getCollection(response);
      renderPaymentMethods();
      return state.paymentMethods;
    } catch (error) {
      console.error("Failed to load payment methods:", error);
      state.paymentMethods = [];
      renderPaymentMethods();
      return [];
    }
  }

  function renderPaymentMethods() {
    const container = $("#paymentMethods");
    if (!container) return;

    if (!state.paymentMethods.length) {
      container.innerHTML = `
        <select class="form-select" disabled>
          <option>لا توجد طرق دفع</option>
        </select>`;
      return;
    }

    const options = state.paymentMethods
      .map((method, index) => {
        const id = getPaymentMethodId(method);
        const name = getPaymentMethodName(method);
        return `
          <option value="${escapeHtml(id)}" ${index === 0 ? "selected" : ""}>
            ${escapeHtml(name)}
          </option>`;
      })
      .join("");

    container.innerHTML = `
      <select id="paymentMethodSelect"
              name="payment_method_id"
              class="form-select">
        ${options}
      </select>`;
  }

  function getSelectedPaymentMethodId() {
    const select = $("#paymentMethodSelect");
    if (!select) return null;
    return select.value ? Number(select.value) : null;
  }


  /* =========================================================
   * Booking items
   * ========================================================= */

  function createEmptyBookingItem() {
    return {
      id: null,
      item_id: null,
      name: "",
      quantity: 1,
      unit_price: 0,
      total: 0
    };
  }

  function calculateBookingItemTotal(item) {
    return roundMoney(
      normalizeNumber(item.quantity, 0) *
        normalizeNumber(item.unit_price, 0)
    );
  }

  function calculateBookingTotal() {
    return roundMoney(
      state.bookingItems.reduce(
        (sum, item) => sum + calculateBookingItemTotal(item),
        0
      )
    );
  }

  function renderItems() {
    const container = $("#itemsContainer");
    if (!container) return;

    if (!state.bookingItems.length) {
      container.innerHTML = `
        <div style="padding:22px 12px;text-align:center;color:var(--text-muted);font-size:13px;">
          لم تتم إضافة أصناف بعد. اضغط على "إضافة صنف" للبدء.
        </div>`;
      updateFinancialDisplay();
      return;
    }

    container.innerHTML = state.bookingItems
      .map((item, index) => {
        const selectedItemId = item.item_id ?? "";

        const options = state.items
          .map((catalogItem) => {
            const id = getItemId(catalogItem);
            const name = getItemName(catalogItem);
            return `
              <option value="${escapeHtml(id)}"
                      ${String(id) === String(selectedItemId) ? "selected" : ""}>
                ${escapeHtml(name)}
              </option>`;
          })
          .join("");

        return `
          <div class="booking-item-row" data-item-index="${index}">
            <select class="item-select" data-action="item-select">
              <option value="">اختر الصنف</option>
              ${options}
            </select>
            <input type="number"
                   class="item-qty"
                   data-action="quantity"
                   min="0.01"
                   step="0.01"
                   value="${escapeHtml(item.quantity)}">
            <input type="number"
                   class="item-price"
                   data-action="unit-price"
                   min="0"
                   step="0.01"
                   value="${escapeHtml(item.unit_price)}">
            <button type="button"
                    class="remove-item-btn"
                    data-action="remove"
                    title="حذف الصنف">
              <i class="fas fa-trash"></i>
            </button>
          </div>`;
      })
      .join("");

    updateFinancialDisplay();
  }

  function addBookingItem(item = null) {
    if (item) {
      state.bookingItems.push({
        id: item.id ?? null,
        item_id: item.item_id ?? item.item?.id ?? null,
        name: item.name ?? item.item?.name ?? "",
        quantity: normalizeNumber(item.quantity, 1),
        unit_price: normalizeNumber(item.unit_price ?? item.price, 0),
        total: 0
      });
    } else {
      state.bookingItems.push(createEmptyBookingItem());
    }

    const last = state.bookingItems[state.bookingItems.length - 1];
    last.total = calculateBookingItemTotal(last);

    renderItems();
  }

  function removeBookingItem(index) {
    if (index < 0 || index >= state.bookingItems.length) return;
    state.bookingItems.splice(index, 1);
    renderItems();
  }

  function handleItemSelect(row, value) {
    const index = Number(row.dataset.itemIndex);
    const item = state.bookingItems[index];
    if (!item) return;

    if (!value) {
      item.item_id = null;
      item.name = "";
      item.unit_price = 0;

      const priceInput = row.querySelector('[data-action="unit-price"]');
      if (priceInput) priceInput.value = "0";

      updateFinancialDisplay();
      return;
    }

    const catalogItem = state.items.find(
      (candidate) =>
        String(getItemId(candidate)) === String(value)
    );
    if (!catalogItem) return;

    item.item_id = getItemId(catalogItem);
    item.name = getItemName(catalogItem);
    item.unit_price = getItemPrice(catalogItem);

    const priceInput = row.querySelector('[data-action="unit-price"]');
    if (priceInput) priceInput.value = item.unit_price;

    updateFinancialDisplay();
  }

  function bindItemsEvents() {
    const container = $("#itemsContainer");
    if (!container) return;

    container.addEventListener("change", (event) => {
      const target = event.target;
      const row = target.closest(".booking-item-row");
      if (!row) return;

      const index = Number(row.dataset.itemIndex);
      const item = state.bookingItems[index];
      if (!item) return;

      const action = target.dataset.action;

      if (action === "item-select") {
        handleItemSelect(row, target.value);
      } else if (action === "quantity") {
        item.quantity = normalizeNumber(target.value, 0);
        updateFinancialDisplay();
      } else if (action === "unit-price") {
        item.unit_price = normalizeNumber(target.value, 0);
        updateFinancialDisplay();
      }
    });

    container.addEventListener("input", (event) => {
      const target = event.target;
      const action = target.dataset.action;

      if (action !== "quantity" && action !== "unit-price") return;

      const row = target.closest(".booking-item-row");
      if (!row) return;

      const index = Number(row.dataset.itemIndex);
      const item = state.bookingItems[index];
      if (!item) return;

      if (action === "quantity") {
        item.quantity = normalizeNumber(target.value, 0);
      } else {
        item.unit_price = normalizeNumber(target.value, 0);
      }

      updateFinancialDisplay();
    });

    container.addEventListener("click", (event) => {
      const removeButton = event.target.closest('[data-action="remove"]');
      if (!removeButton) return;

      const row = removeButton.closest(".booking-item-row");
      if (!row) return;

      removeBookingItem(Number(row.dataset.itemIndex));
    });
  }


  /* =========================================================
   * Financial display
   * ========================================================= */

  function getInitialPaymentValue() {
    const input = $("#initialPayment");
    if (!input) return 0;
    return normalizeNumber(input.value, 0);
  }

  function getPlateDepositValue() {
    const input = $("#plateDeposit");
    if (!input) return 0;
    return normalizeNumber(input.value, 0);
  }

  function updateFinancialDisplay() {
    const itemsTotal = calculateBookingTotal();
    const deposit = getPlateDepositValue();
    const grandTotal = roundMoney(itemsTotal + deposit);
    const initialPayment = getInitialPaymentValue();
    const remaining = Math.max(0, roundMoney(grandTotal - initialPayment));

    const itemsTotalEl = $("#itemsTotal");
    if (itemsTotalEl) itemsTotalEl.textContent = formatCurrency(itemsTotal);

    const grandTotalEl = $("#grandTotal");
    if (grandTotalEl) grandTotalEl.textContent = formatCurrency(grandTotal);

    const mobileGrandTotalEl = $("#mobileGrandTotal");
    if (mobileGrandTotalEl) {
      mobileGrandTotalEl.textContent = formatCurrency(grandTotal);
    }

    const remainingEl = $("#remainingAmount");
    if (remainingEl) remainingEl.textContent = formatCurrency(remaining);
  }

  function bindFinancialEvents() {
    const depositInput = $("#plateDeposit");
    if (depositInput) {
      depositInput.addEventListener("input", updateFinancialDisplay);
      depositInput.addEventListener("change", updateFinancialDisplay);
    }

    const paymentInput = $("#initialPayment");
    if (paymentInput) {
      paymentInput.addEventListener("input", updateFinancialDisplay);
      paymentInput.addEventListener("change", updateFinancialDisplay);
    }
  }


  /* =========================================================
   * Customer creation
   * ========================================================= */

  function getNewCustomerData() {
    const name = $("#customerName")?.value.trim() ?? "";
    const phone = $("#customerPhone")?.value.trim() ?? "";
    const notes = $("#customerNotes")?.value.trim() ?? "";
    return { name, phone, notes };
  }

  async function createNewCustomer() {
    const data = getNewCustomerData();

    const existing = state.customers.find((customer) => {
      if (!data.phone) return false;
      return String(customer.phone ?? "").trim() === data.phone;
    });

    if (existing) {
      const useExisting = window.confirm(
        "يوجد عميل مسجل بنفس رقم الجوال.\n\n" +
        "هل تريد استخدام العميل الموجود بدل إنشاء عميل جديد؟"
      );

      if (useExisting) return existing;

      throw new Error("يوجد عميل مسجل مسبقًا بنفس رقم الجوال.");
    }

    if (typeof API.createCustomer !== "function") {
      throw new Error("واجهة إنشاء العملاء غير متاحة.");
    }

    const response = await API.createCustomer(data);
    const created = getApiData(response);
    const customer = created?.data ?? created?.customer ?? created;

    if (!customer || !getCustomerId(customer)) {
      throw new Error(
        "تم إنشاء العميل ولكن لم يتم استلام بياناته بشكل صحيح."
      );
    }

    state.customers.push(customer);
    return customer;
  }


  /* =========================================================
   * Booking payload
   * ========================================================= */

  function getFieldValue(id) {
    return $(`#${id}`)?.value.trim() ?? "";
  }

  function collectBookingPayload(customerId) {
    const totalAmount = calculateBookingTotal();

    // Invoice date is always set to today (no field in the UI).
    const invoiceDate = todayDate();
    const eventDate = getFieldValue("eventDate");
    const deliveryTime = getFieldValue("deliveryTime");
    const deliveryPeriod = getFieldValue("deliveryPeriod");
    const deliveryAddress = getFieldValue("deliveryAddress");
    const mark = getFieldValue("mark");
    const bookingNotes = getFieldValue("bookingNotes");
    const plateDeposit = getPlateDepositValue();

    const payload = {
      customer_id: Number(customerId),
      invoice_date: invoiceDate,
      event_date: eventDate,
      delivery_time: deliveryTime,
      delivery_period: deliveryPeriod,
      delivery_address: deliveryAddress,
      mark: mark || null,
      total_amount: totalAmount,
      plate_deposit: plateDeposit > 0 ? plateDeposit : null,
      notes: bookingNotes || null,
      items: state.bookingItems.map((item) => {
        const quantity = normalizeNumber(item.quantity, 0);
        const unitPrice = normalizeNumber(item.unit_price, 0);
        const totalPrice = roundMoney(quantity * unitPrice);

        const row = {
          item_name: String(item.name ?? "").trim(),
          quantity: quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        };

        if (item.item_id) {
          row.item_id = Number(item.item_id);
        }

        return row;
      })
    };

    if (!state.editing) {
      const initialPayment = getInitialPaymentValue();

      if (initialPayment > 0) {
        payload.initial_payment = initialPayment;
        payload.payment_method_id = getSelectedPaymentMethodId();
        payload.payment_date = invoiceDate;
        payload.payment_notes = null;
      }
    }

    if (state.editing) {
      if (
        state.editingBookingStatus !== null &&
        state.editingBookingStatus !== undefined
      ) {
        payload.status = state.editingBookingStatus;
      }

      if (
        state.editingPlateReturned !== null &&
        state.editingPlateReturned !== undefined
      ) {
        payload.plate_deposit_returned = state.editingPlateReturned;
      }
    }

    return payload;
  }


  /* =========================================================
   * Validation
   * ========================================================= */

  function validateCustomer() {
    if (state.mode === "existing") {
      if (
        !state.selectedCustomer ||
        !getCustomerId(state.selectedCustomer)
      ) {
        showAlert("يرجى اختيار العميل أولًا.");
        return false;
      }
      return true;
    }

    const name = $("#customerName");
    const phone = $("#customerPhone");

    const customerName = name?.value.trim() ?? "";
    const customerPhone = phone?.value.trim() ?? "";

    if (!customerName) {
      markFieldInvalid(name, "اسم العميل مطلوب.");
      showAlert("يرجى إدخال اسم العميل.");
      name?.focus();
      return false;
    }

    if (!customerPhone) {
      markFieldInvalid(phone, "رقم الجوال مطلوب.");
      showAlert("يرجى إدخال رقم جوال العميل.");
      phone?.focus();
      return false;
    }

    return true;
  }

  function validateBookingFields() {
    const requiredFields = [
      { id: "eventDate", message: "تاريخ المناسبة مطلوب." },
      { id: "deliveryTime", message: "وقت التوصيل مطلوب." },
      { id: "deliveryPeriod", message: "فترة التوصيل مطلوبة." },
      { id: "deliveryAddress", message: "عنوان التوصيل مطلوب." }
    ];

    for (const field of requiredFields) {
      const input = $(`#${field.id}`);
      const value = input?.value.trim() ?? "";
      if (!value) {
        markFieldInvalid(input, field.message);
        showAlert(field.message);
        input?.focus();
        return false;
      }
    }

    return true;
  }

  function validateItems() {
    if (!state.bookingItems.length) {
      showAlert("يجب إضافة صنف واحد على الأقل للحجز.");
      return false;
    }

    for (let index = 0; index < state.bookingItems.length; index++) {
      const item = state.bookingItems[index];
      const quantity = normalizeNumber(item.quantity, 0);
      const price = normalizeNumber(item.unit_price, 0);

      if (!item.item_id && !String(item.name ?? "").trim()) {
        showAlert(`يرجى اختيار الصنف في السطر ${index + 1}.`);
        return false;
      }

      if (quantity <= 0) {
        showAlert(
          `كمية الصنف في السطر ${index + 1} يجب أن تكون أكبر من صفر.`
        );
        return false;
      }

      if (price < 0) {
        showAlert(
          `سعر الصنف في السطر ${index + 1} لا يمكن أن يكون سالبًا.`
        );
        return false;
      }
    }

    return true;
  }

  function validatePayment() {
    if (state.editing) return true;

    const payment = getInitialPaymentValue();
    const total = calculateBookingTotal();

    if (payment < 0) {
      showAlert("الدفعة الأولى لا يمكن أن تكون سالبة.");
      return false;
    }

    if (payment > total) {
      showAlert("الدفعة الأولى لا يمكن أن تتجاوز إجمالي الحجز.");
      return false;
    }

    if (payment > 0) {
      const methodId = getSelectedPaymentMethodId();
      if (!methodId) {
        showAlert("يرجى اختيار طريقة الدفع للدفعة الأولى.");
        return false;
      }
    }

    return true;
  }

  function validateForm() {
    clearFieldErrors();
    hideAlert();

    if (!validateCustomer()) return false;
    if (!validateBookingFields()) return false;
    if (!validateItems()) return false;
    if (!validatePayment()) return false;

    return true;
  }


  /* =========================================================
   * Save
   * ========================================================= */

  async function resolveCustomerForBooking() {
    if (state.mode === "existing") return state.selectedCustomer;
    return createNewCustomer();
  }

  async function saveBooking() {
    if (state.saving) return;
    if (!validateForm()) return;

    state.saving = true;
    setSaveButtonLoading(true);
    hideAlert();

    try {
      const customer = await resolveCustomerForBooking();
      const customerId = getCustomerId(customer);

      if (!customerId) {
        throw new Error("تعذر تحديد العميل المرتبط بالحجز.");
      }

      const payload = collectBookingPayload(customerId);

      let response;

      if (state.editing && state.bookingId) {
        if (typeof API.updateBooking !== "function") {
          throw new Error("واجهة تحديث الحجوزات غير متاحة.");
        }
        response = await API.updateBooking(state.bookingId, payload);
      } else {
        if (typeof API.createBooking !== "function") {
          throw new Error("واجهة إنشاء الحجوزات غير متاحة.");
        }
        response = await API.createBooking(payload);
      }

      const data = getApiData(response);
      console.log("Booking saved successfully:", data);

      showAlert(
        state.editing
          ? "تم تحديث الحجز بنجاح."
          : "تم إنشاء الحجز بنجاح.",
        "success"
      );

      setTimeout(() => {
        window.location.href = "bookings.html";
      }, 700);
    } catch (error) {
      console.error("Failed to save booking:", error);
      showAlert(extractApiErrorMessage(error), "error");
    } finally {
      state.saving = false;
      setSaveButtonLoading(false);
    }
  }


  /* =========================================================
   * API errors
   * ========================================================= */

  function extractApiErrorMessage(error) {
    if (!error) return "حدث خطأ غير متوقع أثناء حفظ الحجز.";
    if (typeof error === "string") return error;

    const response = error.response ?? error;
    const data = response?.data ?? response;

    if (data?.message) return data.message;
    if (data?.error) return data.error;

    if (data?.errors) {
      const messages = [];
      Object.values(data.errors).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((message) => messages.push(message));
        } else if (value) {
          messages.push(String(value));
        }
      });
      if (messages.length) return messages.join("\n");
    }

    if (error.message) return error.message;
    return "تعذر حفظ الحجز. يرجى المحاولة مرة أخرى.";
  }


  /* =========================================================
   * Save buttons (desktop + mobile sticky bar)
   * ========================================================= */

  function setSaveButtonLoading(loading) {
    const buttons = [$("#saveBookingBtn"), $("#mobileSaveBtn")];

    buttons.forEach((button) => {
      if (!button) return;

      button.disabled = loading;

      if (loading) {
        if (!button.dataset.originalHtml) {
          button.dataset.originalHtml = button.innerHTML;
        }
        button.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> جارٍ الحفظ...';
      } else if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
      }
    });
  }


  /* =========================================================
   * Edit mode
   * ========================================================= */

  function getBookingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("booking_id");
  }

  async function loadBookingForEdit(id) {
    if (typeof API.getBooking !== "function") {
      throw new Error("واجهة جلب الحجز غير متاحة.");
    }

    const response = await API.getBooking(id);
    const data = getApiData(response);
    const booking = data?.data ?? data?.booking ?? data;

    if (!booking) throw new Error("لم يتم العثور على الحجز.");

    state.bookingId = booking.id ?? id;
    state.editing = true;
    state.editingBookingStatus = booking.status ?? null;
    state.editingPlateReturned = booking.plate_deposit_returned ?? null;

    populateBookingForm(booking);
  }

  function populateBookingForm(booking) {
    const customer =
      booking.customer ??
      state.customers.find(
        (item) =>
          Number(getCustomerId(item)) ===
          Number(booking.customer_id)
      );

    if (customer) {
      state.selectedCustomer = customer;
      setCustomerMode("existing");
      selectCustomer(customer);
    }

    setInputValue("eventDate", formatDateForInput(booking.event_date));
    setInputValue("deliveryTime", formatTimeForInput(booking.delivery_time));
    setInputValue("deliveryPeriod", booking.delivery_period);
    setInputValue("deliveryAddress", booking.delivery_address);
    setInputValue("mark", booking.mark);
    setInputValue("bookingNotes", booking.notes);
    setInputValue("plateDeposit", booking.plate_deposit);

    state.bookingItems = Array.isArray(booking.items)
      ? booking.items.map((item) => ({
          id: item.id ?? null,
          item_id: item.item_id ?? item.item?.id ?? null,
          name: item.name ?? item.item?.name ?? "",
          quantity: normalizeNumber(item.quantity, 1),
          unit_price: normalizeNumber(
            item.unit_price ?? item.price,
            0
          ),
          total: 0
        }))
      : [];

    state.bookingItems.forEach((item) => {
      item.total = calculateBookingItemTotal(item);
    });

    renderItems();
    updateFinancialDisplay();
    disablePaymentForEdit();
    updatePageForEditMode();
  }

  function setInputValue(id, value) {
    const input = $(`#${id}`);
    if (!input) return;
    input.value =
      value === null || value === undefined ? "" : String(value);
  }

  function formatDateForInput(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function formatTimeForInput(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }

  function disablePaymentForEdit() {
    const initialPayment = document.querySelector("#initialPayment");
    const paymentMethodSelect = document.querySelector("#paymentMethodSelect");

    if (initialPayment) initialPayment.disabled = true;
    if (paymentMethodSelect) paymentMethodSelect.disabled = true;

    // Dim the financial rows that relate to payment.
    const paymentRow = initialPayment?.closest(".financial-row");
    if (paymentRow) paymentRow.style.opacity = "0.55";

    const methodRow = paymentMethodSelect?.closest(".financial-row");
    if (methodRow) methodRow.style.opacity = "0.55";
  }

  function updatePageForEditMode() {
    const title = $("#pageTitle");
    const subtitle = document.querySelector(".page-subtitle");
    const saveButton = $("#saveBookingBtn");

    if (title) title.textContent = "تعديل الحجز";

    if (subtitle) {
      subtitle.textContent =
        "تعديل بيانات الحجز مع الحفاظ على الحالة الحالية.";
    }

    if (saveButton) {
      saveButton.innerHTML =
        '<i class="fas fa-save"></i> حفظ التعديلات';
    }
  }


  /* =========================================================
   * Form reset
   * ========================================================= */

  function resetBookingForm() {
    const form = $("#bookingForm");
    if (form) form.reset();

    state.selectedCustomer = null;
    state.bookingItems = [];
    state.bookingId = null;
    state.editing = false;
    state.editingBookingStatus = null;
    state.editingPlateReturned = null;

    setCustomerMode("existing");
    renderItems();
    updateFinancialDisplay();

    const selectedCustomer = $("#selectedCustomer");
    if (selectedCustomer) selectedCustomer.style.display = "none";

    hideAlert();
    clearFieldErrors();

    const initialPayment = document.querySelector("#initialPayment");
    const paymentMethodSelect = document.querySelector("#paymentMethodSelect");

    if (initialPayment) {
      initialPayment.disabled = false;
      const row = initialPayment.closest(".financial-row");
      if (row) row.style.opacity = "";
    }

    if (paymentMethodSelect) {
      paymentMethodSelect.disabled = false;
      const row = paymentMethodSelect.closest(".financial-row");
      if (row) row.style.opacity = "";
    }

    setDefaultDates();
  }


  /* =========================================================
   * Bindings
   * ========================================================= */

  function bindCustomerModeButtons() {
    const existingButton = $("#existingCustomerBtn");
    const newButton = $("#newCustomerBtn");

    if (existingButton) {
      existingButton.addEventListener("click", () =>
        setCustomerMode("existing")
      );
    }

    if (newButton) {
      newButton.addEventListener("click", () =>
        setCustomerMode("new")
      );
    }
  }

  function bindAddItemButton() {
    const button = $("#addItemBtn");
    if (!button) return;
    button.addEventListener("click", () => addBookingItem());
  }

  function bindFormSubmit() {
    const form = $("#bookingForm");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        saveBooking();
      });
      return;
    }

    const button = $("#saveBookingBtn");
    if (button) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        saveBooking();
      });
    }
  }

  function bindMobileSaveButton() {
    const button = $("#mobileSaveBtn");
    if (!button) return;

    // The button uses form="bookingForm" so it triggers submit,
    // but we add a guard in case it is clicked outside the form scope.
    button.addEventListener("click", (event) => {
      if (!button.form) {
        event.preventDefault();
        saveBooking();
      }
    });
  }

  function setDefaultDates() {
    if (state.editing) return;

    const eventDate = $("#eventDate");
    if (eventDate && !eventDate.value) {
      eventDate.value = todayDate();
    }
  }


  /* =========================================================
   * Initialize
   * ========================================================= */

  async function initialize() {
    try {
      hideAlert();

      await Promise.all([
        loadCustomers(),
        loadItems(),
        loadPaymentMethods()
      ]);

      bindCustomerModeButtons();
      bindCustomerSearch();
      bindCustomerResultClicks();
      bindChangeCustomerButton();

      bindAddItemButton();
      bindItemsEvents();
      bindFinancialEvents();

      bindFormSubmit();
      bindMobileSaveButton();

      renderItems();
      setDefaultDates();
      updateFinancialDisplay();

      const bookingId = getBookingIdFromUrl();
      if (bookingId) {
        await loadBookingForEdit(bookingId);
      }
    } catch (error) {
      console.error("Booking form initialization failed:", error);
      showAlert(extractApiErrorMessage(error));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();