// ============================================================
// report_preview.js - معاينة التقرير والتصدير (شواطئ عدن)
// يعتمد على نفس منطق الفواتير مع html2canvas + jsPDF
// ============================================================

(function() {
  "use strict";

  // ---------------------------------------------
  // 1. قراءة البيانات من localStorage
  // ---------------------------------------------
  const storedData = localStorage.getItem('report_preview_data');
  if (!storedData) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f0eb;font-family:'Tajawal',sans-serif;text-align:center;padding:20px;">
        <div>
          <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#c0392b;margin-bottom:16px;"></i>
          <h2 style="font-size:24px;font-weight:900;color:#1e1a17;">لا توجد بيانات للتقرير</h2>
          <p style="color:#8a7a70;margin-top:8px;font-weight:600;">يرجى العودة إلى صفحة التقارير وتحديث التقرير.</p>
          <button onclick="window.close()" style="margin-top:24px;background:#1e1a17;color:#fff;border:none;padding:12px 36px;border-radius:30px;font-weight:800;font-size:15px;cursor:pointer;">
            <i class="fas fa-arrow-right"></i> العودة
          </button>
        </div>
      </div>
    `;
    return;
  }

  const data = JSON.parse(storedData);
  const stats = data.stats || {};
  const items = data.items || [];
  const restaurant = data.restaurant || { name: 'شواطئ عدن', logo: '', address: '', phone: '' };

  // ---------------------------------------------
  // 2. عرض البيانات في الواجهة
  // ---------------------------------------------

  // 2.1 التاريخ
  document.getElementById('displayFrom').textContent = data.fromDate || '-';
  document.getElementById('displayTo').textContent = data.toDate || '-';

  // 2.2 الشعار (إذا كان موجوداً)
  const logoImg = document.getElementById('reportLogo');
  if (restaurant.logo && (restaurant.logo.startsWith('data:image') || restaurant.logo.startsWith('http'))) {
    logoImg.src = restaurant.logo;
  } else {
    logoImg.src = 'assets/logo.png';
  }

  // 2.3 البطاقات
  document.getElementById('previewTotalRevenue').textContent = (stats.totalRevenue || 0).toFixed(2);
  document.getElementById('previewTotalPaid').textContent = (stats.totalPaid || 0).toFixed(2);
  document.getElementById('previewTotalRemaining').textContent = (stats.totalRemaining || 0).toFixed(2);
  document.getElementById('previewTotalCount').textContent = stats.totalCount || 0;

  // 2.4 الملخص الإضافي
  const totalDeposit = items.reduce((sum, item) => sum + (item.platesDeposit || 0), 0);
  document.getElementById('previewTotalDeposit').textContent = totalDeposit.toFixed(2);
  document.getElementById('previewCollectionRate').textContent = (stats.collectionRate || 0).toFixed(1) + '%';
  document.getElementById('previewPaidCount').textContent = stats.paidCount || 0;
  document.getElementById('previewUnpaidCount').textContent = stats.unpaidCount || 0;

  // 2.5 الجدول
  const tbody = document.getElementById('previewTableBody');
  const tfoot = document.getElementById('previewTableFoot');

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#8a7a70; font-weight:700;">📭 لا توجد فواتير في هذه الفترة</td></tr>`;
    tfoot.style.display = 'none';
  } else {
    let rows = '';
    let sumTotal = 0, sumPaid = 0, sumRemaining = 0;

    items.forEach((item, index) => {
      const total = item.total || 0;
      const paid = item.paid || 0;
      const remaining = item.remaining || 0;
      sumTotal += total;
      sumPaid += paid;
      sumRemaining += remaining;

      const isPaid = (remaining === 0);
      const badge = isPaid
        ? '<span class="badge-paid">✅ مدفوع</span>'
        : '<span class="badge-unpaid">⏳ آجل</span>';
      const remClass = (remaining === 0) ? 'remaining-zero' : 'remaining-positive';

      rows += `
        <tr>
          <td>${index + 1}</td>
          <td style="font-weight:700;">${item.customer || '-'}</td>
          <td>${item.date || '-'}</td>
          <td style="font-weight:800;">${total.toFixed(2)}</td>
          <td>${paid.toFixed(2)}</td>
          <td class="${remClass}">${remaining.toFixed(2)}</td>
          <td>${badge}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;

    // صف الإجمالي
    tfoot.style.display = 'table-footer-group';
    tfoot.innerHTML = `
      <tr class="total-row">
        <td colspan="3" style="text-align:left; padding-right:20px; font-weight:900;">📊 الإجمالي التراكمي</td>
        <td style="font-weight:900;">${sumTotal.toFixed(2)}</td>
        <td style="font-weight:900;">${sumPaid.toFixed(2)}</td>
        <td style="font-weight:900;">${sumRemaining.toFixed(2)}</td>
        <td></td>
      </tr>
    `;
  }

  // ---------------------------------------------
  // 3. دوال التصدير (PDF, Excel, WhatsApp)
  // ---------------------------------------------

  // 3.1 تحميل PDF باستخدام html2canvas + jsPDF (بحجم A4)
  window.downloadPDF = async function() {
    const container = document.getElementById('reportContainer');
    const btn = document.querySelector('.btn-pdf');
    const originalText = btn.innerHTML;

    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
      btn.disabled = true;

      // حفظ الأبعاد الأصلية
      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;
      const originalTransform = container.style.transform;
      const originalPadding = container.style.padding;

      // ضبط الحاوية بحجم مناسب للطباعة (A4)
      container.style.width = '210mm';
      container.style.maxWidth = '210mm';
      container.style.padding = '20px 24px';
      container.style.transform = 'scale(1)';
      container.style.margin = '0 auto';
      container.style.background = '#ffffff';

      // انتظار إعادة التخطيط
      await new Promise(resolve => requestAnimationFrame(resolve));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        onclone: function(clonedDoc) {
          const actions = clonedDoc.querySelector('.actions');
          if (actions) actions.style.display = 'none';
        }
      });

      // استعادة الأبعاد الأصلية
      container.style.width = originalWidth || '';
      container.style.maxWidth = originalMaxWidth || '';
      container.style.padding = originalPadding || '';
      container.style.transform = originalTransform || '';
      container.style.margin = '';
      container.style.background = '';

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
      pdf.save(`تقرير_فواتير_${data.fromDate}_الى_${data.toDate}.pdf`);

      showToast('✅ تم تحميل PDF بنجاح');
    } catch (error) {
      console.error('PDF Error:', error);
      showToast('❌ حدث خطأ في إنشاء PDF');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  // 3.2 تحميل Excel باستخدام SheetJS
  window.downloadExcel = function() {
    if (!items || items.length === 0) {
      showToast('⚠️ لا توجد بيانات للتصدير');
      return;
    }

    try {
      const excelData = items.map((item, index) => ({
        'رقم': index + 1,
        'العميل': item.customer || '-',
        'التاريخ': item.date || '-',
        'الإجمالي (ر.س)': item.total || 0,
        'المدفوع (ر.س)': item.paid || 0,
        'المتبقي (ر.س)': item.remaining || 0,
        'طريقة الدفع': item.method || 'نقدي',
        'الحالة': item.status || 'آجل',
        'تأمين الصحون (ر.س)': item.platesDeposit || 0
      }));

      // حساب الإجماليات
      const sumTotal = items.reduce((s, i) => s + (i.total || 0), 0);
      const sumPaid = items.reduce((s, i) => s + (i.paid || 0), 0);
      const sumRemaining = items.reduce((s, i) => s + (i.remaining || 0), 0);
      const sumDeposit = items.reduce((s, i) => s + (i.platesDeposit || 0), 0);

      excelData.push({
        'رقم': '',
        'العميل': '📊 الإجمالي التراكمي',
        'التاريخ': '',
        'الإجمالي (ر.س)': sumTotal,
        'المدفوع (ر.س)': sumPaid,
        'المتبقي (ر.س)': sumRemaining,
        'طريقة الدفع': '',
        'الحالة': '',
        'تأمين الصحون (ر.س)': sumDeposit
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      ws['!cols'] = [
        { wch: 8 },   // رقم
        { wch: 28 },  // العميل
        { wch: 18 },  // التاريخ
        { wch: 18 },  // الإجمالي
        { wch: 18 },  // المدفوع
        { wch: 18 },  // المتبقي
        { wch: 18 },  // طريقة الدفع
        { wch: 15 },  // الحالة
        { wch: 20 }   // تأمين الصحون
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
      XLSX.writeFile(wb, `تقرير_فواتير_${data.fromDate}.xlsx`);

      showToast('✅ تم تحميل Excel بنجاح');
    } catch (error) {
      console.error('Excel Error:', error);
      showToast('❌ حدث خطأ في إنشاء Excel');
    }
  };

  // 3.3 المشاركة عبر واتساب مع ضبط الحجم
  window.shareWhatsApp = async function() {
    const container = document.getElementById('reportContainer');
    const btn = document.querySelector('.btn-whatsapp');
    const originalText = btn.innerHTML;

    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
      btn.disabled = true;

      // حفظ الأبعاد الأصلية
      const originalWidth = container.style.width;
      const originalMaxWidth = container.style.maxWidth;
      const originalTransform = container.style.transform;
      const originalPadding = container.style.padding;

      // ضبط الحاوية بحجم مناسب للطباعة (A4)
      container.style.width = '210mm';
      container.style.maxWidth = '210mm';
      container.style.padding = '20px 24px';
      container.style.transform = 'scale(1)';
      container.style.margin = '0 auto';
      container.style.background = '#ffffff';

      await new Promise(resolve => requestAnimationFrame(resolve));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        onclone: function(clonedDoc) {
          const actions = clonedDoc.querySelector('.actions');
          if (actions) actions.style.display = 'none';
        }
      });

      // استعادة الأبعاد الأصلية
      container.style.width = originalWidth || '';
      container.style.maxWidth = originalMaxWidth || '';
      container.style.padding = originalPadding || '';
      container.style.transform = originalTransform || '';
      container.style.margin = '';
      container.style.background = '';

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File(
        [pdfBlob],
        `تقرير_فواتير_${data.fromDate}.pdf`,
        { type: 'application/pdf' }
      );

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: 'تقرير الفواتير - شواطئ عدن',
          text: `📊 تقرير الفواتير للفترة من ${data.fromDate} إلى ${data.toDate}`,
          files: [pdfFile]
        });
        showToast('✅ تمت المشاركة بنجاح');
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `تقرير_فواتير_${data.fromDate}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('✅ تم تحميل PDF، يمكنك مشاركته يدوياً');
      }
    } catch (error) {
      console.error('Share Error:', error);
      if (error.name !== 'AbortError') {
        showToast('❌ حدث خطأ في المشاركة');
      }
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  // ---------------------------------------------
  // 4. Toast (إشعارات)
  // ---------------------------------------------
  function showToast(msg) {
    const existing = document.querySelector('.preview-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'preview-toast';
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
      font-family: 'Tajawal', sans-serif;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = '0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  if (!document.querySelector('#previewToastStyle')) {
    const style = document.createElement('style');
    style.id = 'previewToastStyle';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(30px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

})();