"use strict";

(() => {
    let allBookings = [];
    let allCustomers = [];
    let currentRows = [];
    let currentPeriod = "day";
    let currentRange = {
        start: "",
        end: ""
    };

    // الإحصائيات المجمعة من financialSummary
    let financialStats = {
        sales_total: 0,
        customer_payments_total: 0,
        customer_balance: 0,
        purchases_total: 0,
        supplier_payments_total: 0,
        supplier_balance: 0
    };

    const STATUS_LABELS = {
        new: "جديد",
        confirmed: "مؤكد",
        completed: "مكتمل",
        cancelled: "ملغي"
    };

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        setupPeriodButtons();
        setupDateInputs();
        setupActions();
        setupFab();
        setDefaultPeriod();
        await loadReport();
    }

    function setupPeriodButtons() {
        document.querySelectorAll("[data-period]").forEach(button => {
            button.addEventListener("click", async () => {
                document.querySelectorAll("[data-period]").forEach(item => {
                    item.classList.remove("active");
                });
                button.classList.add("active");
                currentPeriod = button.dataset.period;
                const customPanel = document.getElementById("customDateRange");
                if (currentPeriod === "custom") {
                    if (customPanel) customPanel.style.display = "";
                    return;
                }
                if (customPanel) customPanel.style.display = "none";
                setRangeFromPeriod(currentPeriod);
                await loadReport();
            });
        });
    }

    function setupDateInputs() {
        const start = document.getElementById("reportStartDate");
        const end = document.getElementById("reportEndDate");
        if (start) start.addEventListener("change", async () => {
            if (currentPeriod === "custom") await loadCustomReportIfValid();
        });
        if (end) end.addEventListener("change", async () => {
            if (currentPeriod === "custom") await loadCustomReportIfValid();
        });
    }

    function setupActions() {
        const csvButton = document.getElementById("exportCsvBtn");
        const jsonButton = document.getElementById("exportJsonBtn");
        const shareButton = document.getElementById("shareReportBtn");
        if (csvButton) csvButton.addEventListener("click", exportCSV);
        if (jsonButton) jsonButton.addEventListener("click", exportJSON);
        if (shareButton) shareButton.addEventListener("click", shareReport);
    }

    function setupFab() {
        const fab = document.getElementById("fab");
        if (fab) fab.addEventListener("click", () => {
            window.location.href = "booking-new.html";
        });
    }

    function setDefaultPeriod() {
        currentPeriod = "day";
        setRangeFromPeriod("day");
        const customPanel = document.getElementById("customDateRange");
        if (customPanel) customPanel.style.display = "none";
    }

    function setRangeFromPeriod(period) {
        const today = new Date();
        const end = new Date(today);
        const start = new Date(today);
        if (period === "week") start.setDate(start.getDate() - 6);
        if (period === "month") start.setDate(start.getDate() - 29);
        currentRange.start = formatDate(start);
        currentRange.end = formatDate(end);
        setInputValue("reportStartDate", currentRange.start);
        setInputValue("reportEndDate", currentRange.end);
    }

    async function loadCustomReportIfValid() {
        const start = document.getElementById("reportStartDate")?.value || "";
        const end = document.getElementById("reportEndDate")?.value || "";
        if (!start || !end) return;
        if (start > end) {
            showToast("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
            return;
        }
        currentRange.start = start;
        currentRange.end = end;
        await loadReport();
    }

    async function loadReport() {
        if (!window.API) {
            renderError("واجهة API غير متاحة");
            return;
        }

        if (!currentRange.start || !currentRange.end) {
            setRangeFromPeriod(currentPeriod);
        }

        renderLoading();

        try {
            // 1. جلب الإحصائيات المجمعة من financialSummary
            const statsResult = await window.API.reports.financialSummary(
                currentRange.start,
                currentRange.end
            );
            console.log('📦 إحصائيات التقرير:', statsResult);

            // تحديث الإحصائيات
            financialStats = {
                sales_total: number(statsResult?.sales_total ?? 0),
                customer_payments_total: number(statsResult?.customer_payments_total ?? 0),
                customer_balance: number(statsResult?.customer_balance ?? 0),
                purchases_total: number(statsResult?.purchases_total ?? 0),
                supplier_payments_total: number(statsResult?.supplier_payments_total ?? 0),
                supplier_balance: number(statsResult?.supplier_balance ?? 0)
            };

            // 2. جلب قائمة الحجوزات من API.getBookings
            let bookingsData = [];
            try {
                // محاولة بمعاملات from_date / to_date
                const bookingsResponse = await window.API.getBookings({
                    from_date: currentRange.start,
                    to_date: currentRange.end
                });
                bookingsData = extractArray(bookingsResponse);
                console.log('📦 الحجوزات (from/to):', bookingsData);
            } catch (e1) {
                console.warn('محاولة أولى فشلت، نحاول بصيغة start/end', e1);
                try {
                    const bookingsResponse = await window.API.getBookings({
                        start_date: currentRange.start,
                        end_date: currentRange.end
                    });
                    bookingsData = extractArray(bookingsResponse);
                    console.log('📦 الحجوزات (start/end):', bookingsData);
                } catch (e2) {
                    console.error('فشل جلب الحجوزات بكل الصيغ:', e2);
                    throw new Error('تعذر جلب قائمة الحجوزات');
                }
            }

            // 3. فلترة الحجوزات حسب النطاق الزمني (للتأكد)
            allBookings = bookingsData.filter(booking => {
                const date = booking.event_date || booking.eventDate || booking.invoice_date || '';
                return isDateInRange(String(date).substring(0, 10), currentRange.start, currentRange.end);
            });

            // 4. تحميل العملاء
            await loadCustomers();

            // 5. بناء الصفوف
            currentRows = buildRows(allBookings);

            // 6. عرض البيانات
            renderSummary(currentRows);
            renderChart(currentRows);
            renderStatusDistribution(currentRows);
            renderTopCustomers(currentRows);
            renderDetails(currentRows);

        } catch (error) {
            console.error('Reports Error:', error);
            renderError(error?.message || 'تعذر تحميل التقرير');
        }
    }

    async function loadCustomers() {
        try {
            const result = await window.API.getCustomers();
            allCustomers = extractArray(result);
        } catch (error) {
            console.error('Customers Error:', error);
            allCustomers = [];
        }
    }

    // ----- دوال مساعدة للبيانات -----
    function extractArray(value) {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data?.data)) return value.data.data;
        if (Array.isArray(value?.result)) return value.result;
        if (Array.isArray(value?.bookings)) return value.bookings;
        return [];
    }

    function buildRows(bookings) {
        return bookings.map(booking => {
            const customer = booking.customer || findCustomer(booking.customer_id);
            const total = number(booking.total_amount ?? booking.totalAmount ?? 0);
            const paid = getPaidAmount(booking);
            const remaining = Math.max(0, total - paid);
            const date = String(booking.event_date || booking.eventDate || booking.invoice_date || "").substring(0, 10);
            return {
                id: booking.id,
                type: "booking",
                typeLabel: "حجز",
                name: customer?.name || booking.customer_name || "عميل غير معروف",
                phone: customer?.phone || booking.customer_phone || "",
                date,
                total,
                paid,
                remaining,
                deposit: number(booking.plate_deposit),
                status: booking.status || "new",
                raw: booking
            };
        });
    }

    function getPaidAmount(booking) {
        const payments = booking.payments || booking.customer_payments || booking.customerPayments;
        if (Array.isArray(payments)) {
            return payments.reduce((sum, payment) => sum + number(payment.amount), 0);
        }
        return number(booking.paid_amount ?? booking.paidAmount ?? booking.total_paid ?? booking.totalPaid ?? 0);
    }

    function findCustomer(id) {
        return allCustomers.find(customer => String(customer.id) === String(id));
    }

    function isDateInRange(date, start, end) {
        return date >= start && date <= end;
    }

    // ----- دوال العرض -----
    function renderSummary(rows) {
        const container = document.getElementById("reportSummary");
        if (!container) return;

        // نستخدم الإحصائيات من financialStats إن وجدت، وإلا نحسبها من rows
        const totalRevenue = financialStats.sales_total > 0 ? financialStats.sales_total : rows.reduce((sum, row) => sum + row.total, 0);
        const totalPaid = financialStats.customer_payments_total > 0 ? financialStats.customer_payments_total : rows.reduce((sum, row) => sum + row.paid, 0);
        const totalRemaining = financialStats.customer_balance > 0 ? financialStats.customer_balance : rows.reduce((sum, row) => sum + row.remaining, 0);
        const totalDeposits = rows.reduce((sum, row) => sum + row.deposit, 0);
        const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

        container.innerHTML = `
            ${createKpi("إجمالي الإيرادات", formatMoney(totalRevenue), "ر.س", "fa-sack-dollar", "#8f1720", "rgba(143,23,32,.10)")}
            ${createKpi("إجمالي المدفوعات", formatMoney(totalPaid), "ر.س", "fa-money-bill-wave", "#16855b", "rgba(22,133,91,.10)")}
            ${createKpi("المبالغ المتبقية", formatMoney(totalRemaining), "ر.س", "fa-hourglass-half", "#b4232f", "rgba(180,35,47,.10)")}
            ${createKpi("عدد الحجوزات", formatNumber(rows.length), "حجز", "fa-calendar-check", "#356ea8", "rgba(53,110,168,.10)")}
            ${createKpi("تأمين الصحون", formatMoney(totalDeposits), "ر.س", "fa-shield-halved", "#c77718", "rgba(199,119,24,.10)")}
            ${createKpi("نسبة التحصيل", collectionRate.toFixed(1), "%", "fa-chart-line", "#16855b", "rgba(22,133,91,.10)")}
            ${createKpi("فواتير مكتملة", formatNumber(rows.filter(row => row.status === "completed").length), "حجز", "fa-circle-check", "#16855b", "rgba(22,133,91,.10)")}
            ${createKpi("حجوزات مؤجلة", formatNumber(rows.filter(row => row.remaining > 0).length), "حجز", "fa-clock", "#c77718", "rgba(199,119,24,.10)")}
        `;
    }

    function createKpi(label, value, unit, icon, color, soft) {
        return `
            <div class="report-kpi" style="--kpi-color:${color};--kpi-soft:${soft};">
                <div class="report-kpi-icon"><i class="fas ${icon}"></i></div>
                <div class="report-kpi-label">${escapeHtml(label)}</div>
                <div class="report-kpi-value">${escapeHtml(value)} <span class="report-kpi-unit">${escapeHtml(unit)}</span></div>
            </div>
        `;
    }

    function renderChart(rows) {
        const container = document.getElementById("monthlyChart");
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = emptyHtml("لا توجد بيانات", "لا توجد إيرادات في الفترة المحددة", "fa-chart-column");
            return;
        }

        const groups = buildChartGroups(rows);
        const max = Math.max(...groups.map(item => item.value), 1);

        container.innerHTML = groups.map(group => {
            const height = group.value > 0 ? Math.max(5, (group.value / max) * 100) : 2;
            return `
                <div class="chart-column">
                    <div class="chart-value">${formatMoneyCompact(group.value)}</div>
                    <div class="chart-bar-track">
                        <div class="chart-bar" style="height:${height}%" title="${escapeAttribute(formatMoney(group.value) + ' ر.س')}"></div>
                    </div>
                    <div class="chart-label">${escapeHtml(group.label)}</div>
                </div>
            `;
        }).join("");
    }

    function buildChartGroups(rows) {
        const start = parseLocalDate(currentRange.start);
        const end = parseLocalDate(currentRange.end);
        const days = Math.floor((end - start) / 86400000) + 1;

        if (days <= 1) {
            return [{ label: "اليوم", value: rows.reduce((sum, row) => sum + row.total, 0) }];
        }
        if (days <= 14) {
            const groups = [];
            for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                const key = formatDate(date);
                groups.push({
                    label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
                    value: rows.filter(row => row.date === key).reduce((sum, row) => sum + row.total, 0)
                });
            }
            return groups;
        }

        const groups = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            const year = cursor.getFullYear();
            const month = cursor.getMonth();
            const monthRows = rows.filter(row => {
                const date = parseLocalDate(row.date);
                return date.getFullYear() === year && date.getMonth() === month;
            });
            groups.push({
                label: `${month + 1}/${String(year).slice(-2)}`,
                value: monthRows.reduce((sum, row) => sum + row.total, 0)
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return groups;
    }

    function renderStatusDistribution(rows) {
        const container = document.getElementById("statusDistribution");
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = emptyHtml("لا توجد بيانات", "لا توجد حجوزات لعرض الحالات", "fa-chart-pie");
            return;
        }

        const statuses = ["new", "confirmed", "completed", "cancelled"];
        const counts = {};
        statuses.forEach(status => { counts[status] = rows.filter(row => row.status === status).length; });
        const max = Math.max(...Object.values(counts), 1);

        container.innerHTML = statuses.map(status => {
            const count = counts[status];
            const width = count > 0 ? Math.max(4, (count / max) * 100) : 0;
            return `
                <div class="status-row">
                    <div class="status-row-header">
                        <span class="status-name">${escapeHtml(STATUS_LABELS[status] || status)}</span>
                        <span class="status-count">${count} حجز</span>
                    </div>
                    <div class="status-progress">
                        <div class="status-progress-fill" style="width:${width}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderTopCustomers(rows) {
        const container = document.getElementById("topHalls");
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = emptyHtml("لا توجد بيانات", "لا توجد حجوزات لعرض أفضل العملاء", "fa-users");
            return;
        }

        const customers = {};
        rows.forEach(row => {
            const key = row.customerId || `${row.name}-${row.phone}`;
            if (!customers[key]) {
                customers[key] = { name: row.name, phone: row.phone, total: 0, bookings: 0 };
            }
            customers[key].total += row.total;
            customers[key].bookings++;
        });

        const top = Object.values(customers).sort((a, b) => b.total - a.total).slice(0, 5);
        if (!top.length) {
            container.innerHTML = emptyHtml("لا توجد بيانات", "لا توجد بيانات للعملاء", "fa-users");
            return;
        }

        container.innerHTML = `
            <div class="top-customer-list">
                ${top.map((customer, index) => `
                    <div class="top-customer">
                        <div class="top-customer-rank">${index + 1}</div>
                        <div class="top-customer-info">
                            <div class="top-customer-name">${escapeHtml(customer.name)}</div>
                            <div class="top-customer-meta">${customer.bookings} حجوزات${customer.phone ? ' · ' + escapeHtml(customer.phone) : ''}</div>
                        </div>
                        <div class="top-customer-total">${formatMoney(customer.total)} ر.س</div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function renderDetails(rows) {
        const tbody = document.getElementById("reportDetailTable");
        if (!tbody) return;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5">${emptyHtml("لا توجد بيانات", "لا توجد حجوزات في الفترة المحددة", "fa-file-invoice")}</td></tr>`;
            return;
        }

        const sorted = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        tbody.innerHTML = sorted.map(row => `
            <tr>
                <td><span class="report-type"><i class="fas fa-calendar-check"></i> ${escapeHtml(row.typeLabel)}</span></td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(row.name)}</div>
                    ${row.phone ? `<div style="color:var(--text-secondary,#64748b);font-size:10px;margin-top:2px;">${escapeHtml(row.phone)}</div>` : ""}
                </td>
                <td>${formatDateDisplay(row.date)}</td>
                <td><span class="report-amount">${formatMoney(row.total)} ر.س</span></td>
                <td><span class="report-status ${escapeAttribute(row.status)}">${escapeHtml(STATUS_LABELS[row.status] || row.status || "-")}</span></td>
            </tr>
        `).join("");
    }

    // ----- دوال التحميل والرسائل -----
    function renderLoading() {
        const elements = [
            document.getElementById("reportSummary"),
            document.getElementById("monthlyChart"),
            document.getElementById("statusDistribution"),
            document.getElementById("topHalls"),
            document.getElementById("reportDetailTable")
        ];
        const loadingHtml = `<div class="report-loading"><i class="fas fa-spinner fa-spin"></i><div>جاري التحميل...</div></div>`;
        elements.forEach(el => {
            if (el) {
                if (el.tagName === 'TBODY') {
                    el.innerHTML = `<tr><td colspan="5">${loadingHtml}</td></tr>`;
                } else {
                    el.innerHTML = loadingHtml;
                }
            }
        });
    }

    function renderError(message) {
        const elements = [
            document.getElementById("reportSummary"),
            document.getElementById("monthlyChart"),
            document.getElementById("statusDistribution"),
            document.getElementById("topHalls"),
            document.getElementById("reportDetailTable")
        ];
        const errorHtml = emptyHtml("تعذر تحميل التقرير", message, "fa-triangle-exclamation");
        elements.forEach(el => {
            if (el) {
                if (el.tagName === 'TBODY') {
                    el.innerHTML = `<tr><td colspan="5">${errorHtml}</td></tr>`;
                } else {
                    el.innerHTML = errorHtml;
                }
            }
        });
    }

    function emptyHtml(title, description, icon) {
        return `
            <div class="report-empty">
                <i class="fas ${icon}"></i>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(description)}</span>
            </div>
        `;
    }

    // ----- دوال التصدير والمشاركة -----
    function exportCSV() {
        if (!currentRows.length) {
            showToast("لا توجد بيانات لتصديرها");
            return;
        }
        const headers = ["النوع", "الاسم", "الهاتف", "التاريخ", "إجمالي الفاتورة", "المدفوع", "المتبقي", "تأمين الصحون", "الحالة"];
        const lines = [headers.map(csvCell).join(",")];
        currentRows.forEach(row => {
            lines.push([
                row.typeLabel,
                row.name,
                row.phone,
                row.date,
                row.total,
                row.paid,
                row.remaining,
                row.deposit,
                STATUS_LABELS[row.status] || row.status
            ].map(csvCell).join(","));
        });
        const csv = "\uFEFF" + lines.join("\r\n");
        downloadFile(csv, `report-${currentRange.start}-${currentRange.end}.csv`, "text/csv;charset=utf-8");
        showToast("تم تصدير التقرير");
    }

    function exportJSON() {
        if (!currentRows.length) {
            showToast("لا توجد بيانات لتصديرها");
            return;
        }
        const data = {
            period: { from: currentRange.start, to: currentRange.end },
            summary: {
                bookings: currentRows.length,
                total: sumRows("total"),
                paid: sumRows("paid"),
                remaining: sumRows("remaining"),
                deposits: sumRows("deposit")
            },
            bookings: currentRows.map(row => ({
                id: row.id,
                customer: row.name,
                phone: row.phone,
                date: row.date,
                total_amount: row.total,
                paid_amount: row.paid,
                remaining_amount: row.remaining,
                plate_deposit: row.deposit,
                status: row.status
            }))
        };
        downloadFile(JSON.stringify(data, null, 2), `report-${currentRange.start}-${currentRange.end}.json`, "application/json;charset=utf-8");
        showToast("تم تصدير التقرير");
    }

    async function shareReport() {
        if (!currentRows.length) {
            showToast("لا توجد بيانات للمشاركة");
            return;
        }
        const text = buildShareText();
        if (navigator.share && typeof navigator.share === "function") {
            try {
                await navigator.share({ title: "تقرير شواطئ عدن", text });
                return;
            } catch (error) {
                if (error?.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(text);
            showToast("تم نسخ التقرير للمشاركة");
        } catch (error) {
            showToast("تعذر مشاركة التقرير");
        }
    }

    function buildShareText() {
        return [
            "تقرير شواطئ عدن",
            `الفترة: ${formatDateDisplay(currentRange.start)} - ${formatDateDisplay(currentRange.end)}`,
            "",
            `عدد الحجوزات: ${currentRows.length}`,
            `إجمالي الإيرادات: ${formatMoney(sumRows("total"))} ر.س`,
            `إجمالي المدفوعات: ${formatMoney(sumRows("paid"))} ر.س`,
            `المتبقي: ${formatMoney(sumRows("remaining"))} ر.س`
        ].join("\n");
    }

    function sumRows(field) {
        return currentRows.reduce((sum, row) => sum + number(row[field]), 0);
    }

    // ----- دوال مساعدة عامة -----
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseLocalDate(value) {
        if (!value) return new Date();
        const parts = String(value).substring(0, 10).split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatDateDisplay(value) {
        if (!value) return "-";
        const parts = String(value).substring(0, 10).split("-");
        if (parts.length !== 3) return value;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatMoney(value) {
        return new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));
    }

    function formatMoneyCompact(value) {
        const amount = number(value);
        if (amount >= 1000000) return (amount / 1000000).toFixed(1).replace(".0", "") + "م";
        if (amount >= 1000) return (amount / 1000).toFixed(1).replace(".0", "") + "k";
        return formatMoney(amount);
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("ar-SA").format(number(value));
    }

    function number(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function escapeHtml(value) {
        return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input) input.value = value;
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function csvCell(value) {
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }

    function showToast(message) {
        if (window.Utils && typeof window.Utils.showToast === "function") {
            window.Utils.showToast(message);
            return;
        }
        const container = document.getElementById("toastContainer");
        if (!container) return;
        container.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
        setTimeout(() => { container.innerHTML = ""; }, 3000);
    }
})();