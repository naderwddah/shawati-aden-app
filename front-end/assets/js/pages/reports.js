 "use strict";

(() => {
    /*
     * ============================================================
     * Reports Page
     * العملاء + الموردون + الحجوزات + الحركة المالية
     *
     * مطابق مباشرةً لـ reports.html الحالي.
     * لا يتم عرض الأصناف أو الكميات.
     * ============================================================
     */

    const state = {
        period: "live",
        range: {
            start: "",
            end: "",
        },

        customers: [],
        suppliers: [],
        bookings: [],
        customerPayments: [],
        supplierInvoices: [],
        supplierPayments: [],

        financial: {
            sales_total: 0,
            customer_payments_total: 0,
            customer_balance: 0,
            purchases_total: 0,
            supplier_payments_total: 0,
            supplier_balance: 0,
            net_sales_minus_purchases: 0,
        },

        financialLoaded: false,
        loading: false,
        requestId: 0,
        lastSuccessful: false,
        lastUpdated: null,
        liveTimer: null,
    };

    const STATUS_LABELS = {
        new: "جديد",
        confirmed: "مؤكد",
        completed: "مكتمل",
        cancelled: "ملغي",
        pending: "معلق",
    };

    const STATUS_ICONS = {
        new: "fa-circle-plus",
        confirmed: "fa-circle-check",
        completed: "fa-check-double",
        cancelled: "fa-circle-xmark",
        pending: "fa-clock",
    };

    const STATUS_CLASS_MAP = {
        new: "new",
        confirmed: "confirmed",
        completed: "completed",
        cancelled: "cancelled",
        pending: "new",
    };

    const PAYMENT_METHOD_FALLBACK = "غير محددة";

    const LIVE_REFRESH_MS = 30000;
    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        setupPeriodButtons();
        setupDateInputs();
        setupActions();
        setupLiveVisibility();

        setDefaultPeriod();
        updateSelectedPeriodLabel();

        await loadReport();
        scheduleLiveRefresh();
    }

    function scheduleLiveRefresh() {
        if (state.liveTimer) clearInterval(state.liveTimer);
        state.liveTimer = null;
        if (state.period !== "live") return;
        state.liveTimer = setInterval(() => {
            if (document.visibilityState === "hidden" || state.loading) return;
            setRangeFromPeriod("live");
            loadReport();
        }, LIVE_REFRESH_MS);
    }

    function setupLiveVisibility() {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && state.period === "live" && !state.loading) {
                setRangeFromPeriod("live");
                loadReport();
            }
        });
        window.addEventListener("beforeunload", () => {
            if (state.liveTimer) clearInterval(state.liveTimer);
        });
    }

    /* ============================================================
       Filters / Actions
    ============================================================ */

    function updatePeriodPanels() {
        const isDay = state.period === "day";
        const isWeek = state.period === "week";
        const panel = document.getElementById("singleDatePanel");
        const custom = document.getElementById("customDateRange");
        panel?.classList.toggle("hidden", !(isDay || isWeek));
        custom?.classList.toggle("hidden", state.period !== "custom");
        setText("reportSingleDateLabel", isWeek ? "اختر يومًا من الأسبوع المطلوب" : "تاريخ التقرير");
        setText("reportSingleDateHelp", isWeek
            ? "يعرض الأسبوع من السبت إلى الجمعة الذي يقع فيه هذا التاريخ."
            : "تقرير يوم محدد، ويمكنك اختيار أي تاريخ سابق.");
        document.querySelectorAll("[data-period]").forEach(button => {
            const active = button.dataset.period === state.period;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function setupPeriodButtons() {
        document.querySelectorAll("[data-period]").forEach(button => {
            button.addEventListener("click", async () => {
                state.period = button.dataset.period || "live";
                if (state.period === "live") {
                    setRangeFromPeriod("live");
                } else if (state.period === "day" || state.period === "week") {
                    const selected = document.getElementById("reportSingleDate")?.value || formatDate(new Date());
                    setRangeFromPeriod(state.period, selected);
                } else {
                    if (!state.range.start || !state.range.end) setRangeFromPeriod("day");
                }
                updatePeriodPanels();
                updateSelectedPeriodLabel();
                scheduleLiveRefresh();
                if (state.period !== "custom") await loadReport();
            });
        });
    }

    function setupDateInputs() {
        const single = document.getElementById("reportSingleDate");
        single?.addEventListener("change", async () => {
            if (!single.value || !["day", "week"].includes(state.period)) return;
            setRangeFromPeriod(state.period, single.value);
            updateSelectedPeriodLabel();
            await loadReport();
        });
        for (const id of ["reportStartDate", "reportEndDate"]) {
            document.getElementById(id)?.addEventListener("change", () => {
                if (state.period === "custom") {
                    const start = document.getElementById("reportStartDate")?.value;
                    const end = document.getElementById("reportEndDate")?.value;
                    if (start && end && start <= end) {
                        state.range.start = start;
                        state.range.end = end;
                        updateSelectedPeriodLabel();
                    }
                }
            });
        }
    }

    function setupActions() {
        const applyButton =
            document.getElementById("applyReportBtn");

        const resetButton =
            document.getElementById("resetReportBtn");

        const shareButton =
            document.getElementById("shareReportBtn");

        const printButton =
            document.getElementById("printReportBtn");

        const csvButton =
            document.getElementById("exportCsvBtn");

        const jsonButton =
            document.getElementById("exportJsonBtn");

        if (applyButton) {
            applyButton.addEventListener("click", async () => {
                if (state.period === "custom") {
                    const start =
                        document.getElementById("reportStartDate")?.value || "";

                    const end =
                        document.getElementById("reportEndDate")?.value || "";

                    if (!start || !end) {
                        showToast("حدد تاريخ البداية والنهاية أولاً");
                        return;
                    }

                    if (start > end) {
                        showToast(
                            "تاريخ البداية يجب أن يكون قبل تاريخ النهاية"
                        );
                        return;
                    }

                    state.range.start = start;
                    state.range.end = end;
                }

                await loadReport();
            });
        }

        if (resetButton) {
            resetButton.addEventListener("click", async () => {
                setDefaultPeriod();
                updateSelectedPeriodLabel();
                scheduleLiveRefresh();
                await loadReport();
            });
        }

        if (shareButton) {
            shareButton.addEventListener("click", shareReport);
        }

        if (printButton) {
            printButton.addEventListener("click", () => {
                if (!state.lastSuccessful || state.loading) { showToast("التقرير غير مكتمل، حدّث البيانات أولًا"); return; }
                window.print();
            });
        }

        if (csvButton) {
            csvButton.addEventListener("click", exportCSV);
        }

        if (jsonButton) {
            jsonButton.addEventListener("click", exportJSON);
        }
    }

    function setDefaultPeriod() {
        state.period = "live";
        setRangeFromPeriod("live");
        updatePeriodPanels();
    }

    function setRangeFromPeriod(period, pickedDate = "") {
        const base = pickedDate ? parseLocalDate(pickedDate) : parseLocalDate(todayInRiyadh());
        let start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        let end = new Date(start);
        if (period === "week") {
            // Week starts Saturday, ends Friday (Saudi calendar convention).
            const daysSinceSaturday = (start.getDay() + 1) % 7;
            start.setDate(start.getDate() - daysSinceSaturday);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        }
        state.range.start = formatDate(start);
        state.range.end = formatDate(end);
        if (period === "live") setInputValue("reportSingleDate", state.range.start);
        else if (period === "day" || period === "week") setInputValue("reportSingleDate", pickedDate || formatDate(base));
        setInputValue("reportStartDate", state.range.start);
        setInputValue("reportEndDate", state.range.end);
    }

    function todayInRiyadh() {
        const fields = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
        return `${fields.year}-${fields.month}-${fields.day}`;
    }

    function parseLocalDate(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return new Date();
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function updateSelectedPeriodLabel() {
        const label = document.getElementById("selectedReportPeriod");
        if (!label) return;
        const start = formatDateDisplay(state.range.start);
        const end = formatDateDisplay(state.range.end);
        if (state.period === "live") label.textContent = `لحظي — ${start} (تحديث كل 30 ثانية)`;
        else if (state.period === "day") label.textContent = `يومي — ${start}`;
        else if (state.period === "week") label.textContent = `أسبوعي (السبت–الجمعة) — ${start} إلى ${end}`;
        else label.textContent = `من ${start} إلى ${end}`;
    }

    /* ============================================================
       Loading
    ============================================================ */

    async function loadReport() {
        if (!window.API) {
            renderError("واجهة API غير متاحة");
            return;
        }
        if (state.period === "live") {
            setRangeFromPeriod("live");
            updateSelectedPeriodLabel();
        }
        if (!state.range.start || !state.range.end || state.range.start > state.range.end) {
            showToast("تحقق من تاريخ البداية والنهاية");
            return;
        }
        const requestId = ++state.requestId;
        const range = { ...state.range };
        state.loading = true;
        state.lastSuccessful = false;
        renderLoading();
        updateStatus("جاري تحديث التقرير...", "يتم جلب أحدث البيانات من قاعدة البيانات.");
        const freshness = String(Date.now());
        try {
            const results = await Promise.allSettled([
                loadFinancialSummary(range, freshness),
                loadCustomers(freshness), loadSuppliers(freshness),
                loadBookings(range, freshness), loadCustomerPayments(range, freshness),
                loadSupplierInvoices(range, freshness), loadSupplierPayments(range, freshness),
            ]);
            if (requestId !== state.requestId) return;
            const [fin, cust, suppl, book, cp, inv, sp] = results;
            const required = [fin, book, cp, inv, sp];
            const missing = required.filter(x => x.status !== "fulfilled");
            if (missing.length) {
                // Financial totals must not be presented as zero or complete after a partial failure.
                throw new Error(`تعذر جلب ${missing.length} من مصادر التقرير المالية. أعد المحاولة.`);
            }
            state.financialLoaded = true;
            state.financial = normalizeFinancial(fin.value);
            state.customers = cust.status === "fulfilled" ? extractArray(cust.value) : [];
            state.suppliers = suppl.status === "fulfilled" ? extractArray(suppl.value) : [];
            state.bookings = filterBookingsByRange(extractArray(book.value), range);
            state.customerPayments = filterCustomerPaymentsByRange(extractArray(cp.value), range);
            state.supplierInvoices = filterSupplierInvoicesByRange(extractArray(inv.value), range);
            state.supplierPayments = filterSupplierPaymentsByRange(extractArray(sp.value), range);
            state.lastSuccessful = true;
            state.lastUpdated = new Date();
            renderAll();
            const extraError = [cust, suppl].some(x => x.status !== "fulfilled");
            updateStatus(
                state.period === "live" ? "التقرير اللحظي محدّث" : "التقرير جاهز",
                extraError ? "الأرقام المالية مكتملة، لكن بعض الأسماء قد تكون غير متاحة." :
                    (state.period === "live" ? "تحديث تلقائي كل 30 ثانية أثناء فتح الصفحة." : "بيانات الفترة المحددة من الخادم.")
            );
            setText("reportGeneratedAt", `آخر جلب: ${state.lastUpdated.toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
            setText("printReportPeriod", state.period === "live" ?
                `لحظي — ${formatDateDisplay(range.start)} — آخر جلب ${state.lastUpdated.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}` :
                `${formatDateDisplay(range.start)} - ${formatDateDisplay(range.end)}`);
        } catch (error) {
            if (requestId !== state.requestId) return;
            console.error("Reports Error:", error);
            state.lastSuccessful = false;
            renderLoading();
            renderError(error?.message || "تعذر تحميل التقرير");
        } finally {
            if (requestId === state.requestId) state.loading = false;
        }
    }

    async function loadFinancialSummary(range, fresh) {
        // API.request is part of the installed V4 API and can pass freshness query.
        const response = await window.API.request("/reports/financial-summary", {
            query: { from_date: range.start, to_date: range.end, _fresh: fresh },
        });
        return response?.data ?? response;
    }
    async function loadCustomers(fresh) {
        return window.API.getCustomers({ _fresh: fresh });
    }
    async function loadSuppliers(fresh) {
        return window.API.getSuppliers({ _fresh: fresh });
    }
    async function loadBookings(range, fresh) {
        return window.API.getBookings({ from_date: range.start, to_date: range.end, _fresh: fresh });
    }
    async function loadCustomerPayments(range, fresh) {
        return window.API.getCustomerPayments({ from_date: range.start, to_date: range.end, _fresh: fresh });
    }
    async function loadSupplierInvoices(range, fresh) {
        return window.API.getSupplierInvoices({ from_date: range.start, to_date: range.end, _fresh: fresh });
    }
    async function loadSupplierPayments(range, fresh) {
        return window.API.getSupplierPayments({ from_date: range.start, to_date: range.end, _fresh: fresh });
    }

    /* ============================================================
       Normalization / Filtering
    ============================================================ */

    function extractArray(value) {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data?.data)) return value.data.data;
        if (Array.isArray(value?.result)) return value.result;
        if (Array.isArray(value?.bookings)) return value.bookings;
        return [];
    }

    function normalizeFinancial(value) {
        return {
            sales_total: number(
                value?.sales_total ??
                value?.salesTotal ??
                value?.total_sales ??
                0
            ),

            customer_payments_total: number(
                value?.customer_payments_total ??
                value?.customerPaymentsTotal ??
                0
            ),

            customer_balance: number(
                value?.customer_balance ??
                value?.customerBalance ??
                0
            ),

            purchases_total: number(
                value?.purchases_total ??
                value?.purchasesTotal ??
                0
            ),

            supplier_payments_total: number(
                value?.supplier_payments_total ??
                value?.supplierPaymentsTotal ??
                0
            ),

            supplier_balance: number(
                value?.supplier_balance ??
                value?.supplierBalance ??
                0
            ),

            net_sales_minus_purchases: number(
                value?.net_sales_minus_purchases ??
                value?.netSalesMinusPurchases ??
                0
            ),
        };
    }

    function buildFinancialFallback() {
        const sales =
            sumBy(state.bookings, (booking) =>
                number(
                    booking?.total_amount ??
                    booking?.totalAmount
                )
            );

        const customerPayments =
            sumBy(state.customerPayments, (payment) =>
                number(payment?.amount)
            );

        const purchases =
            sumBy(state.supplierInvoices, (invoice) =>
                number(
                    invoice?.total_amount ??
                    invoice?.totalAmount ??
                    invoice?.amount
                )
            );

        const supplierPayments =
            sumBy(state.supplierPayments, (payment) =>
                number(payment?.amount)
            );

        return {
            sales_total: sales,
            customer_payments_total: customerPayments,
            customer_balance: Math.max(0, sales - customerPayments),
            purchases_total: purchases,
            supplier_payments_total: supplierPayments,
            supplier_balance: Math.max(0, purchases - supplierPayments),
            net_sales_minus_purchases: sales - purchases,
        };
    }

    function filterBookingsByRange(bookings, range = state.range) {
        return bookings.filter((booking) => {
            const date = normalizeDate(
                booking?.event_date ??
                booking?.eventDate ??
                booking?.invoice_date ??
                ""
            );

            return isDateInRange(
                date,
                range.start,
                range.end
            );
        });
    }

    function filterCustomerPaymentsByRange(payments, range = state.range) {
        return payments.filter((payment) => {
            const date = normalizeDate(
                payment?.payment_date ??
                payment?.paymentDate ??
                ""
            );

            return isDateInRange(
                date,
                range.start,
                range.end
            );
        });
    }

    function filterSupplierInvoicesByRange(invoices, range = state.range) {
        return invoices.filter((invoice) => {
            const date = normalizeDate(
                invoice?.invoice_date ??
                invoice?.invoiceDate ??
                ""
            );

            return isDateInRange(
                date,
                range.start,
                range.end
            );
        });
    }

    function filterSupplierPaymentsByRange(payments, range = state.range) {
        return payments.filter((payment) => {
            const date = normalizeDate(
                payment?.payment_date ??
                payment?.paymentDate ??
                ""
            );

            return isDateInRange(
                date,
                range.start,
                range.end
            );
        });
    }

    /* ============================================================
       Main Render
    ============================================================ */

    function renderAll() {
        renderMainSummary();
        renderDetailedFinancialSummary();
        renderOperationalSummary();
        renderBookings();
        renderSupplierSummary();
        renderSupplierInvoices();
        renderCustomerPayments();
        renderSupplierPayments();
        renderFinalFinancialSummary();
        renderDepositSummary();
    }

    /* ============================================================
       Main Financial KPIs
    ============================================================ */

    function bookingPayable(booking) {
        return number(booking?.payable_total ?? booking?.payableTotal ??
            (number(booking?.total_amount ?? booking?.totalAmount) + number(booking?.plate_deposit ?? booking?.plateDeposit)));
    }

    function bookingReceivable(booking) {
        return Math.max(0, bookingPayable(booking) - getBookingPaidAmount(booking));
    }

    function periodBookingReceivables() {
        return sumBy(state.bookings, bookingReceivable);
    }

    function renderDepositSummary() {
        let deposits = 0, returned = 0;
        state.bookings.forEach(b => {
            deposits += number(b.plate_deposit ?? b.plateDeposit);
            returned += number(b.plate_deposit_returned ?? b.plateDepositReturned);
        });
        setText("reportPlateDeposits", `${formatMoney(deposits)} ر.س`);
        setText("reportPlateReturns", `${formatMoney(returned)} ر.س`);
        setText("reportPlatePending", `${formatMoney(Math.max(0, deposits - returned))} ر.س`);
    }

    function renderMainSummary() {
        const financial = state.financial;

        setText(
            "totalInvoicesAmount",
            `${formatMoney(sumBy(state.bookings, bookingPayable))} ر.س`
        );

        setText(
            "totalCustomerPayments",
            `${formatMoney(financial.customer_payments_total)} ر.س`
        );

        setText(
            "totalCustomerRemaining",
            `${formatMoney(periodBookingReceivables())} ر.س`
        );

        setText(
            "totalSupplierInvoices",
            `${formatMoney(financial.purchases_total)} ر.س`
        );
    }

    /* ============================================================
       Detailed Financial Summary
    ============================================================ */

    function renderDetailedFinancialSummary() {
        const financial = state.financial;

        const customerInvoicesTotal = sumBy(state.bookings, bookingPayable);

        const customerPaymentsTotal =
            number(financial.customer_payments_total);

        const customerRemainingTotal = periodBookingReceivables();

        const supplierInvoicesTotal =
            number(financial.purchases_total);

        const supplierPaymentsTotal =
            number(financial.supplier_payments_total);

        const supplierRemainingTotal = number(financial.supplier_balance);

        setText(
            "customerInvoicesTotal",
            `${formatMoney(customerInvoicesTotal)} ر.س`
        );

        setText(
            "customerInvoicesCount",
            `${formatNumber(state.bookings.length)} حجز`
        );

        setText(
            "customerPaymentsTotal",
            `${formatMoney(customerPaymentsTotal)} ر.س`
        );

        setText(
            "customerPaymentsCount",
            `${formatNumber(state.customerPayments.length)} دفعة`
        );

        setText(
            "customerRemainingTotal",
            `${formatMoney(customerRemainingTotal)} ر.س`
        );

        const remainingCustomers =
            countCustomersWithRemaining();

        setText(
            "customerRemainingCount",
            `${formatNumber(remainingCustomers)} عميل`
        );

        setText(
            "supplierInvoicesTotal",
            `${formatMoney(supplierInvoicesTotal)} ر.س`
        );

        setText(
            "supplierInvoicesCount",
            `${formatNumber(state.supplierInvoices.length)} فاتورة`
        );

        setText(
            "supplierPaymentsTotal",
            `${formatMoney(supplierPaymentsTotal)} ر.س`
        );

        setText(
            "supplierPaymentsCount",
            `${formatNumber(state.supplierPayments.length)} دفعة`
        );

        setText(
            "supplierRemainingTotal",
            `${formatMoney(supplierRemainingTotal)} ر.س`
        );

        setText(
            "supplierRemainingCount",
            `${formatNumber(countSuppliersWithRemaining())} مورد`
        );
    }

    function countCustomersWithRemaining() {
        const map = new Map();

        state.bookings.forEach((booking) => {
            const customerId =
                booking?.customer_id ??
                booking?.customerId ??
                booking?.customer?.id;

            if (!customerId) return;

            const total = bookingPayable(booking);

            const paid =
                getBookingPaidAmount(booking);

            const current =
                map.get(String(customerId)) || 0;

            map.set(
                String(customerId),
                current + Math.max(0, total - paid)
            );
        });

        let count = 0;

        map.forEach((balance) => {
            if (balance > 0.009) count++;
        });

        return count;
    }

    function countSuppliersWithRemaining() {
        const invoiceMap = new Map();
        const paymentMap = new Map();

        state.supplierInvoices.forEach((invoice) => {
            const supplierId =
                invoice?.supplier_id ??
                invoice?.supplierId ??
                invoice?.supplier?.id;

            if (!supplierId) return;

            const total =
                number(
                    invoice?.total_amount ??
                    invoice?.totalAmount ??
                    invoice?.amount
                );

            const key = String(supplierId);
            invoiceMap.set(
                key,
                (invoiceMap.get(key) || 0) + total
            );
        });

        state.supplierPayments.forEach((payment) => {
            const supplierId =
                payment?.supplier_id ??
                payment?.supplierId ??
                payment?.supplier?.id;

            if (!supplierId) return;

            const amount =
                number(payment?.amount);

            const key = String(supplierId);
            paymentMap.set(
                key,
                (paymentMap.get(key) || 0) + amount
            );
        });

        let count = 0;

        invoiceMap.forEach((invoiceTotal, key) => {
            const paid =
                paymentMap.get(key) || 0;

            if (invoiceTotal - paid > 0.009) {
                count++;
            }
        });

        return count;
    }

    /* ============================================================
       Operational Summary
    ============================================================ */

    function renderOperationalSummary() {
        const bookings = state.bookings;

        const bookingTotal = sumBy(bookings, bookingPayable);

        const confirmed =
            bookings.filter(
                (booking) =>
                    normalizeStatus(booking?.status) === "confirmed"
            ).length;

        const completed =
            bookings.filter(
                (booking) =>
                    normalizeStatus(booking?.status) === "completed"
            ).length;

        const cancelled =
            bookings.filter(
                (booking) =>
                    normalizeStatus(booking?.status) === "cancelled"
            ).length;

        const activeCustomerIds = new Set();

        bookings.forEach((booking) => {
            const id =
                booking?.customer_id ??
                booking?.customerId ??
                booking?.customer?.id;

            if (id) activeCustomerIds.add(String(id));
        });

        state.customerPayments.forEach((payment) => {
            const id =
                payment?.customer_id ??
                payment?.customerId ??
                payment?.customer?.id;

            if (id) activeCustomerIds.add(String(id));
        });

        setText(
            "bookingsSummaryCount",
            `${formatNumber(bookings.length)} حجز`
        );

        setText(
            "bookingsCount",
            formatNumber(bookings.length)
        );

        setText(
            "bookingsTotalAmount",
            `${formatMoney(bookingTotal)} ر.س`
        );

        setText(
            "confirmedBookingsCount",
            formatNumber(confirmed)
        );

        setText(
            "completedBookingsCount",
            formatNumber(completed)
        );

        setText(
            "cancelledBookingsCount",
            formatNumber(cancelled)
        );

        setText(
            "customersSummaryCount",
            `${formatNumber(activeCustomerIds.size)} عميل`
        );

        setText(
            "activeCustomersCount",
            formatNumber(activeCustomerIds.size)
        );

        setText(
            "customerInvoicesSummaryCount",
            formatNumber(bookings.length)
        );

        setText(
            "customerPaymentsSummaryCount",
            formatNumber(state.customerPayments.length)
        );

        setText(
            "customerRemainingSummary",
            `${formatMoney(periodBookingReceivables())} ر.س`
        );
    }

    /* ============================================================
       Bookings
    ============================================================ */

    function renderBookings() {
        const tbody =
            document.getElementById("bookingsReportTable");

        if (!tbody) return;

        setText(
            "bookingsTableCount",
            formatNumber(state.bookings.length)
        );

        if (!state.bookings.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        ${emptyHtml(
                            "لا توجد حجوزات",
                            "لا توجد حجوزات في الفترة المحددة",
                            "fa-calendar-xmark"
                        )}
                    </td>
                </tr>
            `;
            return;
        }

        const rows =
            [...state.bookings].sort((a, b) =>
                String(
                    normalizeDate(
                        b?.event_date ??
                        b?.eventDate
                    )
                ).localeCompare(
                    String(
                        normalizeDate(
                            a?.event_date ??
                            a?.eventDate
                        )
                    )
                )
            );

        tbody.innerHTML = rows.map((booking) => {
            const customer =
                booking?.customer ||
                findCustomer(
                    booking?.customer_id ??
                    booking?.customerId
                );

            const customerName =
                customer?.name ||
                booking?.customer_name ||
                booking?.customerName ||
                "عميل غير معروف";

            const customerPhone =
                customer?.phone ||
                booking?.customer_phone ||
                booking?.customerPhone ||
                "";

            const eventName =
                booking?.mark ||
                booking?.event_name ||
                booking?.eventName ||
                "مناسبة";

            const eventDate =
                normalizeDate(
                    booking?.event_date ??
                    booking?.eventDate
                );

            const total = bookingPayable(booking);

            const paid =
                getBookingPaidAmount(booking);

            const remaining =
                Math.max(0, total - paid);

            return `
                <tr>
                    <td>
                        <span class="report-id">
                            #${escapeHtml(booking?.id ?? "-")}
                        </span>
                    </td>

                    <td>
                        <div class="report-customer">
                            <div class="report-avatar">
                                ${escapeHtml(
                                    String(customerName).trim().charAt(0) || "ع"
                                )}
                            </div>

                            <div class="report-customer-info">
                                <div class="report-customer-name">
                                    ${escapeHtml(customerName)}
                                </div>

                                ${
                                    customerPhone
                                        ? `
                                            <div class="report-customer-phone">
                                                ${escapeHtml(customerPhone)}
                                            </div>
                                        `
                                        : ""
                                }
                            </div>
                        </div>
                    </td>

                    <td>
                        <div class="report-event">
                            <div class="report-event-title">
                                ${escapeHtml(eventName)}
                            </div>
                        </div>
                    </td>

                    <td>
                        <span>
                            ${formatDateDisplay(eventDate)}
                        </span>
                    </td>

                    <td>
                        <span class="money-cell">
                            ${formatMoney(total)} ر.س
                        </span>
                    </td>

                    <td>
                        <span class="money-cell paid">
                            ${formatMoney(paid)} ر.س
                        </span>
                    </td>

                    <td>
                        <span class="money-cell remaining">
                            ${formatMoney(remaining)} ر.س
                        </span>
                    </td>

                    <td>
                        ${statusBadge(booking?.status)}
                    </td>
                </tr>
            `;
        }).join("");
    }

    /* ============================================================
       Supplier Summary
    ============================================================ */

    function renderSupplierSummary() {
        const invoiceTotal =
            sumBy(state.supplierInvoices, (invoice) =>
                number(
                    invoice?.total_amount ??
                    invoice?.totalAmount ??
                    invoice?.amount
                )
            );

        const paymentTotal =
            sumBy(state.supplierPayments, (payment) =>
                number(payment?.amount)
            );

        const remaining = invoiceTotal - paymentTotal;

        setText(
            "suppliersInvoicesAmount",
            `${formatMoney(invoiceTotal)} ر.س`
        );

        setText(
            "suppliersPaymentsAmount",
            `${formatMoney(paymentTotal)} ر.س`
        );

        setText(
            "suppliersRemainingAmount",
            `${formatMoney(remaining)} ر.س`
        );
    }

    /* ============================================================
       Supplier Invoices
    ============================================================ */

    function renderSupplierInvoices() {
        const tbody =
            document.getElementById("supplierInvoicesReportTable");

        if (!tbody) return;

        setText(
            "supplierInvoicesTableCount",
            formatNumber(state.supplierInvoices.length)
        );

        if (!state.supplierInvoices.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        ${emptyHtml(
                            "لا توجد فواتير",
                            "لا توجد فواتير موردين في الفترة المحددة",
                            "fa-file-invoice"
                        )}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML =
            state.supplierInvoices.map((invoice) => {
                const supplier =
                    invoice?.supplier ||
                    findSupplier(
                        invoice?.supplier_id ??
                        invoice?.supplierId
                    );

                const supplierName =
                    supplier?.name ||
                    invoice?.supplier_name ||
                    "مورد غير معروف";

                const supplierPhone =
                    supplier?.phone ||
                    invoice?.supplier_phone ||
                    "";

                const invoiceNumber =
                    invoice?.invoice_number ??
                    invoice?.invoiceNumber ??
                    `#${invoice?.id ?? "-"}`;

                const date =
                    normalizeDate(
                        invoice?.invoice_date ??
                        invoice?.invoiceDate
                    );

                const amount =
                    number(
                        invoice?.total_amount ??
                        invoice?.totalAmount ??
                        invoice?.amount
                    );

                const details = invoice?.details ?? invoice?.notes ?? "—";

                return `
                    <tr>
                        <td>
                            <strong>
                                ${escapeHtml(invoiceNumber)}
                            </strong>
                        </td>

                        <td>
                            <div class="report-main-cell">
                                ${escapeHtml(supplierName)}
                            </div>

                            ${
                                supplierPhone
                                    ? `
                                        <div class="report-sub-cell">
                                            ${escapeHtml(supplierPhone)}
                                        </div>
                                    `
                                    : ""
                            }
                        </td>

                        <td>
                            ${formatDateDisplay(date)}
                        </td>

                        <td>
                            <span class="money-cell">
                                ${formatMoney(amount)} ر.س
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(details)}
                        </td>
                    </tr>
                `;
            }).join("");
    }

    /* ============================================================
       Customer Payments
    ============================================================ */

    function renderCustomerPayments() {
        const tbody =
            document.getElementById("customerPaymentsReportTable");

        if (!tbody) return;

        setText(
            "customerPaymentsTableCount",
            formatNumber(state.customerPayments.length)
        );

        if (!state.customerPayments.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        ${emptyHtml(
                            "لا توجد دفعات",
                            "لا توجد دفعات عملاء في الفترة المحددة",
                            "fa-money-bill-wave"
                        )}
                    </td>
                </tr>
            `;
            return;
        }

        const rows =
            [...state.customerPayments].sort((a, b) =>
                String(
                    normalizeDate(
                        b?.payment_date ??
                        b?.paymentDate
                    )
                ).localeCompare(
                    String(
                        normalizeDate(
                            a?.payment_date ??
                            a?.paymentDate
                        )
                    )
                )
            );

        tbody.innerHTML = rows.map((payment) => {
            const customer =
                payment?.customer ||
                findCustomer(
                    payment?.customer_id ??
                    payment?.customerId
                );

            const customerName =
                customer?.name ||
                payment?.customer_name ||
                "عميل غير معروف";

            const bookingId =
                payment?.booking_id ??
                payment?.bookingId ??
                null;

            const date =
                normalizeDate(
                    payment?.payment_date ??
                    payment?.paymentDate
                );

            const amount =
                number(payment?.amount);

            return `
                <tr>
                    <td>#${escapeHtml(payment?.id ?? "-")}</td>

                    <td>
                        <div class="report-main-cell">
                            ${escapeHtml(customerName)}
                        </div>

                        ${
                            customer?.phone
                                ? `
                                    <div class="report-sub-cell">
                                        ${escapeHtml(customer.phone)}
                                    </div>
                                `
                                : ""
                        }
                    </td>

                    <td>
                        ${
                            bookingId
                                ? `
                                    <span class="report-reference">
                                        #${escapeHtml(bookingId)}
                                    </span>
                                `
                                : "بدون حجز"
                        }
                    </td>

                    <td>${formatDateDisplay(date)}</td>

                    <td>
                        ${escapeHtml(
                            getPaymentMethodName(payment)
                        )}
                    </td>

                    <td>
                        <span class="money-cell paid">
                            ${formatMoney(amount)} ر.س
                        </span>
                    </td>

                </tr>
            `;
        }).join("");
    }

    /* ============================================================
       Supplier Payments
    ============================================================ */

    function renderSupplierPayments() {
        const tbody =
            document.getElementById("supplierPaymentsReportTable");

        if (!tbody) return;

        setText(
            "supplierPaymentsTableCount",
            formatNumber(state.supplierPayments.length)
        );

        if (!state.supplierPayments.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        ${emptyHtml(
                            "لا توجد دفعات",
                            "لا توجد دفعات موردين في الفترة المحددة",
                            "fa-money-check-dollar"
                        )}
                    </td>
                </tr>
            `;
            return;
        }

        const rows =
            [...state.supplierPayments].sort((a, b) =>
                String(
                    normalizeDate(
                        b?.payment_date ??
                        b?.paymentDate
                    )
                ).localeCompare(
                    String(
                        normalizeDate(
                            a?.payment_date ??
                            a?.paymentDate
                        )
                    )
                )
            );

        tbody.innerHTML = rows.map((payment) => {
            const supplier =
                payment?.supplier ||
                findSupplier(
                    payment?.supplier_id ??
                    payment?.supplierId
                );

            const supplierName =
                supplier?.name ||
                payment?.supplier_name ||
                "مورد غير معروف";

            const date =
                normalizeDate(
                    payment?.payment_date ??
                    payment?.paymentDate
                );

            const amount =
                number(payment?.amount);

            return `
                <tr>
                    <td>#${escapeHtml(payment?.id ?? "-")}</td>

                    <td>
                        <div class="report-main-cell">
                            ${escapeHtml(supplierName)}
                        </div>

                        ${
                            supplier?.phone
                                ? `
                                    <div class="report-sub-cell">
                                        ${escapeHtml(supplier.phone)}
                                    </div>
                                `
                                : ""
                        }
                    </td>



                    <td>${formatDateDisplay(date)}</td>

                    <td>
                        ${escapeHtml(
                            getPaymentMethodName(payment)
                        )}
                    </td>

                    <td>
                        <span class="money-cell paid">
                            ${formatMoney(amount)} ر.س
                        </span>
                    </td>

                </tr>
            `;
        }).join("");
    }

    /* ============================================================
       Final Summary
    ============================================================ */

    function renderFinalFinancialSummary() {
        const customerReceipts =
            number(
                state.financial.customer_payments_total
            );

        const supplierPayments =
            number(
                state.financial.supplier_payments_total
            );

        const netMovement =
            customerReceipts -
            supplierPayments;

        setText(
            "footerCustomerPayments",
            `${formatMoney(customerReceipts)} ر.س`
        );

        setText(
            "footerSupplierPayments",
            `${formatMoney(supplierPayments)} ر.س`
        );

        setText(
            "footerNetMovement",
            `${formatMoney(netMovement)} ر.س`
        );
    }

    /* ============================================================
       Booking Payment Calculation
    ============================================================ */

    function getBookingPaidAmount(booking) {
        if (
            booking?.paid_amount !== undefined &&
            booking?.paid_amount !== null
        ) {
            return number(booking.paid_amount);
        }

        if (
            booking?.paidAmount !== undefined &&
            booking?.paidAmount !== null
        ) {
            return number(booking.paidAmount);
        }

        if (
            booking?.payments_sum_amount !== undefined &&
            booking?.payments_sum_amount !== null
        ) {
            return number(
                booking.payments_sum_amount
            );
        }

        const payments =
            booking?.payments ||
            booking?.customer_payments ||
            booking?.customerPayments;

        if (Array.isArray(payments)) {
            return payments.reduce(
                (total, payment) =>
                    total + number(payment?.amount),
                0
            );
        }

        if (booking?.id) {
            return state.customerPayments.reduce(
                (total, payment) => {
                    const bookingId =
                        payment?.booking_id ??
                        payment?.bookingId;

                    return String(bookingId) ===
                        String(booking.id)
                        ? total + number(payment?.amount)
                        : total;
                },
                0
            );
        }

        return 0;
    }

    /* ============================================================
       Lookups
    ============================================================ */

    function findCustomer(id) {
        if (!id) return null;

        return state.customers.find(
            (customer) =>
                String(customer?.id) === String(id)
        ) || null;
    }

    function findSupplier(id) {
        if (!id) return null;

        return state.suppliers.find(
            (supplier) =>
                String(supplier?.id) === String(id)
        ) || null;
    }

    function findBooking(id) {
        if (!id) return null;

        return state.bookings.find(
            (booking) =>
                String(booking?.id) === String(id)
        ) || null;
    }

    function getPaymentMethodName(payment) {
        return (
            payment?.payment_method?.name ||
            payment?.payment_method?.title ||
            payment?.paymentMethod?.name ||
            payment?.paymentMethod?.title ||
            payment?.payment_method_name ||
            PAYMENT_METHOD_FALLBACK
        );
    }

    /* ============================================================
       Status
    ============================================================ */

    function normalizeStatus(value) {
        const raw =
            String(value ?? "")
                .trim()
                .toLowerCase();

        if (raw === "جديد") return "new";
        if (raw === "مؤكد") return "confirmed";
        if (raw === "مكتمل") return "completed";
        if (raw === "ملغي" || raw === "ملغى") {
            return "cancelled";
        }
        if (raw === "معلق") return "pending";

        return STATUS_LABELS[raw]
            ? raw
            : "new";
    }

    function statusBadge(value) {
        const status =
            normalizeStatus(value);

        const label =
            STATUS_LABELS[status] ||
            String(value || "-");

        const icon =
            STATUS_ICONS[status] ||
            "fa-circle";

        const className =
            STATUS_CLASS_MAP[status] ||
            "new";

        return `
            <span class="report-status ${escapeAttribute(className)}">
                <i class="fas ${escapeAttribute(icon)}"></i>
                ${escapeHtml(label)}
            </span>
        `;
    }

    /* ============================================================
       Loading / Error / Status
    ============================================================ */

    function renderLoading() {
        const ids = [
            "bookingsReportTable",
            "supplierInvoicesReportTable",
            "customerPaymentsReportTable",
            "supplierPaymentsReportTable",
        ];

        const loadingHtml = `
            <div class="report-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <strong>جاري تحميل التقرير...</strong>
            </div>
        `;

        ids.forEach((id) => {
            const element =
                document.getElementById(id);

            if (!element) return;

            const colspan =
                element
                    .closest("table")
                    ?.querySelectorAll("thead th")
                    .length || 5;

            element.innerHTML = `
                <tr>
                    <td colspan="${colspan}">
                        ${loadingHtml}
                    </td>
                </tr>
            `;
        });

        const valueIds = [
            "reportPlateDeposits", "reportPlateReturns", "reportPlatePending",
            "totalInvoicesAmount",
            "totalCustomerPayments",
            "totalCustomerRemaining",
            "totalSupplierInvoices",
            "customerInvoicesTotal",
            "customerPaymentsTotal",
            "customerRemainingTotal",
            "supplierInvoicesTotal",
            "supplierPaymentsTotal",
            "supplierRemainingTotal",
            "bookingsCount",
            "bookingsTotalAmount",
            "confirmedBookingsCount",
            "completedBookingsCount",
            "cancelledBookingsCount",
            "activeCustomersCount",
            "customerInvoicesSummaryCount",
            "customerPaymentsSummaryCount",
            "customerRemainingSummary",
            "suppliersInvoicesAmount",
            "suppliersPaymentsAmount",
            "suppliersRemainingAmount",
            "footerCustomerPayments",
            "footerSupplierPayments",
            "footerNetMovement",
        ];

        valueIds.forEach((id) => {
            setText(id, "—");
        });
    }

    function renderError(message) {
        const ids = [
            "bookingsReportTable",
            "supplierInvoicesReportTable",
            "customerPaymentsReportTable",
            "supplierPaymentsReportTable",
        ];

        ids.forEach((id) => {
            const element =
                document.getElementById(id);

            if (!element) return;

            const colspan =
                element
                    .closest("table")
                    ?.querySelectorAll("thead th")
                    .length || 5;

            element.innerHTML = `
                <tr>
                    <td colspan="${colspan}">
                        ${emptyHtml(
                            "تعذر تحميل التقرير",
                            message,
                            "fa-triangle-exclamation"
                        )}
                    </td>
                </tr>
            `;
        });

        updateStatus(
            "تعذر تحميل التقرير",
            message
        );
    }

    function updateStatus(title, description) {
        setText("reportStatusTitle", title);
        setText(
            "reportStatusDescription",
            description
        );
    }

    function emptyHtml(title, description, icon) {
        return `
            <div class="report-empty">
                <div class="report-empty-icon">
                    <i class="fas ${escapeAttribute(icon)}"></i>
                </div>

                <strong>
                    ${escapeHtml(title)}
                </strong>

                <span>
                    ${escapeHtml(description)}
                </span>
            </div>
        `;
    }

    /* ============================================================
       Share / Export
    ============================================================ */

    async function shareReport() {
        if (!state.lastSuccessful || state.loading) { showToast("التقرير غير مكتمل، حدّث البيانات أولًا"); return; }
        const text = buildShareText();

        if (
            navigator.share &&
            typeof navigator.share === "function"
        ) {
            try {
                await navigator.share({
                    title: "تقرير شواطئ عدن",
                    text,
                });
                return;
            } catch (error) {
                if (error?.name === "AbortError") {
                    return;
                }
            }
        }

        try {
            await navigator.clipboard.writeText(text);
            showToast("تم نسخ التقرير للمشاركة");
        } catch {
            showToast("تعذر مشاركة التقرير");
        }
    }

    function buildShareText() {
        const f = state.financial;

        return [
            "تقرير شواطئ عدن",
            `الفترة: ${formatDateDisplay(state.range.start)} - ${formatDateDisplay(state.range.end)}`,
            "",
            "الحجوزات",
            `عدد الحجوزات: ${formatNumber(state.bookings.length)}`,
            `المطلوب لحجوزات الفترة (شامل التأمين): ${formatMoney(sumBy(state.bookings, bookingPayable))} ر.س`,
            `المقبوض من العملاء: ${formatMoney(f.customer_payments_total)} ر.س`,
            `متبقي حجوزات الفترة حتى الآن: ${formatMoney(periodBookingReceivables())} ر.س`,
            "",
            "الموردون",
            `عدد فواتير الموردين: ${formatNumber(state.supplierInvoices.length)}`,
            `إجمالي الفواتير: ${formatMoney(f.purchases_total)} ر.س`,
            `المدفوع للموردين: ${formatMoney(f.supplier_payments_total)} ر.س`,
            `فرق فواتير ومدفوعات الموردين في الفترة: ${formatMoney(f.supplier_balance)} ر.س`,
            "",
            "الحركة المالية (لا تشمل رد التأمين غير المؤرخ)",
            `صافي الحركة: ${formatMoney(f.customer_payments_total - f.supplier_payments_total)} ر.س`,
        ].join("\n");
    }

    function exportCSV() {
        if (!state.lastSuccessful || state.loading) { showToast("التقرير غير مكتمل، حدّث البيانات أولًا"); return; }
        const rows = [];

        state.bookings.forEach((booking) => {
            rows.push([
                "حجز",
                booking.id,
                getCustomerDisplayName(booking),
                normalizeDate(
                    booking.event_date ??
                    booking.eventDate
                ),
                bookingPayable(booking),
                getBookingPaidAmount(booking),
                Math.max(
                    0,
                    bookingPayable(booking) -
                    getBookingPaidAmount(booking)
                ),
                STATUS_LABELS[
                    normalizeStatus(booking.status)
                ] || booking.status,
            ]);
        });

        state.supplierInvoices.forEach((invoice) => {
            rows.push([
                "فاتورة مورد",
                invoice.id,
                getSupplierDisplayName(invoice),
                normalizeDate(
                    invoice.invoice_date ??
                    invoice.invoiceDate
                ),
                number(
                    invoice.total_amount ??
                    invoice.totalAmount ??
                    invoice.amount
                ),
                "",
                "",
                invoice.status || "",
            ]);
        });

        state.customerPayments.forEach((payment) => {
            rows.push([
                "دفعة عميل",
                payment.id,
                getCustomerDisplayName(payment),
                normalizeDate(
                    payment.payment_date ??
                    payment.paymentDate
                ),
                number(payment.amount),
                "",
                "",
                getPaymentMethodName(payment),
            ]);
        });

        state.supplierPayments.forEach((payment) => {
            rows.push([
                "دفعة مورد",
                payment.id,
                getSupplierDisplayName(payment),
                normalizeDate(
                    payment.payment_date ??
                    payment.paymentDate
                ),
                number(payment.amount),
                "",
                "",
                getPaymentMethodName(payment),
            ]);
        });

        if (!rows.length) {
            showToast("لا توجد بيانات لتصديرها");
            return;
        }

        const header = [
            "النوع",
            "الرقم",
            "الاسم",
            "التاريخ",
            "المبلغ",
            "المدفوع",
            "المتبقي",
            "الحالة / طريقة الدفع",
        ];

        const csv = "\uFEFF" +
            [header, ...rows]
                .map((row) =>
                    row.map(csvCell).join(",")
                )
                .join("\r\n");

        downloadFile(
            csv,
            `report-${state.range.start}-${state.range.end}.csv`,
            "text/csv;charset=utf-8"
        );

        showToast("تم تصدير التقرير بصيغة CSV");
    }

    function exportJSON() {
        if (!state.lastSuccessful || state.loading) { showToast("التقرير غير مكتمل، حدّث البيانات أولًا"); return; }
        const data = {
            report: "banquet-kitchen",
            period: {
                from: state.range.start,
                to: state.range.end,
            },
            financial: {
                ...state.financial,
            },
            statistics: {
                bookings: state.bookings.length,
                customers: getActiveCustomerCount(),
                suppliers: getActiveSupplierCount(),
                customer_payments:
                    state.customerPayments.length,
                supplier_invoices:
                    state.supplierInvoices.length,
                supplier_payments:
                    state.supplierPayments.length,
            },
            bookings: state.bookings,
            customer_payments: state.customerPayments,
            supplier_invoices: state.supplierInvoices,
            supplier_payments: state.supplierPayments,
        };

        downloadFile(
            JSON.stringify(data, null, 2),
            `report-${state.range.start}-${state.range.end}.json`,
            "application/json;charset=utf-8"
        );

        showToast("تم تصدير التقرير بصيغة JSON");
    }

    /* ============================================================
       Helpers
    ============================================================ */

    function getCustomerDisplayName(record) {
        const customer =
            record?.customer ||
            findCustomer(
                record?.customer_id ??
                record?.customerId
            );

        return (
            customer?.name ||
            record?.customer_name ||
            record?.customerName ||
            "عميل غير معروف"
        );
    }

    function getSupplierDisplayName(record) {
        const supplier =
            record?.supplier ||
            findSupplier(
                record?.supplier_id ??
                record?.supplierId
            );

        return (
            supplier?.name ||
            record?.supplier_name ||
            record?.supplierName ||
            "مورد غير معروف"
        );
    }

    function getActiveCustomerCount() {
        const ids = new Set();

        state.bookings.forEach((booking) => {
            const id =
                booking?.customer_id ??
                booking?.customerId ??
                booking?.customer?.id;

            if (id) ids.add(String(id));
        });

        state.customerPayments.forEach((payment) => {
            const id =
                payment?.customer_id ??
                payment?.customerId ??
                payment?.customer?.id;

            if (id) ids.add(String(id));
        });

        return ids.size;
    }

    function getActiveSupplierCount() {
        const ids = new Set();

        state.supplierInvoices.forEach((invoice) => {
            const id =
                invoice?.supplier_id ??
                invoice?.supplierId ??
                invoice?.supplier?.id;

            if (id) ids.add(String(id));
        });

        state.supplierPayments.forEach((payment) => {
            const id =
                payment?.supplier_id ??
                payment?.supplierId ??
                payment?.supplier?.id;

            if (id) ids.add(String(id));
        });

        return ids.size;
    }

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function setInputValue(id, value) {
        const input =
            document.getElementById(id);

        if (input) {
            input.value = value;
        }
    }

    function formatDate(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
        ].join("-");
    }

    function normalizeDate(value) {
        if (!value) return "";

        return String(value)
            .trim()
            .substring(0, 10);
    }

    function isDateInRange(date, start, end) {
        if (!date || !start || !end) return false;

        return date >= start && date <= end;
    }

    function formatDateDisplay(value) {
        if (!value) return "—";

        const parts =
            String(value)
                .substring(0, 10)
                .split("-");

        if (parts.length !== 3) {
            return escapeHtml(value);
        }

        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatMoney(value) {
        return new Intl.NumberFormat("ar-SA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(number(value));
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("ar-SA")
            .format(number(value));
    }

    function number(value) {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function sumBy(items, callback) {
        return items.reduce(
            (total, item) =>
                total + number(callback(item)),
            0
        );
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

    function csvCell(value) {
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }

    function downloadFile(content, filename, type) {
        const blob =
            new Blob([content], { type });

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement("a");

        anchor.href = url;
        anchor.download = filename;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    function showToast(message) {
        if (
            window.Utils &&
            typeof window.Utils.showToast === "function"
        ) {
            window.Utils.showToast(message);
            return;
        }

        const container =
            document.getElementById("toastContainer");

        if (!container) return;

        container.innerHTML = `
            <div class="toast">
                ${escapeHtml(message)}
            </div>
        `;

        setTimeout(() => {
            container.innerHTML = "";
        }, 3000);
    }
})();
