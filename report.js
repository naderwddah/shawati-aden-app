// ============================================================
// شواطئ عدن - تقرير الفواتير (report.js) - الفلترة المصححة 100%
// ============================================================

const API_BASE = "https://cafe.technova.fun/api";
let authToken = localStorage.getItem("auth_token") || null;
let currentReportData = [];

// ============================================================
// 1. التواريخ الافتراضية
// ============================================================
function setDefaultDates() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    document.getElementById('fromDate').value = formatDateInput(from);
    document.getElementById('toDate').value = formatDateInput(today);
}

function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ✅ تم الاستغناء عن كائن Date لتفادي أي أخطاء في فروق التوقيت
function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    try {
        let cleanDate = dateStr.split('T')[0];
        if (cleanDate.includes('/')) return cleanDate; // إذا كان منسقاً مسبقاً
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`; // تحويله لصيغة يوم/شهر/سنة
        }
        return cleanDate;
    } catch { return dateStr; }
}

// ============================================================
// 2. الأزرار السريعة
// ============================================================
function setQuickDate(type) {
    const today = new Date();
    let from = new Date(today);
    if (type === 'today') { /* اليوم */ }
    else if (type === 'week') from.setDate(today.getDate() - 7);
    else if (type === 'month') from.setDate(today.getDate() - 30);
    document.getElementById('fromDate').value = formatDateInput(from);
    document.getElementById('toDate').value = formatDateInput(today);
    fetchAndRender();
}

// ============================================================
// 3. جلب البيانات
// ============================================================
async function fetchBookings() {
    if (!authToken) {
        showToast('⚠️ الرجاء تسجيل الدخول أولاً');
        return [];
    }
    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (data.success) return data.data || [];
        else { showToast('❌ فشل في جلب البيانات'); return []; }
    } catch (e) {
        console.error(e);
        showToast('⚠️ خطأ في الاتصال بالخادم');
        return [];
    }
}

// ============================================================
// 4. فلترة البيانات (مقارنة نصوص قوية ودقيقة 100%)
// ============================================================
function filterDataByDate(bookings, fromDate, toDate) {
    if (!fromDate || !toDate) return bookings;
    
    return bookings.filter(b => {
        // 🚫 استبعاد الحجوزات الملغية
        if (b.status === 'cancelled') return false;

        // البحث عن حقل التاريخ أياً كان المسمى القادم من الباك إند
        let rawDate = b.booking?.date || b.booking_date || b.created_at || b.createdAt;
        if (!rawDate) return false;
        
        // استخراج الجزء الخاص بالتاريخ فقط (سنة-شهر-يوم)
        let cleanDate = rawDate.split('T')[0];
        
        // لو افترضنا أن التاريخ جاء معكوساً (يوم/شهر/سنة)، نقوم بقلبه للمقارنة الصحيحة
        if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
                cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        // 🌟 المقارنة النصية المباشرة (تفصل بين التواريخ بدقة ولا تتأثر بموقع العميل)
        return cleanDate >= fromDate && cleanDate <= toDate;
    });
}

// ============================================================
// 5. حساب الإحصائيات الدقيقة
// ============================================================
function calculateStats(bookings) {
    let totalRevenue = 0, totalPaid = 0, totalRemaining = 0;
    
    bookings.forEach(b => {
        // الإجمالي الحقيقي (إجمالي الطلبات بدون التأمين)
        const total = parseFloat(b.total_orders || b.total_amount || 0);
        
        // المتبقي الفعلي الموثق من قاعدة البيانات
        const remaining = parseFloat(b.remaining || b.finance?.remaining || 0);
        
        // استنتاج المدفوع لتجنب أي تداخل مع التأمين
        const paid = Math.max(0, total - remaining);
        
        totalRevenue += total;
        totalPaid += paid;
        totalRemaining += remaining;
    });
    
    return {
        totalRevenue, totalPaid, totalRemaining,
        totalCount: bookings.length
    };
}

// ============================================================
// 6. عرض البيانات في الجدول
// ============================================================
function renderReport(bookings, stats) {
    document.getElementById('totalRevenue').textContent = stats.totalRevenue.toFixed(2);
    document.getElementById('totalPaid').textContent = stats.totalPaid.toFixed(2);
    document.getElementById('totalRemaining').textContent = stats.totalRemaining.toFixed(2);
    document.getElementById('totalCount').textContent = stats.totalCount;

    const tbody = document.getElementById('tableBody');
    const tfoot = document.getElementById('tableFoot');
    
    if (bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#8a7a70; font-weight:bold;">📭 لا توجد فواتير للفترة المحددة</td></tr>`;
        tfoot.style.display = 'none';
        return;
    }

    let rows = '';
    bookings.forEach((b, index) => {
        const total = parseFloat(b.total_orders || b.total_amount || 0);
        const remaining = parseFloat(b.remaining || b.finance?.remaining || 0);
        const paid = Math.max(0, total - remaining);

        const isPaid = (remaining <= 0);
        const statusBadge = isPaid
            ? '<span class="badge-paid"><i class="fas fa-check"></i> خالص</span>'
            : '<span class="badge-unpaid"><i class="fas fa-clock"></i> آجل / متبقي</span>';
        
        const remainingClass = remaining <= 0 ? 'remaining-zero' : 'remaining-positive';

        rows += `
            <tr>
                <td>${index + 1}</td>
                <td style="font-weight:800; color:#b8860b;">${b.customer?.name || b.customer_name || '-'}</td>
                <td>${formatDateDisplay(b.booking?.date || b.booking_date || b.createdAt)}</td>
                <td style="font-weight: 700;">${total.toFixed(2)}</td>
                <td style="color:#2e8b57; font-weight:700;">${paid.toFixed(2)}</td>
                <td class="${remainingClass}">${remaining.toFixed(2)}</td>
                <td>${b.payment?.method || b.payment_method || 'نقدي'}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
    tfoot.style.display = 'table-footer-group';
    tfoot.innerHTML = `
        <tr class="total-row">
            <td colspan="3" style="text-align:left; padding-left:16px;">الإجمالي الكلي للفترة</td>
            <td>${stats.totalRevenue.toFixed(2)}</td>
            <td style="color:#2ecc71;">${stats.totalPaid.toFixed(2)}</td>
            <td style="color:#e74c3c;">${stats.totalRemaining.toFixed(2)}</td>
            <td colspan="2"></td>
        </tr>
    `;

    // حفظ البيانات لصفحة المعاينة والتصدير
    currentReportData = bookings.map(b => {
        const total = parseFloat(b.total_orders || b.total_amount || 0);
        const remaining = parseFloat(b.remaining || b.finance?.remaining || 0);
        const paid = Math.max(0, total - remaining);
        return {
            id: b.id,
            customer: b.customer?.name || b.customer_name || '-',
            date: formatDateDisplay(b.booking?.date || b.booking_date || b.createdAt),
            total: total,
            paid: paid,
            remaining: remaining,
            method: b.payment?.method || b.payment_method || 'نقدي',
            status: remaining <= 0 ? 'خالص' : 'آجل'
        };
    });
}

// ============================================================
// 7. الدالة الرئيسية (تحديث وعرض)
// ============================================================
async function fetchAndRender() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (!from || !to) {
        showToast('⚠️ يرجى تحديد نطاق التاريخ');
        return;
    }
    showToast('⏳ جاري إعداد التقرير...');
    
    const bookings = await fetchBookings();
    if (!bookings || bookings.length === 0) {
        renderReport([], { totalRevenue:0, totalPaid:0, totalRemaining:0, totalCount:0 });
        return;
    }
    
    const filtered = filterDataByDate(bookings, from, to);
    const stats = calculateStats(filtered);
    renderReport(filtered, stats);
}

// ============================================================
// 8. فتح صفحة المعاينة
// ============================================================
function openPreview() {
    if (currentReportData.length === 0) {
        showToast('⚠️ لا توجد بيانات للمعاينة');
        return;
    }

    const stats = {
        totalRevenue: currentReportData.reduce((s, r) => s + r.total, 0),
        totalPaid: currentReportData.reduce((s, r) => s + r.paid, 0),
        totalRemaining: currentReportData.reduce((s, r) => s + r.remaining, 0),
        totalCount: currentReportData.length
    };

    const reportData = {
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        stats: stats,
        items: currentReportData,
        restaurant: JSON.parse(localStorage.getItem('restaurant_data')) || {
            name: 'شواطئ عدن',
            logo: '',
            address: 'جدة . شارع جاك جوار كودو',
            phone: '0550724459'
        }
    };

    localStorage.setItem('report_preview_data', JSON.stringify(reportData));
    window.open('report_preview.html', '_blank');
}

// ============================================================
// 9. رسائل التنبيه Toast
// ============================================================
function showToast(msg) {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: #1e1a17; color: #fff; padding: 12px 24px; border-radius: 12px;
        font-weight: 700; font-size: 14px; z-index: 9999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2); border: 1px solid rgba(255,215,0,0.2);
        animation: slideUp 0.3s ease-out; text-align: center;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// ============================================================
// 10. التشغيل الأولي
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    if (!authToken) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً');
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#c0392b; font-weight:bold;">🔒 الرجاء تسجيل الدخول</td></tr>`;
        return;
    }
    setDefaultDates();
    fetchAndRender();
});