// ============================================================
// customers.js - عرض العملاء الجدد (شواطئ عدن)
// يعتمد على تجميع الحجوزات حسب العميل وحساب أول حجز
// ============================================================

(function () {
  "use strict";

  // ---------------------------------------------
  // 1. الثوابت والمتغيرات العامة
  // ---------------------------------------------
  const API_BASE = "https://cafe.technova.fun/api";
  let authToken = localStorage.getItem("auth_token") || null;
  let displayedCustomers = [];
  let allBookingsData = [];

  // ---------------------------------------------
  // 2. دوال التواريخ
  // ---------------------------------------------
  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  function setDefaultDates() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("fromDate").value = formatDateInput(startOfMonth);
    document.getElementById("toDate").value = formatDateInput(today);
  }

  // ---------------------------------------------
  // 3. الأزرار السريعة
  // ---------------------------------------------
  window.setQuickDate = function (type) {
    const today = new Date();
    let from = new Date(today);
    if (type === "today") {
      // من اليوم إلى اليوم
    } else if (type === "week") {
      from.setDate(today.getDate() - 7);
    } else if (type === "month") {
      from.setDate(today.getDate() - 30);
    }
    document.getElementById("fromDate").value = formatDateInput(from);
    document.getElementById("toDate").value = formatDateInput(today);
    window.fetchAndRender();
  };

  // ---------------------------------------------
  // 4. جلب البيانات من الـ API
  // ---------------------------------------------
  async function fetchBookings() {
    if (!authToken) {
      showToast("⚠️ الرجاء تسجيل الدخول أولاً");
      return [];
    }
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
      });
      const result = await response.json();
      if (result.success) {
        allBookingsData = result.data || [];
        return allBookingsData;
      } else {
        showToast("❌ فشل في جلب البيانات");
        return [];
      }
    } catch (error) {
      console.error("API Error:", error);
      showToast("⚠️ خطأ في الاتصال بالخادم");
      return [];
    }
  }

  // ---------------------------------------------
  // 5. معالجة البيانات وتجميع العملاء
  // ---------------------------------------------
  function processCustomers(bookings, fromDate, toDate) {
    const customersMap = new Map();

    bookings.forEach((b) => {
      const name = b.customer?.name || b.customer_name || "غير معروف";
      const phone = b.customer?.phone || b.customer_phone || "";
      const key = name + "|" + phone;

      let bookingDate = b.booking?.date || b.booking_date || b.createdAt;
      if (!bookingDate) return;

      const dateObj = new Date(bookingDate);
      if (isNaN(dateObj.getTime())) return;

      const totalAmount = parseFloat(b.total_amount || b.finance?.total || 0);

      if (!customersMap.has(key)) {
        customersMap.set(key, {
          name: name,
          phone: phone,
          firstDate: dateObj,
          lastDate: dateObj,
          totalBookings: 0,
          totalSpent: 0,
          bookings: [],
          firstBookingId: b.id,
          lastBookingId: b.id,
        });
      }

      const customer = customersMap.get(key);
      customer.totalBookings += 1;
      customer.totalSpent += totalAmount;
      customer.bookings.push(b);

      if (dateObj < customer.firstDate) {
        customer.firstDate = dateObj;
        customer.firstBookingId = b.id;
      }
      if (dateObj > customer.lastDate) {
        customer.lastDate = dateObj;
        customer.lastBookingId = b.id;
      }
    });

    let customersArray = Array.from(customersMap.values());

    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const filteredCustomers = customersArray.filter((c) => {
      return c.firstDate >= from && c.firstDate <= to;
    });

    filteredCustomers.sort((a, b) => b.firstDate - a.firstDate);

    const totalNew = filteredCustomers.length;
    const totalRevenue = filteredCustomers.reduce(
      (sum, c) => sum + c.totalSpent,
      0,
    );
    const avgSpending = totalNew > 0 ? totalRevenue / totalNew : 0;

    return {
      customers: filteredCustomers,
      stats: {
        count: totalNew,
        revenue: totalRevenue,
        average: avgSpending,
      },
    };
  }

  // ---------------------------------------------
  // 6. عرض البيانات في الواجهة
  // ---------------------------------------------
  function renderCustomers(result) {
    const { customers, stats } = result;

    document.getElementById("newCustomersCount").textContent = stats.count;
    document.getElementById("newCustomersRevenue").textContent =
      stats.revenue.toFixed(2);
    document.getElementById("newCustomersAvg").textContent =
      stats.average.toFixed(2);

    const tbody = document.getElementById("tableBody");

    if (customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data"><i class="fas fa-inbox"></i>لا يوجد عملاء جدد في هذه الفترة</td></tr>`;
      displayedCustomers = [];
      return;
    }

    let rows = "";
    customers.forEach((c, index) => {
      rows += `
        <tr>
          <td>${index + 1}</td>
          <td style="font-weight:700;">${c.name}</td>
          <td>${c.phone || "-"}</td>
          <td>${formatDateDisplay(c.firstDate)}</td>
          <td><span class="badge-new">${c.totalBookings}</span></td>
          <td style="font-weight:800; color:#b8860b;">${c.totalSpent.toFixed(2)}</td>
          <td>${formatDateDisplay(c.lastDate)}</td>
          <td>
            <button class="action-btn danger" onclick="showInvoicesModal('${c.name}', '${c.phone}')" title="عرض الفواتير">
              <i class="fas fa-receipt"></i>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;
    displayedCustomers = customers;
  }

  // ---------------------------------------------
  // 7. الدالة الرئيسية
  // ---------------------------------------------
  window.fetchAndRender = async function () {
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;

    if (!from || !to) {
      showToast("⚠️ يرجى تحديد الفترة الزمنية");
      return;
    }

    showToast("⏳ جاري تحميل البيانات...");

    const bookings = await fetchBookings();
    if (!bookings || bookings.length === 0) {
      renderCustomers({
        customers: [],
        stats: { count: 0, revenue: 0, average: 0 },
      });
      showToast("📭 لا توجد بيانات للعرض");
      return;
    }

    const result = processCustomers(bookings, from, to);
    renderCustomers(result);

    showToast(`✅ تم التحديث (${result.stats.count} عميل جديد)`);
  };

  // ---------------------------------------------
  // 8. عرض فواتير العميل في مودال
  // ---------------------------------------------
  window.showInvoicesModal = function (name, phone) {
    const customer = displayedCustomers.find(
      (c) => c.name === name && c.phone === phone,
    );
    if (!customer || !customer.bookings || customer.bookings.length === 0) {
      showToast("⚠️ لا توجد فواتير لهذا العميل");
      return;
    }

    const modal = document.createElement("div");
    modal.className = "invoices-modal";
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(6px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: modalFadeIn 0.3s ease;
    `;

    let invoicesList = "";
    customer.bookings.forEach((b, index) => {
      const total = parseFloat(b.total_amount || b.finance?.total || 0);
      const date = formatDateDisplay(
        b.booking?.date || b.booking_date || b.createdAt,
      );
      const status = b.status || "new";
      const statusLabel =
        {
          new: "جديد",
          confirmed: "مؤكد",
          completed: "مكتمل",
          cancelled: "ملغي",
        }[status] || status;
      invoicesList += `
        <div class="invoice-item" onclick="viewCustomerInvoice(${b.id})" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #f0ebe7;
          cursor: pointer;
          transition: 0.2s;
          border-radius: 8px;
        " onmouseover="this.style.background='#f8f4f0'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="font-weight:800; color:#1e1a17;">فاتورة #${b.id}</span>
            <span style="font-size:12px; color:#8a7a70; margin-right:12px;">${date}</span>
          </div>
          <div>
            <span style="font-weight:800; color:#b8860b;">${total.toFixed(2)} ر.س</span>
            <span style="font-size:11px; color:#8a7a70; margin-right:8px; background:#f0ebe7; padding:2px 10px; border-radius:20px;">${statusLabel}</span>
          </div>
        </div>
      `;
    });

    modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 20px;
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        padding: 24px 20px 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        animation: slideUpModal 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:2px solid #eae3dd; padding-bottom:12px;">
          <div>
            <h3 style="font-size:18px; font-weight:900; color:#1e1a17;">
              <i class="fas fa-user" style="color:#b8860b; margin-left:8px;"></i>
              ${name}
            </h3>
            <p style="font-size:13px; color:#8a7a70; margin-top:2px;">
              <i class="fas fa-phone" style="margin-left:4px;"></i> ${phone || "لا يوجد رقم"}
            </p>
          </div>
          <button onclick="this.closest('.invoices-modal').remove()" style="
            background: transparent;
            border: none;
            font-size: 24px;
            color: #8a7a70;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 8px;
            transition: 0.2s;
          " onmouseover="this.style.background='#f0ebe7'" onmouseout="this.style.background='transparent'">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div style="margin-bottom:12px; font-weight:700; color:#4a3f39; font-size:14px;">
          <i class="fas fa-receipt" style="color:#b8860b;"></i>
          قائمة الفواتير (${customer.bookings.length})
        </div>

        <div style="max-height: 50vh; overflow-y: auto;">
          ${invoicesList}
        </div>

        <div style="margin-top:16px; padding-top:12px; border-top:1px solid #eae3dd; text-align:center; font-size:13px; color:#8a7a70;">
          <i class="fas fa-hand-pointer"></i> اضغط على أي فاتورة لعرضها
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (!document.querySelector("#modalStyles")) {
      const style = document.createElement("style");
      style.id = "modalStyles";
      style.textContent = `
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpModal {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .invoice-item:active {
          transform: scale(0.98);
        }
        .invoices-modal::-webkit-scrollbar {
          width: 4px;
        }
        .invoices-modal::-webkit-scrollbar-thumb {
          background: #b8860b;
          border-radius: 10px;
        }
        .invoices-modal::-webkit-scrollbar-track {
          background: transparent;
        }
      `;
      document.head.appendChild(style);
    }

    modal.addEventListener("click", function (e) {
      if (e.target === this) this.remove();
    });
  };

  // ---------------------------------------------
  // 9. عرض الفاتورة (invoice.html)
  // ---------------------------------------------
  window.viewCustomerInvoice = function (bookingId) {
    if (!bookingId) {
      showToast("⚠️ لا توجد فاتورة");
      return;
    }

    const targetBooking = allBookingsData.find((b) => b.id == bookingId);
    if (!targetBooking) {
      showToast("⚠️ لم يتم العثور على الفاتورة");
      return;
    }

    const invoiceData = buildInvoiceData(targetBooking);
    localStorage.setItem("preview_invoice_data", JSON.stringify(invoiceData));
    window.location.href = "invoice.html";
  };

  // ---------------------------------------------
  // 10. بناء كائن الفاتورة
  // ---------------------------------------------
  function buildInvoiceData(b) {
    let restaurant = {
      name: "شواطئ عدن",
      subtitle: "مطابخ ومطاعم",
      phone: "0550724459",
      address: "جدة - شارع جاك",
    };
    try {
      const storedSettings = localStorage.getItem("restaurant_data");
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        restaurant = { ...restaurant, ...parsed };
      }
    } catch (e) {}

    function getItemName(item) {
      if (item.name && item.name !== "صنف") return item.name;
      const itemId = item.itemId || item.item_id;
      if (itemId) {
        return item.item_name || item.name || "صنف";
      }
      return "صنف";
    }

    function formatDateForDisplay(dateStr) {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      } catch {
        return dateStr;
      }
    }

    function convertTimeTo12H(time24) {
      if (!time24) return "";
      if (time24.includes("T")) {
        try {
          const date = new Date(time24);
          let hours = date.getHours();
          const minutes = date.getMinutes().toString().padStart(2, "0");
          const ampm = hours >= 12 ? "مساءً" : "صباحاً";
          hours = hours % 12 || 12;
          return `${hours}:${minutes} ${ampm}`;
        } catch {
          return time24;
        }
      }
      const parts = time24.split(":");
      if (parts.length < 2) return time24;
      let hours = parseInt(parts[0]);
      const minutes = parts[1] || "00";
      const ampm = hours >= 12 ? "مساءً" : "صباحاً";
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    function getDayName(dateStr) {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      const days = [
        "الأحد",
        "الإثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
      ];
      return days[date.getDay()];
    }

    const customerName = b.customer?.name || b.customer_name || "";
    const customerPhone = b.customer?.phone || b.customer_phone || "";
    const customerLocation = b.customer?.location || b.customer_location || "";
    const bookingDate = b.booking?.date || b.booking_date || b.createdAt;
    const bookingTime = b.booking?.time || b.booking_time || "";
    const mark = b.booking?.mark || b.mark || "";
    const deliveryTime = b.booking?.deliveryTime || b.delivery_time || "ظهراً";
    const notes = b.notes || "";
    const platesDeposit = parseFloat(b.platesDeposit || 0);
    const total = parseFloat(b.total_amount || b.finance?.total || 0);
    const deposit = parseFloat(b.deposit_paid || b.finance?.deposit || 0);
    const remaining = Math.max(0, total - deposit);
    const paymentMethod = b.payment?.method || b.payment_method || "نقدي";

    let sideOrders = [];
    if (b.sideOrders && Array.isArray(b.sideOrders)) {
      sideOrders = b.sideOrders;
    } else if (b.side_orders && Array.isArray(b.side_orders)) {
      sideOrders = b.side_orders.map((item) => ({
        name: item.item_name || item.name || "صنف",
        qty: item.quantity || item.qty || 1,
        price: item.price || 0,
        total: (item.price || 0) * (item.quantity || item.qty || 1),
      }));
    } else if (b.items && Array.isArray(b.items)) {
      sideOrders = b.items.map((item) => ({
        name: item.item_name || item.name || "صنف",
        qty: item.quantity || 1,
        price: item.price || 0,
        total: (item.price || 0) * (item.quantity || 1),
      }));
    }

    return {
      id: b.id,
      customer: {
        name: customerName,
        phone: customerPhone,
        location: customerLocation,
      },
      booking: {
        date: formatDateForDisplay(bookingDate),
        time: convertTimeTo12H(bookingTime),
        day: getDayName(bookingDate),
        mark: mark,
        deliveryTime: deliveryTime,
      },
      paymentMethod: paymentMethod,
      items: sideOrders.map((item) => ({
        name: item.name || "صنف",
        qty: item.qty || item.quantity || 1,
        price: item.price || 0,
        total: (item.price || 0) * (item.qty || item.quantity || 1),
      })),
      total: total.toFixed(2),
      platesDeposit: platesDeposit.toFixed(2),
      notes: notes,
      deposit: deposit.toFixed(2),
      remaining: remaining.toFixed(2),
      restaurant: restaurant,
    };
  }

  // ============================================================
  // 11. دوال المعاينة والتصدير (مودال مدمج)
  // ============================================================

  window.openPreview = function () {
    if (!displayedCustomers || displayedCustomers.length === 0) {
      showToast("⚠️ لا توجد بيانات للمعاينة");
      return;
    }

    const stats = {
      count: displayedCustomers.length,
      revenue: displayedCustomers.reduce((s, c) => s + c.totalSpent, 0),
      avg: displayedCustomers.length > 0
        ? displayedCustomers.reduce((s, c) => s + c.totalSpent, 0) / displayedCustomers.length
        : 0,
    };

    document.getElementById("previewCount").textContent = stats.count;
    document.getElementById("previewRevenue").textContent = stats.revenue.toFixed(2);
    document.getElementById("previewAvg").textContent = stats.avg.toFixed(2);
    document.getElementById("summaryCount").textContent = stats.count;
    document.getElementById("summaryAvg").textContent = stats.avg.toFixed(2);

    document.getElementById("displayFrom").textContent = document.getElementById("fromDate").value;
    document.getElementById("displayTo").textContent = document.getElementById("toDate").value;

    const tbody = document.getElementById("previewTableBody");
    const tfoot = document.getElementById("previewTableFoot");

    if (displayedCustomers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#8a7a70; font-weight:700;">📭 لا توجد بيانات للعرض</td></tr>`;
      tfoot.style.display = "none";
    } else {
      let rows = "";
      let sumSpent = 0;
      displayedCustomers.forEach((c, index) => {
        sumSpent += c.totalSpent;
        rows += `
          <tr>
            <td>${index + 1}</td>
            <td style="font-weight:700;">${c.name}</td>
            <td>${c.phone || "-"}</td>
            <td>${formatDateDisplay(c.firstDate)}</td>
            <td><span class="badge-new">${c.totalBookings}</span></td>
            <td style="font-weight:800; color:#b8860b;">${c.totalSpent.toFixed(2)}</td>
            <td>${formatDateDisplay(c.lastDate)}</td>
          </tr>
        `;
      });
      tbody.innerHTML = rows;

      tfoot.style.display = "table-footer-group";
      tfoot.innerHTML = `
        <tr class="total-row" style="background: #1e1a17; color: #ffffff; font-weight: 900; font-size: 15px; border-top: 3px solid #b8860b;">
          <td colspan="5" style="text-align:left; padding-right:20px; font-weight:900;">📊 الإجمالي التراكمي</td>
          <td style="font-weight:900;">${sumSpent.toFixed(2)}</td>
          <td></td>
        </tr>
      `;
    }

    document.getElementById("customersPreviewModal").classList.add("active");
  };

  window.closePreviewModal = function () {
    document.getElementById("customersPreviewModal").classList.remove("active");
  };

  window.downloadPDF = async function () {
    const container = document.getElementById("previewContainer");
    const btn = document.querySelector(".btn-pdf");
    const originalText = btn.innerHTML;

    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
      btn.disabled = true;

      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;
      const originalPadding = container.style.padding;

      container.style.width = "210mm";
      container.style.maxWidth = "210mm";
      container.style.padding = "20px 24px";
      container.style.background = "#ffffff";

      await new Promise(resolve => requestAnimationFrame(resolve));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        onclone: function(clonedDoc) {
          const actions = clonedDoc.querySelector(".actions-preview");
          if (actions) actions.style.display = "none";
        }
      });

      container.style.width = originalWidth || "";
      container.style.maxWidth = originalMaxWidth || "";
      container.style.padding = originalPadding || "";
      container.style.background = "";

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);
      const from = document.getElementById("fromDate").value;
      const to = document.getElementById("toDate").value;
      pdf.save(`عملاء_جدد_${from}_الى_${to}.pdf`);

      showToast("✅ تم تحميل PDF بنجاح");
    } catch (error) {
      console.error("PDF Error:", error);
      showToast("❌ حدث خطأ في إنشاء PDF");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  window.downloadExcelPreview = function () {
    if (!displayedCustomers || displayedCustomers.length === 0) {
      showToast("⚠️ لا توجد بيانات للتصدير");
      return;
    }

    try {
      const excelData = displayedCustomers.map((c, index) => ({
        "رقم": index + 1,
        "اسم العميل": c.name,
        "الجوال": c.phone || "-",
        "تاريخ أول حجز": formatDateDisplay(c.firstDate),
        "عدد الحجوزات": c.totalBookings,
        "إجمالي المشتريات (ر.س)": c.totalSpent,
        "تاريخ آخر حجز": formatDateDisplay(c.lastDate),
      }));

      const totalCustomers = displayedCustomers.length;
      const totalRevenue = displayedCustomers.reduce((s, c) => s + c.totalSpent, 0);
      const avg = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      excelData.push({
        "رقم": "",
        "اسم العميل": "📊 الإجمالي التراكمي",
        "الجوال": "",
        "تاريخ أول حجز": "",
        "عدد الحجوزات": totalCustomers,
        "إجمالي المشتريات (ر.س)": totalRevenue,
        "تاريخ آخر حجز": "",
      });

      excelData.push({
        "رقم": "",
        "اسم العميل": "📈 متوسط الإنفاق",
        "الجوال": "",
        "تاريخ أول حجز": "",
        "عدد الحجوزات": "",
        "إجمالي المشتريات (ر.س)": avg,
        "تاريخ آخر حجز": "",
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      ws["!cols"] = [
        { wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 22 },
        { wch: 18 }, { wch: 25 }, { wch: 22 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "العملاء الجدد");
      const from = document.getElementById("fromDate").value;
      const to = document.getElementById("toDate").value;
      XLSX.writeFile(wb, `عملاء_جدد_${from}_الى_${to}.xlsx`);

      showToast("✅ تم تحميل Excel بنجاح");
    } catch (error) {
      console.error("Excel Error:", error);
      showToast("❌ حدث خطأ في إنشاء Excel");
    }
  };

  window.shareWhatsAppPreview = async function () {
    const container = document.getElementById("previewContainer");
    const btn = document.querySelector(".btn-whatsapp");
    const originalText = btn.innerHTML;

    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
      btn.disabled = true;

      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;
      const originalPadding = container.style.padding;

      container.style.width = "210mm";
      container.style.maxWidth = "210mm";
      container.style.padding = "20px 24px";
      container.style.background = "#ffffff";

      await new Promise(resolve => requestAnimationFrame(resolve));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        onclone: function(clonedDoc) {
          const actions = clonedDoc.querySelector(".actions-preview");
          if (actions) actions.style.display = "none";
        }
      });

      container.style.width = originalWidth || "";
      container.style.maxWidth = originalMaxWidth || "";
      container.style.padding = originalPadding || "";
      container.style.background = "";

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);
      const pdfBlob = pdf.output("blob");
      const from = document.getElementById("fromDate").value;
      const to = document.getElementById("toDate").value;
      const pdfFile = new File(
        [pdfBlob],
        `عملاء_جدد_${from}.pdf`,
        { type: "application/pdf" }
      );

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: "تقرير العملاء الجدد - شواطئ عدن",
          text: `📊 تقرير العملاء الجدد للفترة من ${from} إلى ${to}`,
          files: [pdfFile]
        });
        showToast("✅ تمت المشاركة بنجاح");
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `عملاء_جدد_${from}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast("✅ تم تحميل PDF، يمكنك مشاركته يدوياً");
      }
    } catch (error) {
      console.error("Share Error:", error);
      if (error.name !== "AbortError") {
        showToast("❌ حدث خطأ في المشاركة");
      }
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  // ---------------------------------------------
  // 12. Toast
  // ---------------------------------------------
  function showToast(msg) {
    const existing = document.querySelector(".custom-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "0.5s";
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // ---------------------------------------------
  // 13. التشغيل عند تحميل الصفحة
  // ---------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    if (!authToken) {
      showToast("⚠️ يرجى تسجيل الدخول أولاً");
      document.getElementById("tableBody").innerHTML = `
        <tr><td colspan="8" style="text-align:center; padding:40px; color:#c0392b; font-weight:bold;">
          🔒 الرجاء تسجيل الدخول من الصفحة الرئيسية
        </td></tr>
      `;
      return;
    }
    setDefaultDates();
    setTimeout(window.fetchAndRender, 100);
  });

})();