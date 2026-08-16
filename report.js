// ============================================================
// report.js - تقارير الفواتير (شواطئ عدن) - النسخة المعدلة
// فصل تأمين الصحون عن الحسابات المالية الأساسية
// ============================================================

(function() {
  "use strict";

  // ---------------------------------------------
  // 1. الثوابت والمتغيرات العامة
  // ---------------------------------------------
  const API_BASE = "https://cafe.technova.fun/api";
  let authToken = localStorage.getItem("auth_token") || null;
  let currentReportData = [];

  // ---------------------------------------------
  // 2. التواريخ الافتراضية (اليوم)
  // ---------------------------------------------
  function setDefaultDates() {
    const today = new Date();
    const todayStr = formatDateInput(today);
    document.getElementById('fromDate').value = todayStr;
    document.getElementById('toDate').value = todayStr;
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  // ---------------------------------------------
  // 3. الأزرار السريعة
  // ---------------------------------------------
  window.setQuickDate = function(type) {
    const today = new Date();
    let from = new Date(today);
    if (type === 'today') {
      // من اليوم إلى اليوم
    } else if (type === 'week') {
      from.setDate(today.getDate() - 7);
    } else if (type === 'month') {
      from.setDate(today.getDate() - 30);
    }
    document.getElementById('fromDate').value = formatDateInput(from);
    document.getElementById('toDate').value = formatDateInput(today);
    window.fetchAndRender();
  };

  // ---------------------------------------------
  // 4. جلب البيانات من الـ API
  // ---------------------------------------------
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
      const result = await response.json();
      if (result.success) {
        return result.data || [];
      } else {
        showToast('❌ فشل في جلب البيانات');
        return [];
      }
    } catch (error) {
      console.error('API Error:', error);
      showToast('⚠️ خطأ في الاتصال بالخادم');
      return [];
    }
  }

  // ---------------------------------------------
  // 5. فلترة البيانات حسب التاريخ
  // ---------------------------------------------
  function filterByDate(bookings, fromDate, toDate) {
    if (!fromDate || !toDate) return bookings;
    const from = new Date(fromDate);
    from.setHours(0,0,0,0);
    const to = new Date(toDate);
    to.setHours(23,59,59,999);

    return bookings.filter(b => {
      let dateStr = b.booking?.date || b.booking_date || b.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= from && d <= to;
    });
  }

  // ---------------------------------------------
  // 6. حساب الإحصائيات (مع فصل التأمين)
  // ---------------------------------------------
  function calculateStats(bookings) {
    let totalOrders = 0;      // مجموع total_orders (قيمة الطلبات الفعلية)
    let totalPaid = 0;        // مجموع deposit_paid (المدفوعات الفعلية من العميل)
    let totalDeposit = 0;     // مجموع plates_deposit (تأمين الصحون)
    let totalRemaining = 0;   // المتبقي الفعلي = totalOrders - (totalPaid - totalDeposit)
    let paidCount = 0;
    let unpaidCount = 0;

    bookings.forEach(b => {
      // قراءة القيم من عدة مصادر محتملة
      const orders = parseFloat(b.total_orders || b.finance?.totalOrders || 0);
      const deposit = parseFloat(b.platesDeposit || b.plates_deposit || 0);
      const paid = parseFloat(b.deposit_paid || b.finance?.deposit || 0);
      
      // حساب المتبقي الصحيح (على أساس الطلبات فقط)
      const netPaid = Math.max(0, paid - deposit); // المدفوع الصافي (بدون التأمين)
      const remaining = Math.max(0, orders - netPaid);

      totalOrders += orders;
      totalPaid += paid;           // المدفوع الإجمالي (يشمل التأمين)
      totalDeposit += deposit;
      totalRemaining += remaining;

      if (remaining === 0) {
        paidCount++;
      } else {
        unpaidCount++;
      }
    });

    // إجمالي المدفوع الصافي (المحصل في الصندوق بدون التأمين)
    const netPaidTotal = totalPaid - totalDeposit;

    return {
      totalOrders,           // إجمالي الطلبات
      totalPaid,             // إجمالي المدفوع (مع التأمين)
      totalDeposit,          // إجمالي تأمين الصحون
      totalRemaining,        // إجمالي المتبقي (الصحيح)
      netPaidTotal,          // المدفوع الصافي (بدون التأمين)
      totalCount: bookings.length,
      paidCount,
      unpaidCount,
      collectionRate: totalOrders > 0 ? (netPaidTotal / totalOrders) * 100 : 0
    };
  }

  // ---------------------------------------------
  // 7. عرض البيانات في الواجهة
  // ---------------------------------------------
  function renderReport(bookings, stats) {
    // تحديث البطاقات
    document.getElementById('totalRevenue').textContent = stats.totalOrders.toFixed(2);
    document.getElementById('totalPaid').textContent = stats.netPaidTotal.toFixed(2);
    document.getElementById('totalRemaining').textContent = stats.totalRemaining.toFixed(2);
    document.getElementById('totalCount').textContent = stats.totalCount;

    // إضافة بطاقة تأمين الصحون (إذا كانت موجودة في الـ HTML)
    const depositCard = document.getElementById('totalDeposit');
    if (depositCard) {
      depositCard.textContent = stats.totalDeposit.toFixed(2);
    }

    // الجدول
    const tbody = document.getElementById('tableBody');
    const tfoot = document.getElementById('tableFoot');

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#8a7a70; font-weight:bold;">📭 لا توجد بيانات للفترة المحددة</td></tr>`;
      tfoot.style.display = 'none';
      currentReportData = [];
      return;
    }

    let rows = '';
    let sumOrders = 0, sumPaid = 0, sumRemaining = 0, sumDeposit = 0;

    bookings.forEach((b, index) => {
      const orders = parseFloat(b.total_orders || b.finance?.totalOrders || 0);
      const deposit = parseFloat(b.platesDeposit || b.plates_deposit || 0);
      const paid = parseFloat(b.deposit_paid || b.finance?.deposit || 0);
      const netPaid = Math.max(0, paid - deposit);
      const remaining = Math.max(0, orders - netPaid);

      sumOrders += orders;
      sumPaid += paid;
      sumDeposit += deposit;
      sumRemaining += remaining;

      const isPaid = (remaining === 0);
      const statusBadge = isPaid
        ? '<span class="badge-paid">✅ مدفوع</span>'
        : '<span class="badge-unpaid">⏳ آجل</span>';
      const remainingClass = (remaining === 0) ? 'remaining-zero' : 'remaining-positive';

      rows += `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td style="font-weight:700;">${b.customer?.name || b.customer_name || '-'}</td>
          <td>${formatDateDisplay(b.booking?.date || b.booking_date || b.createdAt)}</td>
          <td style="font-weight:800;">${orders.toFixed(2)}</td>
          <td>${paid.toFixed(2)}</td>
          <td class="${remainingClass}">${remaining.toFixed(2)}</td>
          <td style="font-weight:800; color:#b8860b;">${deposit.toFixed(2)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;

    // صف الإجمالي التراكمي
    tfoot.style.display = 'table-footer-group';
    tfoot.innerHTML = `
      <tr class="total-row">
        <td colspan="3" style="text-align:left; padding-right:20px; font-weight:900;">📊 الإجمالي التراكمي</td>
        <td style="font-weight:900;">${sumOrders.toFixed(2)}</td>
        <td style="font-weight:900;">${sumPaid.toFixed(2)}</td>
        <td style="font-weight:900;">${sumRemaining.toFixed(2)}</td>
        <td style="font-weight:900; color:#b8860b;">${sumDeposit.toFixed(2)}</td>
        <td></td>
      </tr>
    `;

    // حفظ البيانات للتصدير
    currentReportData = bookings.map(b => {
      const orders = parseFloat(b.total_orders || b.finance?.totalOrders || 0);
      const deposit = parseFloat(b.platesDeposit || b.plates_deposit || 0);
      const paid = parseFloat(b.deposit_paid || b.finance?.deposit || 0);
      const netPaid = Math.max(0, paid - deposit);
      const remaining = Math.max(0, orders - netPaid);
      return {
        id: b.id,
        customer: b.customer?.name || b.customer_name || '-',
        date: formatDateDisplay(b.booking?.date || b.booking_date || b.createdAt),
        orders: orders,
        paid: paid,
        remaining: remaining,
        deposit: deposit,
        netPaid: netPaid,
        method: b.payment?.method || b.payment_method || 'نقدي',
        status: remaining === 0 ? 'مدفوع' : 'آجل'
      };
    });
  }

  // ---------------------------------------------
  // 8. الدالة الرئيسية
  // ---------------------------------------------
  window.fetchAndRender = async function() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;

    if (!from || !to) {
      showToast('⚠️ يرجى تحديد الفترة الزمنية');
      return;
    }

    showToast('⏳ جاري تحميل البيانات...');

    const bookings = await fetchBookings();
    if (!bookings || bookings.length === 0) {
      renderReport([], { totalOrders:0, totalPaid:0, totalDeposit:0, totalRemaining:0, netPaidTotal:0, totalCount:0, paidCount:0, unpaidCount:0, collectionRate:0 });
      showToast('📭 لا توجد بيانات للعرض');
      return;
    }

    const filtered = filterByDate(bookings, from, to);
    const stats = calculateStats(filtered);
    renderReport(filtered, stats);

    showToast(`✅ تم تحديث التقرير (${filtered.length} فاتورة)`);
  };

  // ---------------------------------------------
  // 9. فتح صفحة المعاينة
  // ---------------------------------------------
  window.openPreview = function() {
    if (!currentReportData || currentReportData.length === 0) {
      showToast('⚠️ لا توجد بيانات للمعاينة');
      return;
    }

    const stats = {
      totalOrders: currentReportData.reduce((s, r) => s + r.orders, 0),
      totalPaid: currentReportData.reduce((s, r) => s + r.paid, 0),
      totalDeposit: currentReportData.reduce((s, r) => s + r.deposit, 0),
      totalRemaining: currentReportData.reduce((s, r) => s + r.remaining, 0),
      netPaidTotal: currentReportData.reduce((s, r) => s + r.netPaid, 0),
      totalCount: currentReportData.length,
      paidCount: currentReportData.filter(r => r.status === 'مدفوع').length,
      unpaidCount: currentReportData.filter(r => r.status === 'آجل').length,
      collectionRate: 0
    };
    stats.collectionRate = stats.totalOrders > 0 ? (stats.netPaidTotal / stats.totalOrders) * 100 : 0;

    const reportData = {
      fromDate: document.getElementById('fromDate').value,
      toDate: document.getElementById('toDate').value,
      stats: stats,
      items: currentReportData,
      restaurant: {
        name: 'شواطئ عدن',
        logo: localStorage.getItem('restaurant_logo') || '',
        address: 'جدة - شارع جاك - جوار كودو',
        phone: '0550724459'
      }
    };

    localStorage.setItem('report_preview_data', JSON.stringify(reportData));
    window.open('report_preview.html', '_blank');
  };

  // ---------------------------------------------
  // 10. Toast
  // ---------------------------------------------
  function showToast(msg) {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e1a17;
      color: #fff;
      padding: 14px 28px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 15px;
      z-index: 9999;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      border: 1px solid rgba(255,215,0,0.12);
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 90%;
      text-align: center;
      font-family: 'Cairo', sans-serif;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = '0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(30px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------
  // 11. التشغيل
  // ---------------------------------------------
  document.addEventListener('DOMContentLoaded', function() {
    if (!authToken) {
      showToast('⚠️ يرجى تسجيل الدخول أولاً');
      document.getElementById('tableBody').innerHTML = `
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