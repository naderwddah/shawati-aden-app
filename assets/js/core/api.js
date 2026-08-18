// ============================================================
// assets/js/core/api.js
// طبقة وهمية للبيانات (Mock API) – تحاكي قاعدة البيانات
// ============================================================

(function () {
  "use strict";

  // ---------- دوال مساعدة (خاصة) ----------
  function formatCurrency(amount) {
    return Number(amount).toLocaleString("ar-SA") + " ر.س";
  }

  // ---------- البيانات الوهمية ----------
  let customers = [
    {
      id: 1,
      name: "أحمد محمد",
      phone: "0501234567",
      address: "الرياض - حي الملقا",
      since: "2024-01-15",
    },
    {
      id: 2,
      name: "سارة علي",
      phone: "0559876543",
      address: "جدة - حي الشاطئ",
      since: "2024-03-22",
    },
    {
      id: 3,
      name: "محمد العتيبي",
      phone: "0561122334",
      address: "الدمام - حي النخيل",
      since: "2024-05-10",
    },
    {
      id: 4,
      name: "نورة الحمد",
      phone: "0509988776",
      address: "مكة - حي العزيزية",
      since: "2024-06-01",
    },
  ];

  let bookings = [
    {
      id: 101,
      customerId: 1,
      eventDate: "2026-08-20",
      guests: 50,
      total: 8500,
      paid: 6000,
      status: "مؤكد",
      notes: "وليمة عشاء",
    },
    {
      id: 102,
      customerId: 1,
      eventDate: "2026-09-05",
      guests: 30,
      total: 4200,
      paid: 0,
      status: "جديد",
      notes: "غداء",
    },
    {
      id: 103,
      customerId: 2,
      eventDate: "2026-08-25",
      guests: 80,
      total: 12500,
      paid: 12500,
      status: "مكتمل",
      notes: "حفل زفاف",
    },
    {
      id: 104,
      customerId: 3,
      eventDate: "2026-08-28",
      guests: 20,
      total: 2800,
      paid: 2000,
      status: "مؤكد",
      notes: "عشاء عائلي",
    },
    {
      id: 105,
      customerId: 4,
      eventDate: "2026-08-30",
      guests: 45,
      total: 6700,
      paid: 4000,
      status: "جديد",
      notes: "وليمة",
    },
  ];

  let payments = [
    {
      id: 1,
      customerId: 1,
      amount: 3000,
      date: "2026-08-01",
      method: "نقدي",
      notes: "دفعة أولى",
    },
    {
      id: 2,
      customerId: 1,
      amount: 2000,
      date: "2026-08-10",
      method: "تحويل بنكي",
      notes: "دفعة ثانية",
    },
    {
      id: 3,
      customerId: 1,
      amount: 1000,
      date: "2026-08-15",
      method: "شبكة",
      notes: "",
    },
    {
      id: 4,
      customerId: 3,
      amount: 2000,
      date: "2026-08-20",
      method: "نقدي",
      notes: "",
    },
    {
      id: 5,
      customerId: 4,
      amount: 4000,
      date: "2026-08-25",
      method: "تحويل بنكي",
      notes: "",
    },
  ];

  // ---- بيانات الموردين ----
  let suppliers = [
    {
      id: 1,
      name: "مؤسسة الغذاء الذهبي",
      phone: "0512345678",
      address: "الرياض - حي النهضة",
      category: "مواد غذائية",
      since: "2024-01-10",
    },
    {
      id: 2,
      name: "شركة الدواجن الحديثة",
      phone: "0598765432",
      address: "جدة - حي السلامة",
      category: "دواجن",
      since: "2024-02-15",
    },
    {
      id: 3,
      name: "مخبز الأريكة",
      phone: "0551122334",
      address: "الدمام - حي الفيصلية",
      category: "مخبوزات",
      since: "2024-03-20",
    },
    {
      id: 4,
      name: "محلات العطارة",
      phone: "0509988776",
      address: "مكة - حي العزيزية",
      category: "بهارات وتوابل",
      since: "2024-04-01",
    },
  ];

  let supplierInvoices = [
    {
      id: 201,
      supplierId: 1,
      date: "2026-08-01",
      total: 4500,
      paid: 3000,
      notes: "فاتورة مواد غذائية",
    },
    {
      id: 202,
      supplierId: 1,
      date: "2026-08-15",
      total: 3200,
      paid: 0,
      notes: "فاتورة لحوم",
    },
    {
      id: 203,
      supplierId: 2,
      date: "2026-08-10",
      total: 2800,
      paid: 2800,
      notes: "دفعة دواجن",
    },
    {
      id: 204,
      supplierId: 3,
      date: "2026-08-20",
      total: 1200,
      paid: 500,
      notes: "خبز طازج",
    },
  ];

  let supplierPayments = [
    {
      id: 101,
      supplierId: 1,
      amount: 2000,
      date: "2026-08-05",
      method: "تحويل بنكي",
      notes: "",
    },
    {
      id: 102,
      supplierId: 1,
      amount: 1000,
      date: "2026-08-12",
      method: "نقدي",
      notes: "",
    },
    {
      id: 103,
      supplierId: 2,
      amount: 2800,
      date: "2026-08-12",
      method: "شبكة",
      notes: "",
    },
    {
      id: 104,
      supplierId: 3,
      amount: 500,
      date: "2026-08-22",
      method: "نقدي",
      notes: "",
    },
  ];

  // ---- بيانات الأصناف (Items) ----
  let items = [
    { id: 1, name: "دجاج مشوي", unit: "قطعة", price: 18.0 },
    { id: 2, name: "رز بسمتي", unit: "كجم", price: 12.5 },
    { id: 3, name: "سلطة خضراء", unit: "طبق", price: 8.0 },
    { id: 4, name: "عصير برتقال", unit: "لتر", price: 10.0 },
    { id: 5, name: "لحم غنم", unit: "كجم", price: 45.0 },
  ];

  let nextCustomerId = 5;
  let nextPaymentId = 6;
  let nextSupplierId = 5;
  let nextSupplierInvoiceId = 205;
  let nextSupplierPaymentId = 105;
  let nextItemId = 6;

  // ---------- دوال حساب الرصيد ----------
  function calculateCustomerBalance(customerId) {
    const customerBookings = bookings.filter(
      (b) => b.customerId === customerId,
    );
    const totalInvoices = customerBookings.reduce((sum, b) => sum + b.total, 0);
    const customerPayments = payments.filter(
      (p) => p.customerId === customerId,
    );
    const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
    return { totalInvoices, totalPaid, balance: totalInvoices - totalPaid };
  }

  function calculateSupplierBalance(supplierId) {
    const invoices = supplierInvoices.filter(
      (inv) => inv.supplierId === supplierId,
    );
    const totalInvoices = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paid = supplierPayments.filter((p) => p.supplierId === supplierId);
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    return { totalInvoices, totalPaid, balance: totalInvoices - totalPaid };
  }

  // ============================================================
  // ---------- API العامة (الواجهة) ----------
  // ============================================================

  const API = {};
  // ---- إضافة حجز جديد (فاتورة) ----
  API.addBooking = function (customerId, bookingData) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) throw new Error("العميل غير موجود");

    const newBooking = {
      id: bookings.length ? Math.max(...bookings.map((b) => b.id)) + 1 : 101,
      customerId: customerId,
      eventDate:
        bookingData.eventDate ||
        bookingData.date ||
        new Date().toISOString().slice(0, 10),
      guests: bookingData.guests || 0,
      total: bookingData.total || 0,
      paid: bookingData.paid || 0,
      status: bookingData.status || "جديد",
      notes: bookingData.notes || "",
      items: bookingData.items || [],
      platesDeposit: bookingData.platesDeposit || 0,
      paymentMethod: bookingData.paymentMethod || "نقدي",
      remaining:
        bookingData.remaining ??
        (bookingData.total || 0) - (bookingData.paid || 0),
    };
    bookings.push(newBooking);
    return newBooking;
  };

  // ---- تحديث حجز ----
  API.updateBooking = function (id, bookingData) {
    const index = bookings.findIndex((b) => b.id === id);
    if (index === -1) throw new Error("الحجز غير موجود");
    bookings[index] = { ...bookings[index], ...bookingData };
    return bookings[index];
  };

  // ---- حذف حجز ----
  API.deleteBooking = function (id) {
    const index = bookings.findIndex((b) => b.id === id);
    if (index === -1) throw new Error("الحجز غير موجود");
    bookings.splice(index, 1);
    return true;
  };

  // ---- تحديث أو حذف المدفوعات (إضافة دوال مشابهة) ----
  API.updatePayment = function (id, paymentData) {
    const index = payments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("الدفعة غير موجودة");
    payments[index] = { ...payments[index], ...paymentData };
    return payments[index];
  };

  API.deletePayment = function (id) {
    const index = payments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("الدفعة غير موجودة");
    payments.splice(index, 1);
    return true;
  };
  // ---- العملاء ----
  API.getCustomers = function () {
    return customers.map((c) => {
      const { totalInvoices, totalPaid, balance } = calculateCustomerBalance(
        c.id,
      );
      return {
        ...c,
        invoicesCount: bookings.filter((b) => b.customerId === c.id).length,
        totalInvoices,
        totalPaid,
        balance,
      };
    });
  };

  API.getCustomer = function (id) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return null;
    const { totalInvoices, totalPaid, balance } = calculateCustomerBalance(id);
    return {
      ...customer,
      invoicesCount: bookings.filter((b) => b.customerId === id).length,
      totalInvoices,
      totalPaid,
      balance,
    };
  };

  API.getCustomerInvoices = function (customerId) {
    return bookings
      .filter((b) => b.customerId === customerId)
      .map((b) => ({
        ...b,
        remaining: b.total - b.paid,
      }));
  };

  API.getCustomerPayments = function (customerId) {
    return payments.filter((p) => p.customerId === customerId);
  };
  // ---- تحديث بيانات عميل ----
  API.updateCustomer = function (id, name, phone, address) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) throw new Error("العميل غير موجود");
    if (!name || name.trim() === "") throw new Error("اسم العميل مطلوب");
    if (!phone || phone.trim() === "") throw new Error("رقم الجوال مطلوب");

    customer.name = name.trim();
    customer.phone = phone.trim();
    customer.address = address || "";
    return customer;
  };

  // ---- حذف عميل ----
  API.deleteCustomer = function (id) {
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("العميل غير موجود");
    customers.splice(index, 1);
    return true;
  };
  API.addPayment = function (customerId, amount, method, notes) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) throw new Error("العميل غير موجود");
    const { balance } = calculateCustomerBalance(customerId);
    if (amount > balance) throw new Error("المبلغ يتجاوز المتبقي");

    const newPayment = {
      id: nextPaymentId++,
      customerId,
      amount,
      date: new Date().toISOString().slice(0, 10),
      method,
      notes: notes || "",
    };
    payments.push(newPayment);
    return newPayment;
  };

  API.addCustomer = function (name, phone, address) {
    const newCustomer = {
      id: nextCustomerId++,
      name,
      phone,
      address: address || "",
      since: new Date().toISOString().slice(0, 10),
    };
    customers.push(newCustomer);
    return newCustomer;
  };

  // ---- الموردين ----
  API.getSuppliers = function () {
    return suppliers.map((s) => {
      const { totalInvoices, totalPaid, balance } = calculateSupplierBalance(
        s.id,
      );
      return {
        ...s,
        invoicesCount: supplierInvoices.filter((inv) => inv.supplierId === s.id)
          .length,
        totalInvoices,
        totalPaid,
        balance,
      };
    });
  };

  API.getSupplier = function (id) {
    const supplier = suppliers.find((s) => s.id === id);
    if (!supplier) return null;
    const { totalInvoices, totalPaid, balance } = calculateSupplierBalance(id);
    return {
      ...supplier,
      invoicesCount: supplierInvoices.filter((inv) => inv.supplierId === id)
        .length,
      totalInvoices,
      totalPaid,
      balance,
    };
  };

  API.getSupplierInvoices = function (supplierId) {
    return supplierInvoices
      .filter((inv) => inv.supplierId === supplierId)
      .map((inv) => ({
        ...inv,
        remaining: inv.total - inv.paid,
      }));
  };

  API.getSupplierPayments = function (supplierId) {
    return supplierPayments.filter((p) => p.supplierId === supplierId);
  };

  API.addSupplierInvoice = function (supplierId, invoiceData) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error("المورد غير موجود");

    const newInvoice = {
      id: nextSupplierInvoiceId++,
      supplierId,
      date: invoiceData.date || new Date().toISOString().slice(0, 10),
      total: Number(invoiceData.total) || 0,
      paid: Number(invoiceData.paid) || 0,
      notes: invoiceData.notes || "",
      status: invoiceData.status || "جديد",
    };
    supplierInvoices.push(newInvoice);
    return newInvoice;
  };

  API.updateSupplierInvoice = function (id, invoiceData) {
    const index = supplierInvoices.findIndex((inv) => inv.id === id);
    if (index === -1) throw new Error("الفاتورة غير موجودة");

    supplierInvoices[index] = {
      ...supplierInvoices[index],
      date: invoiceData.date || supplierInvoices[index].date,
      total: Number(invoiceData.total) || supplierInvoices[index].total,
      paid: Number(invoiceData.paid) || supplierInvoices[index].paid,
      notes: invoiceData.notes ?? supplierInvoices[index].notes,
      status: invoiceData.status || supplierInvoices[index].status,
    };
    return supplierInvoices[index];
  };

  API.deleteSupplierInvoice = function (id) {
    const index = supplierInvoices.findIndex((inv) => inv.id === id);
    if (index === -1) throw new Error("الفاتورة غير موجودة");
    supplierInvoices.splice(index, 1);
    return true;
  };

  API.addSupplierPayment = function (supplierId, amount, method, notes) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error("المورد غير موجود");
    const { balance } = calculateSupplierBalance(supplierId);
    if (amount > balance) throw new Error("المبلغ يتجاوز المستحق");

    const newPayment = {
      id: nextSupplierPaymentId++,
      supplierId,
      amount,
      date: new Date().toISOString().slice(0, 10),
      method,
      notes: notes || "",
    };
    supplierPayments.push(newPayment);
    return newPayment;
  };

  API.updateSupplierPayment = function (id, paymentData) {
    const index = supplierPayments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("الدفعة غير موجودة");

    supplierPayments[index] = {
      ...supplierPayments[index],
      amount: Number(paymentData.amount) || supplierPayments[index].amount,
      method: paymentData.method || supplierPayments[index].method,
      notes: paymentData.notes ?? supplierPayments[index].notes,
      date: paymentData.date || supplierPayments[index].date,
    };
    return supplierPayments[index];
  };

  API.deleteSupplierPayment = function (id) {
    const index = supplierPayments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("الدفعة غير موجودة");
    supplierPayments.splice(index, 1);
    return true;
  };

  API.addSupplier = function (name, phone, address, category) {
    const newSupplier = {
      id: nextSupplierId++,
      name,
      phone,
      address: address || "",
      category: category || "",
      since: new Date().toISOString().slice(0, 10),
    };
    suppliers.push(newSupplier);
    return newSupplier;
  };
  // ---- تحديث بيانات مورد ----
  API.updateSupplier = function (id, name, phone, address, category) {
    const supplier = suppliers.find((s) => s.id === id);
    if (!supplier) throw new Error("المورد غير موجود");
    if (!name || name.trim() === "") throw new Error("اسم المورد مطلوب");
    if (!phone || phone.trim() === "") throw new Error("رقم الجوال مطلوب");

    supplier.name = name.trim();
    supplier.phone = phone.trim();
    supplier.address = address || "";
    supplier.category = category || "";
    return supplier;
  };
  // ---- حذف مورد ----
  API.deleteSupplier = function (id) {
    const index = suppliers.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("المورد غير موجود");
    suppliers.splice(index, 1);
    return true;
  };

  // ---- الأصناف (Items) ----
  API.getItems = function () {
    return items.slice(); // إرجاع نسخة من المصفوفة
  };

  API.getItem = function (id) {
    return items.find((item) => item.id === id) || null;
  };

  API.addItem = function (name, unit, price) {
    if (!name || name.trim() === "") throw new Error("اسم الصنف مطلوب");
    if (!price || price <= 0) throw new Error("السعر يجب أن يكون أكبر من صفر");
    const newItem = {
      id: nextItemId++,
      name: name.trim(),
      unit: unit || "قطعة",
      price: parseFloat(price),
    };
    items.push(newItem);
    return newItem;
  };

  API.updateItem = function (id, name, unit, price) {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("الصنف غير موجود");
    if (!name || name.trim() === "") throw new Error("اسم الصنف مطلوب");
    if (!price || price <= 0) throw new Error("السعر يجب أن يكون أكبر من صفر");
    items[index] = {
      ...items[index],
      name: name.trim(),
      unit: unit || "قطعة",
      price: parseFloat(price),
    };
    return items[index];
  };

  API.deleteItem = function (id) {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("الصنف غير موجود");
    items.splice(index, 1);
    return true;
  };

  // ---- دوال مساعدة عامة ----
  API.formatCurrency = formatCurrency;

  // ---- تصدير إلى النطاق العام ----
  window.API = API;
})();
