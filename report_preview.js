// ============================================================
// report_preview.js - معاينة التقرير والتصدير (مثل الفواتير)
// ============================================================

(function() {
    "use strict";

    // قراءة البيانات
    const storedData = localStorage.getItem('report_preview_data');
    if (!storedData) {
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;font-family:sans-serif;text-align:center;padding:20px;">
                <div>
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#ef4444;margin-bottom:16px;"></i>
                    <h2 style="font-size:24px;font-weight:bold;color:#1e293b;">لا توجد بيانات للتقرير</h2>
                    <p style="color:#64748b;margin-top:8px;">يرجى العودة إلى صفحة التقارير وتحديث التقرير.</p>
                    <button onclick="window.close()" style="margin-top:20px;background:#0f172a;color:#fff;border:none;padding:10px 30px;border-radius:12px;font-weight:bold;cursor:pointer;">
                        <i class="fas fa-arrow-right"></i> العودة
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const data = JSON.parse(storedData);
    const stats = data.stats;
    const items = data.items || [];

    // عرض التاريخ
    document.getElementById('reportDateRange').textContent = `الفترة: ${data.fromDate} إلى ${data.toDate}`;

    // عرض البطاقات
    document.getElementById('previewTotalRevenue').textContent = stats.totalRevenue.toFixed(2);
    document.getElementById('previewTotalPaid').textContent = stats.totalPaid.toFixed(2);
    document.getElementById('previewTotalRemaining').textContent = stats.totalRemaining.toFixed(2);
    document.getElementById('previewTotalCount').textContent = stats.totalCount;

    // عرض الجدول
    const tbody = document.getElementById('previewTableBody');
    const tfoot = document.getElementById('previewTableFoot');

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#8a7a70;">لا توجد فواتير في هذه الفترة</td></tr>`;
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

            const isPaid = remaining === 0;
            const badge = isPaid ? '<span class="badge-paid">✅ مدفوع</span>' : '<span class="badge-unpaid">⏳ آجل</span>';
            const remClass = remaining === 0 ? 'remaining-zero' : 'remaining-positive';

            rows += `
                <tr>
                    <td>${index + 1}</td>
                    <td style="font-weight:700;">${item.customer || '-'}</td>
                    <td>${item.date || '-'}</td>
                    <td>${total.toFixed(2)}</td>
                    <td>${paid.toFixed(2)}</td>
                    <td class="${remClass}">${remaining.toFixed(2)}</td>
                    <td>${item.method || 'نقدي'}</td>
                    <td>${badge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = rows;

        // صف الإجمالي
        tfoot.style.display = 'table-footer-group';
        tfoot.innerHTML = `
            <tr class="total-row">
                <td colspan="3" style="text-align:left; padding-right:16px;">📊 الإجمالي</td>
                <td>${sumTotal.toFixed(2)}</td>
                <td>${sumPaid.toFixed(2)}</td>
                <td class="${sumRemaining === 0 ? 'remaining-zero' : 'remaining-positive'}">${sumRemaining.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
        `;
    }

    // ============================================================
    // دوال التصدير (بنفس طريقة الفواتير)
    // ============================================================

    // 1. تحميل PDF باستخدام html2canvas + jsPDF
    window.downloadPDF = async function() {
        const container = document.getElementById('reportContainer');
        const btn = document.querySelector('.btn-pdf');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
            btn.disabled = true;

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

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

            showToast('✅ تم تحميل PDF');
        } catch (err) {
            console.error(err);
            showToast('❌ حدث خطأ في إنشاء PDF');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // 2. تحميل Excel
    window.downloadExcel = function() {
        if (!items.length) {
            showToast('⚠️ لا توجد بيانات للتصدير');
            return;
        }

        const excelData = items.map((item, i) => ({
            'رقم': i + 1,
            'العميل': item.customer,
            'التاريخ': item.date,
            'الإجمالي': item.total,
            'المدفوع': item.paid,
            'المتبقي': item.remaining,
            'طريقة الدفع': item.method,
            'الحالة': item.status
        }));

        const sumTotal = items.reduce((s, i) => s + i.total, 0);
        const sumPaid = items.reduce((s, i) => s + i.paid, 0);
        const sumRemaining = items.reduce((s, i) => s + i.remaining, 0);

        excelData.push({
            'رقم': '',
            'العميل': 'الإجمالي',
            'التاريخ': '',
            'الإجمالي': sumTotal,
            'المدفوع': sumPaid,
            'المتبقي': sumRemaining,
            'طريقة الدفع': '',
            'الحالة': ''
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
        XLSX.writeFile(wb, `تقرير_فواتير_${data.fromDate}.xlsx`);

        showToast('✅ تم تحميل Excel');
    };

    // 3. المشاركة عبر واتساب
    window.shareWhatsApp = async function() {
        const container = document.getElementById('reportContainer');
        const btn = document.querySelector('.btn-whatsapp');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
            btn.disabled = true;

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

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
            const pdfFile = new File([pdfBlob], `تقرير_فواتير_${data.fromDate}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: 'تقرير الفواتير - شواطئ عدن',
                    text: `تقرير الفواتير للفترة من ${data.fromDate} إلى ${data.toDate}`,
                    files: [pdfFile]
                });
                showToast('✅ تمت المشاركة');
            } else {
                // تحميل كبديل
                const link = document.createElement('a');
                link.href = URL.createObjectURL(pdfBlob);
                link.download = `تقرير_فواتير_${data.fromDate}.pdf`;
                link.click();
                URL.revokeObjectURL(link.href);
                showToast('✅ تم تحميل PDF، يمكنك مشاركته يدوياً');
            }
        } catch (err) {
            console.error(err);
            showToast('❌ حدث خطأ في المشاركة');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // Toast للمعاينة
    function showToast(msg) {
        const existing = document.querySelector('.preview-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'preview-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e1a17;
            color: #fff;
            padding: 12px 24px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            border: 1px solid rgba(255,215,0,0.1);
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            max-width: 90%;
            text-align: center;
            font-family: 'Tajawal', sans-serif;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = '0.4s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // إضافة style للـ toast إذا لم يكن موجوداً
    if (!document.querySelector('#previewToastStyle')) {
        const style = document.createElement('style');
        style.id = 'previewToastStyle';
        style.textContent = `
            @keyframes slideUp {
                from { transform: translateX(-50%) translateY(20px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
})();