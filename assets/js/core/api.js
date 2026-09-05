"use strict";

const API = (() => {
  const BASE_URL = "http://127.0.0.1:8000/api";
  const TOKEN_KEY = "banquet_kitchen_token";

  class ApiError extends Error {
    constructor(message, status = 0, data = null, errors = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
      this.errors = errors;
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token, remember = true) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);

    if (!token) return;

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function isAuthenticated() {
    return Boolean(getToken());
  }

  function buildUrl(endpoint, query = {}) {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    const url = new URL(`${BASE_URL}${cleanEndpoint}`);

    Object.entries(query || {}).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(`${key}[]`, item));
        return;
      }

      url.searchParams.append(key, value);
    });

    return url.toString();
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();

    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text || null;
    }
  }

  function getErrorMessage(data, status) {
    if (!data) {
      return `حدث خطأ في الطلب (${status}).`;
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.message) {
      return data.message;
    }

    if (data.error) {
      return data.error;
    }

    if (data.errors && typeof data.errors === "object") {
      const messages = [];

      Object.values(data.errors).forEach((value) => {
        if (Array.isArray(value)) {
          messages.push(...value);
        } else if (value) {
          messages.push(String(value));
        }
      });

      if (messages.length) {
        return messages.join("\n");
      }
    }

    return `حدث خطأ في الطلب (${status}).`;
  }

  async function request(endpoint, options = {}) {
    const {
      method = "GET",
      query = {},
      body = undefined,
      headers = {},
      signal = undefined,
    } = options;

    const url = buildUrl(endpoint, query);
    const token = getToken();

    const requestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    let requestBody = body;

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    if (
      body !== undefined &&
      body !== null &&
      !(body instanceof FormData) &&
      typeof body !== "string"
    ) {
      requestHeaders["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }

    if (body instanceof FormData) {
      delete requestHeaders["Content-Type"];
    }

    let response;

    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal,
      });
    } catch (error) {
      throw new ApiError(
        "تعذر الاتصال بالخادم. تأكد من تشغيل Laravel API.",
        0,
        null,
        null,
      );
    }

    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401) {
        clearToken();
      }

      throw new ApiError(
        getErrorMessage(data, response.status),
        response.status,
        data,
        data?.errors || null,
      );
    }

    if (data && data.success === false) {
      throw new ApiError(
        getErrorMessage(data, response.status),
        response.status,
        data,
        data?.errors || null,
      );
    }

    return data;
  }

  function data(response) {
    return response?.data ?? null;
  }

  function collection(response) {
    const result = data(response);
    return Array.isArray(result) ? result : [];
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function prepareBookingPayload(payload = {}) {
    const result = { ...payload };

    if (Array.isArray(result.items)) {
      result.items = result.items.map((item) => {
        const quantity = number(item.quantity);
        const unitPrice = number(item.unit_price);

        return {
          ...item,
          quantity,
          unit_price: unitPrice,
          total_price: Number((quantity * unitPrice).toFixed(2)),
        };
      });

      result.total_amount = Number(
        result.items
          .reduce((sum, item) => sum + number(item.total_price), 0)
          .toFixed(2),
      );
    }

    return result;
  }

  const customers = {
    list(filters = {}) {
      return request("/customers", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/customers/${id}`).then(data);
    },

    create(payload) {
      return request("/customers", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    update(id, payload) {
      return request(`/customers/${id}`, {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/customers/${id}`, {
        method: "DELETE",
      }).then(data);
    },

    account(id) {
      return request(`/customers/${id}/account`).then(data);
    },

    statement(id) {
      return request(`/customers/${id}/statement`).then(data);
    },

    payments(filters = {}) {
      return request("/customer-payments", {
        query: filters,
      }).then(collection);
    },
  };

  const suppliers = {
    list(filters = {}) {
      return request("/suppliers", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/suppliers/${id}`).then(data);
    },

    create(payload) {
      return request("/suppliers", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    update(id, payload) {
      return request(`/suppliers/${id}`, {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/suppliers/${id}`, {
        method: "DELETE",
      }).then(data);
    },

    account(id) {
      return request(`/suppliers/${id}/account`).then(data);
    },

    statement(id) {
      return request(`/suppliers/${id}/statement`).then(data);
    },

    payments(filters = {}) {
      return request("/supplier-payments", {
        query: filters,
      }).then(collection);
    },

    invoices(filters = {}) {
      return request("/supplier-invoices", {
        query: filters,
      }).then(collection);
    },
  };

  const items = {
    list(filters = {}) {
      return request("/items", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/items/${id}`).then(data);
    },

    create(payload) {
      return request("/items", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    update(id, payload) {
      return request(`/items/${id}`, {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/items/${id}`, {
        method: "DELETE",
      }).then(data);
    },
  };

  const bookings = {
    list(filters = {}) {
      return request("/bookings", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/bookings/${id}`).then(data);
    },

    create(payload) {
      return request("/bookings", {
        method: "POST",
        body: prepareBookingPayload(payload),
      }).then(data);
    },

    update(id, payload) {
      return request(`/bookings/${id}`, {
        method: "PUT",
        body: prepareBookingPayload(payload),
      }).then(data);
    },

    delete(id) {
      return request(`/bookings/${id}`, {
        method: "DELETE",
      }).then(data);
    },

    byDate(date) {
      return request("/bookings-by-date", {
        query: { date },
      }).then(collection);
    },

    upcoming(days = 7) {
      return request("/upcoming-bookings", {
        query: { days },
      }).then(collection);
    },
  };

  const customerPayments = {
    list(filters = {}) {
      return request("/customer-payments", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/customer-payments/${id}`).then(data);
    },

    create(payload) {
      return request("/customer-payments", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/customer-payments/${id}`, {
        method: "DELETE",
      }).then(data);
    },
  };

  const supplierPayments = {
    list(filters = {}) {
      return request("/supplier-payments", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/supplier-payments/${id}`).then(data);
    },

    create(payload) {
      return request("/supplier-payments", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/supplier-payments/${id}`, {
        method: "DELETE",
      }).then(data);
    },
  };

  const supplierInvoices = {
    list(filters = {}) {
      return request("/supplier-invoices", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/supplier-invoices/${id}`).then(data);
    },

    create(payload) {
      return request("/supplier-invoices", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    update(id, payload) {
      return request(`/supplier-invoices/${id}`, {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/supplier-invoices/${id}`, {
        method: "DELETE",
      }).then(data);
    },
  };

  const paymentMethods = {
    list(filters = {}) {
      return request("/payment-methods", {
        query: filters,
      }).then(collection);
    },

    get(id) {
      return request(`/payment-methods/${id}`).then(data);
    },

    create(payload) {
      return request("/payment-methods", {
        method: "POST",
        body: payload,
      }).then(data);
    },

    update(id, payload) {
      return request(`/payment-methods/${id}`, {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    delete(id) {
      return request(`/payment-methods/${id}`, {
        method: "DELETE",
      }).then(data);
    },
  };

  const restaurant = {
    get() {
      return request("/restaurant").then(data);
    },

    update(payload) {
      return request("/restaurant", {
        method: "PUT",
        body: payload,
      }).then(data);
    },

    uploadLogo(file, fields = {}) {
      const formData = new FormData();

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      formData.append("logo", file);

      return request("/restaurant", {
        method: "POST",
        body: formData,
      }).then(data);
    },

    deleteLogo() {
      return request("/restaurant/logo", {
        method: "DELETE",
      }).then(data);
    },
  };

  const accounts = {
    customers() {
      return request("/customer-accounts").then(collection);
    },

    customer(id) {
      return request(`/customers/${id}/account`).then(data);
    },

    customerStatement(id) {
      return request(`/customers/${id}/statement`).then(data);
    },

    suppliers() {
      return request("/supplier-accounts").then(collection);
    },

    supplier(id) {
      return request(`/suppliers/${id}/account`).then(data);
    },

    supplierStatement(id) {
      return request(`/suppliers/${id}/statement`).then(data);
    },
  };

  const reports = {
    dailySummary(date = null) {
      return request("/reports/daily-summary", {
        query: date ? { date } : {},
      }).then(data);
    },

    bookingsByDate(date) {
      return request("/reports/bookings-by-date", {
        query: { date },
      }).then(data);
    },

    upcomingBookings(days = 7) {
      return request("/reports/upcoming-bookings", {
        query: { days },
      }).then(data);
    },

    customerAccounts() {
      return request("/reports/customer-accounts").then(data);
    },

    supplierAccounts() {
      return request("/reports/supplier-accounts").then(data);
    },

    financialSummary(fromDate = null, toDate = null) {
      return request("/reports/financial-summary", {
        query: {
          from_date: fromDate,
          to_date: toDate,
        },
      }).then(data);
    },
  };

  const api = {
    BASE_URL,

    ApiError,

    request,

    getToken,
    setToken,
    clearToken,
    isAuthenticated,
    login,
    getUser,
    logout,
    customers,
    suppliers,
    items,
    bookings,
    customerPayments,
    supplierPayments,
    supplierInvoices,
    paymentMethods,
    restaurant,
    accounts,
    reports,

    getCustomers: customers.list,
    getCustomer: customers.get,
    createCustomer: customers.create,
    updateCustomer: customers.update,
    deleteCustomer: customers.delete,
    getCustomerAccount: customers.account,
    getCustomerStatement: customers.statement,
    getCustomerPayments: customers.payments,

    getSuppliers: suppliers.list,
    getSupplier: suppliers.get,
    createSupplier: suppliers.create,
    updateSupplier: suppliers.update,
    deleteSupplier: suppliers.delete,
    getSupplierAccount: suppliers.account,
    getSupplierStatement: suppliers.statement,
    getSupplierPayments: suppliers.payments,
    getSupplierInvoices: suppliers.invoices,

    getItems: items.list,
    getItem: items.get,
    createItem: items.create,
    updateItem: items.update,
    deleteItem: items.delete,

    getBookings: bookings.list,
    getBooking: bookings.get,
    createBooking: bookings.create,
    updateBooking: bookings.update,
    deleteBooking: bookings.delete,
    getBookingsByDate: bookings.byDate,
    getUpcomingBookings: bookings.upcoming,

    getCustomerPayment: customerPayments.get,
    createCustomerPayment: customerPayments.create,
    deleteCustomerPayment: customerPayments.delete,

    getSupplierPayment: supplierPayments.get,
    createSupplierPayment: supplierPayments.create,
    deleteSupplierPayment: supplierPayments.delete,

    getSupplierInvoice: supplierInvoices.get,
    createSupplierInvoice: supplierInvoices.create,
    updateSupplierInvoice: supplierInvoices.update,
    deleteSupplierInvoice: supplierInvoices.delete,

    getPaymentMethods: paymentMethods.list,
    getPaymentMethod: paymentMethods.get,
    createPaymentMethod: paymentMethods.create,
    updatePaymentMethod: paymentMethods.update,
    deletePaymentMethod: paymentMethods.delete,

    getRestaurant: restaurant.get,
    updateRestaurant: restaurant.update,
    uploadRestaurantLogo: restaurant.uploadLogo,
    deleteRestaurantLogo: restaurant.deleteLogo,

    getCustomerAccounts: accounts.customers,
    getCustomerAccount: accounts.customer,
    getCustomerStatement: accounts.customerStatement,
    getSupplierAccounts: accounts.suppliers,
    getSupplierAccount: accounts.supplier,
    getSupplierStatement: accounts.supplier,

    getDailySummary: reports.dailySummary,
    getReportBookingsByDate: reports.bookingsByDate,
    getReportUpcomingBookings: reports.upcomingBookings,
    getCustomerAccountsReport: reports.customerAccounts,
    getSupplierAccountsReport: reports.supplierAccounts,
    getFinancialSummary: reports.financialSummary,
  };

  window.API = api;
  async function login(email, password, remember = true) {
    const response = await request("/login", {
      method: "POST",
      body: {
        email,
        password,
        remember,
      },
    });

    const result = response?.data || {};

    if (result.token) {
      setToken(result.token, remember);
    }

    return response;
  }

  async function getUser() {
    return request("/me").then(data);
  }

  async function logout() {
    try {
      await request("/logout", {
        method: "POST",
      });
    } finally {
      clearToken();
      localStorage.removeItem("banquet_kitchen_user");
      sessionStorage.removeItem("banquet_kitchen_user");
    }
  }
  return api;
})();