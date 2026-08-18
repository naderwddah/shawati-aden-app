document.addEventListener("DOMContentLoaded", function () {
  const state = {
    period: "day",
    customStart: "",
    customEnd: "",
  };

  function formatCurrency(value) {
    if (window.API && typeof window.API.formatCurrency === "function") {
      return window.API.formatCurrency(value || 0);
    }
    return Number(value || 0).toLocaleString("ar-SA") + " ر.س";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseDate(value) {
    if (!value) return null;
    const local = new Date(value + "T00:00:00");
    return Number.isNaN(local.getTime()) ? null : local;
  }

  function toDateInputValue(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function getRangeForPeriod(period) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (period === "day") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (period === "week") {
      const start = addDays(now, -6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (period === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }

    if (period === "custom") {
      const startDate = state.customStart
        ? parseDate(state.customStart)
        : addDays(new Date(), -29);
      const endDate = state.customEnd ? parseDate(state.customEnd) : new Date();
      if (startDate && endDate) {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return { start: startDate, end: endDate };
      }
    }

    const start = addDays(now, -29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function isWithinRange(dateValue, start, end) {
    const date = parseDate(dateValue);
    if (!date) return false;
    return date >= start && date <= end;
  }

  function getCustomerData() {
    if (!window.API) return { bookings: [], payments: [], customers: [] };

    const customers = window.API.getCustomers ? window.API.getCustomers() : [];
    const bookings = customers.flatMap((customer) => {
      const invoices = window.API.getCustomerInvoices
        ? window.API.getCustomerInvoices(customer.id)
        : [];
      return invoices.map((item) => ({ ...item, customerName: customer.name }));
    });

    const payments = customers.flatMap((customer) => {
      const records = window.API.getCustomerPayments
        ? window.API.getCustomerPayments(customer.id)
        : [];
      return records.map((item) => ({ ...item, customerName: customer.name }));
    });

    return { bookings, payments, customers };
  }

  function getSupplierData() {
    if (!window.API) return { invoices: [], payments: [], suppliers: [] };

    const suppliers = window.API.getSuppliers ? window.API.getSuppliers() : [];
    const invoices = suppliers.flatMap((supplier) => {
      const records = window.API.getSupplierInvoices
        ? window.API.getSupplierInvoices(supplier.id)
        : [];
      return records.map((item) => ({ ...item, supplierName: supplier.name }));
    });

    const payments = suppliers.flatMap((supplier) => {
      const records = window.API.getSupplierPayments
        ? window.API.getSupplierPayments(supplier.id)
        : [];
      return records.map((item) => ({ ...item, supplierName: supplier.name }));
    });

    return { invoices, payments, suppliers };
  }

  function buildReportData() {
    const { bookings, payments } = getCustomerData();
    const { invoices: supplierInvoices, payments: supplierPayments } =
      getSupplierData();
    const { start, end } = getRangeForPeriod(state.period);

    const filteredBookings = bookings.filter((item) =>
      isWithinRange(item.eventDate, start, end),
    );
    const filteredPayments = payments.filter((item) =>
      isWithinRange(item.date, start, end),
    );
    const filteredSupplierInvoices = supplierInvoices.filter((item) =>
      isWithinRange(item.date, start, end),
    );
    const filteredSupplierPayments = supplierPayments.filter((item) =>
      isWithinRange(item.date, start, end),
    );

    const revenue = filteredBookings.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0,
    );
    const collections = filteredPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const expenses = filteredSupplierInvoices.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0,
    );
    const supplierOut = filteredSupplierPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const net = revenue - expenses;
    const outstanding = filteredBookings.reduce(
      (sum, item) =>
        sum + Math.max(0, Number(item.total || 0) - Number(item.paid || 0)),
      0,
    );
    const totalTransactions =
      filteredBookings.length +
      filteredPayments.length +
      filteredSupplierInvoices.length +
      filteredSupplierPayments.length;

    const statusGroups = filteredBookings.reduce((acc, item) => {
      const status = item.status || "غير محدد";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const topCustomers = Object.values(
      filteredBookings.reduce((acc, item) => {
        const key = item.customerName || "غير محدد";
        acc[key] = (acc[key] || 0) + Number(item.total || 0);
        return acc;
      }, {}),
    )
      .sort((a, b) => b - a)
      .slice(0, 4);

    const customerNames = [
      ...new Set(
        filteredBookings.map((item) => item.customerName || "غير محدد"),
      ),
    ];
    const customersSummary = customerNames
      .map((name) => {
        const total = filteredBookings
          .filter((item) => (item.customerName || "غير محدد") === name)
          .reduce((sum, item) => sum + Number(item.total || 0), 0);
        return { name, total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    const detailRows = [
      ...filteredBookings.map((item) => ({
        type: "حجز",
        name: item.customerName || "عميل",
        date: item.eventDate,
        amount: Number(item.total || 0),
        status: item.status || "جديد",
        kind: "booking",
      })),
      ...filteredPayments.map((item) => ({
        type: "دفعة عميل",
        name: item.customerName || "عميل",
        date: item.date,
        amount: Number(item.amount || 0),
        status: "مدفوع",
        kind: "customer-payment",
      })),
      ...filteredSupplierInvoices.map((item) => ({
        type: "فاتورة مورد",
        name: item.supplierName || "مورد",
        date: item.date,
        amount: Number(item.total || 0),
        status: "مستحق",
        kind: "supplier-invoice",
      })),
      ...filteredSupplierPayments.map((item) => ({
        type: "دفعة مورد",
        name: item.supplierName || "مورد",
        date: item.date,
        amount: Number(item.amount || 0),
        status: "مدفوع",
        kind: "supplier-payment",
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const chartData = buildChartData(
      filteredBookings,
      state.period,
      start,
      end,
    );

    return {
      summary: {
        revenue,
        collections,
        expenses,
        supplierOut,
        net,
        outstanding,
        totalTransactions,
      },
      statusGroups,
      topCustomers: customersSummary,
      chartData,
      detailRows,
      range: { start, end },
    };
  }

  function buildChartData(filteredBookings, period, start, end) {
    const labels = [];
    const values = [];

    if (period === "day") {
      for (let i = 6; i >= 0; i -= 1) {
        const date = addDays(end, -i);
        const label = toDateInputValue(date);
        labels.push(label.slice(5));
        values.push(
          filteredBookings
            .filter((item) => item.eventDate === label)
            .reduce((sum, item) => sum + Number(item.total || 0), 0),
        );
      }
      return { labels, values };
    }

    if (period === "week") {
      for (let i = 6; i >= 0; i -= 1) {
        const date = addDays(end, -i * 7);
        const startOfBucket = addDays(date, -6);
        const label = `${toDateInputValue(startOfBucket).slice(5)} / ${toDateInputValue(date).slice(5)}`;
        labels.push(label);
        values.push(
          filteredBookings
            .filter((item) => {
              const current = parseDate(item.eventDate);
              return current && current >= startOfBucket && current <= date;
            })
            .reduce((sum, item) => sum + Number(item.total || 0), 0),
        );
      }
      return { labels, values };
    }

    if (period === "custom") {
      const diffDays = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1,
      );
      const steps = Math.min(6, diffDays);
      for (let i = 0; i < steps; i += 1) {
        const bucketStart = addDays(start, Math.floor((diffDays / steps) * i));
        const bucketEnd =
          i === steps - 1
            ? end
            : addDays(start, Math.floor((diffDays / steps) * (i + 1)) - 1);
        const label = `${toDateInputValue(bucketStart).slice(5)} / ${toDateInputValue(bucketEnd).slice(5)}`;
        labels.push(label);
        values.push(
          filteredBookings
            .filter((item) => {
              const current = parseDate(item.eventDate);
              return current && current >= bucketStart && current <= bucketEnd;
            })
            .reduce((sum, item) => sum + Number(item.total || 0), 0),
        );
      }
      return { labels, values };
    }

    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        label: `${d.getMonth() + 1}/${d.getFullYear()}`.replace("/", "/"),
        monthKey,
      });
    }

    for (const month of months) {
      const [year, monthNum] = month.monthKey.split("-");
      const current = new Date(Number(year), Number(monthNum) - 1, 1);
      const next = new Date(Number(year), Number(monthNum), 1);
      labels.push(month.label);
      values.push(
        filteredBookings
          .filter((item) => {
            const currentDate = parseDate(item.eventDate);
            return currentDate && currentDate >= current && currentDate < next;
          })
          .reduce((sum, item) => sum + Number(item.total || 0), 0),
      );
    }

    return { labels, values };
  }

  function renderSummary(summary) {
    const container = document.getElementById("reportSummary");
    if (!container) return;

    const cards = [
      {
        label: "إجمالي الإيرادات",
        value: formatCurrency(summary.revenue),
        color: "primary",
        icon: "fa-money-bill-wave",
        meta: "من الحجوزات",
      },
      {
        label: "المصروفات",
        value: formatCurrency(summary.expenses),
        color: "warning",
        icon: "fa-boxes-stacked",
        meta: "من الموردين",
      },
      {
        label: "صافي الربح",
        value: formatCurrency(summary.net),
        color: "success",
        icon: "fa-chart-line",
        meta: "بعد المصروفات",
      },
      {
        label: "عدد الحجوزات",
        value: summary.totalTransactions || 0,
        color: "neutral",
        icon: "fa-calendar-check",
        meta: "مجموع الحركات",
      },
    ];

    container.innerHTML = cards
      .map(
        (card) => `
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-icon kpi-icon-${card.color}"><i class="fas ${card.icon}"></i></div>
          <div class="kpi-info">
            <div class="kpi-label">${card.label}</div>
            <div class="kpi-value">${card.value}</div>
            <div class="kpi-meta">${card.meta}</div>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderStatusDistribution(statusGroups) {
    const container = document.getElementById("statusDistribution");
    if (!container) return;

    const entries = Object.entries(statusGroups);
    if (!entries.length) {
      container.innerHTML =
        '<div class="empty-state-compact"><i class="fas fa-info-circle"></i><span>لا توجد بيانات لهذه الفترة</span></div>';
      return;
    }

    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    container.innerHTML = entries
      .map(([status, count]) => {
        const percent = ((count / total) * 100).toFixed(0);
        return `
        <div class="distribution-item">
          <div class="distribution-row">
            <span class="distribution-label">${escapeHtml(status)}</span>
            <span class="distribution-value">${count}</span>
          </div>
          <div class="progress-bar">
            <span style="width: ${percent}%"></span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function renderTopCustomers(customers) {
    const container = document.getElementById("topHalls");
    if (!container) return;

    if (!customers.length) {
      container.innerHTML =
        '<div class="empty-state-compact"><i class="fas fa-users"></i><span>لا توجد بيانات للعرض</span></div>';
      return;
    }

    container.innerHTML = customers
      .map(
        (customer, index) => `
      <div class="list-item">
        <div class="list-item-icon" style="background: var(--primary-soft); color: var(--primary);">
          <span>${index + 1}</span>
        </div>
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(customer.name)}</div>
          <div class="list-item-subtitle">إجمالي الحجز: ${formatCurrency(customer.total)}</div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderChart(chartData) {
    const container = document.getElementById("monthlyChart");
    if (!container) return;

    const maxValue = Math.max(...chartData.values, 1);

    container.innerHTML = chartData.labels
      .map((label, index) => {
        const value = chartData.values[index] || 0;
        const height = Math.max(16, (value / maxValue) * 100);
        return `
        <div class="chart-bar-item">
          <div class="chart-bar-value">${formatCurrency(value)}</div>
          <div class="chart-bar-track">
            <span class="chart-bar-fill" style="height: ${height}%"></span>
          </div>
          <div class="chart-bar-label">${escapeHtml(label)}</div>
        </div>
      `;
      })
      .join("");
  }

  function renderDetailTable(rows) {
    const container = document.getElementById("reportDetailTable");
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state-compact"><i class="fas fa-receipt"></i><span>لا توجد معاملات في هذه الفترة</span></div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = rows
      .map(
        (row) => `
      <tr>
        <td><span class="badge ${row.kind === "booking" ? "badge-confirmed" : row.kind.includes("supplier") ? "badge-warning" : "badge-success"}">${escapeHtml(row.type)}</span></td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${formatCurrency(row.amount)}</td>
        <td><span class="badge ${row.status === "مؤكد" || row.status === "مدفوع" ? "badge-confirmed" : "badge-warning"}">${escapeHtml(row.status)}</span></td>
      </tr>
    `,
      )
      .join("");
  }

  function renderReport() {
    if (!window.API) {
      const summary = document.getElementById("reportSummary");
      if (summary)
        summary.innerHTML =
          '<div class="empty-state-compact"><i class="fas fa-spinner"></i><span>جارٍ تحميل البيانات...</span></div>';
      return;
    }

    const report = buildReportData();
    renderSummary(report.summary);
    renderStatusDistribution(report.statusGroups);
    renderTopCustomers(report.topCustomers);
    renderChart(report.chartData);
    renderDetailTable(report.detailRows);
  }

  function setActivePeriod(period) {
    state.period = period;
    document.querySelectorAll(".chip[data-period]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.period === period);
    });

    const customRange = document.getElementById("customDateRange");
    if (customRange) {
      customRange.style.display = period === "custom" ? "flex" : "none";
    }

    if (period !== "custom") {
      renderReport();
    } else {
      const start = document.getElementById("reportStartDate");
      const end = document.getElementById("reportEndDate");
      if (!state.customStart) {
        const range = getRangeForPeriod("month");
        state.customStart = toDateInputValue(range.start);
        state.customEnd = toDateInputValue(range.end);
      }
      if (start) start.value = state.customStart;
      if (end) end.value = state.customEnd;
      renderReport();
    }
  }

  function bindControls() {
    document.querySelectorAll(".chip[data-period]").forEach((chip) => {
      chip.addEventListener("click", () =>
        setActivePeriod(chip.dataset.period),
      );
    });

    const startInput = document.getElementById("reportStartDate");
    const endInput = document.getElementById("reportEndDate");

    if (startInput) {
      startInput.addEventListener("change", function () {
        state.customStart = this.value;
        renderReport();
      });
    }

    if (endInput) {
      endInput.addEventListener("change", function () {
        state.customEnd = this.value;
        renderReport();
      });
    }

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function () {
        const report = buildReportData();
        const rows = report.detailRows;
        const csv = [
          ["النوع", "الاسم", "التاريخ", "المبلغ", "الحالة"].join(","),
          ...rows.map((row) =>
            [row.type, row.name, row.date, row.amount, row.status]
              .map((value) => `"${String(value).replace(/"/g, '""')}"`)
              .join(","),
          ),
        ].join("\n");
        downloadFile("report.csv", csv, "text/csv;charset=utf-8;");
        window.showToast &&
          window.showToast("تم تصدير ملف CSV بنجاح", "success");
      });
    }

    const exportJsonBtn = document.getElementById("exportJsonBtn");
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", function () {
        const report = buildReportData();
        const json = JSON.stringify(
          {
            period: state.period,
            from: toDateInputValue(report.range.start),
            to: toDateInputValue(report.range.end),
            summary: report.summary,
            rows: report.detailRows,
          },
          null,
          2,
        );
        downloadFile("report.json", json, "application/json;charset=utf-8;");
        window.showToast &&
          window.showToast("تم تصدير ملف JSON بنجاح", "success");
      });
    }

    const shareBtn = document.getElementById("shareReportBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async function () {
        const report = buildReportData();
        const text = `تقرير ${state.period === "day" ? "يومي" : state.period === "week" ? "أسبوعي" : state.period === "month" ? "شهري" : "مخصص"}\nإجمالي الإيرادات: ${formatCurrency(report.summary.revenue)}\nصافي الربح: ${formatCurrency(report.summary.net)}\nالحركات: ${report.summary.totalTransactions}`;

        if (navigator.share) {
          try {
            await navigator.share({
              title: "تقرير شواطئ عدن",
              text,
            });
            window.showToast &&
              window.showToast("تم مشاركة التقرير بنجاح", "success");
            return;
          } catch (error) {
            console.warn("Share cancelled", error);
          }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            window.showToast &&
              window.showToast("تم نسخ التقرير إلى الحافظة", "info");
            return;
          } catch (error) {
            console.warn("Clipboard failed", error);
          }
        }

        const json = JSON.stringify(report, null, 2);
        downloadFile(
          "report-share.json",
          json,
          "application/json;charset=utf-8;",
        );
        window.showToast &&
          window.showToast("تم تحميل نسخة من التقرير", "info");
      });
    }
  }

  function downloadFile(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (window.layoutReady) {
    const start = document.getElementById("reportStartDate");
    const end = document.getElementById("reportEndDate");
    const range = getRangeForPeriod("day");
    state.customStart = toDateInputValue(range.start);
    state.customEnd = toDateInputValue(range.end);
    if (start) start.value = state.customStart;
    if (end) end.value = state.customEnd;
    bindControls();
    setActivePeriod("day");
  } else {
    document.addEventListener("layout:ready", function () {
      const start = document.getElementById("reportStartDate");
      const end = document.getElementById("reportEndDate");
      const range = getRangeForPeriod("day");
      state.customStart = toDateInputValue(range.start);
      state.customEnd = toDateInputValue(range.end);
      if (start) start.value = state.customStart;
      if (end) end.value = state.customEnd;
      bindControls();
      setActivePeriod("day");
    });
  }
});
