// ============================================================
// invoice.js - إنشاء صفحات فاتورة متعددة بحجم A5 ثابت (مطابق للصورة)
// ============================================================

(function () {
  "use strict";

  // 1. قراءة البيانات
  const storedData = localStorage.getItem("preview_invoice_data");
  if (!storedData) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;font-family:sans-serif;text-align:center;padding:20px;">
        <div>
          <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#ef4444;margin-bottom:16px;"></i>
          <h2 style="font-size:24px;font-weight:bold;color:#1e293b;">لا توجد بيانات للفاتورة</h2>
          <p style="color:#64748b;margin-top:8px;">يرجى العودة إلى صفحة الحجوزات واختيار فاتورة صحيحة.</p>
          <button onclick="window.location.href='index.html'" style="margin-top:20px;background:#0f172a;color:#fff;border:none;padding:10px 30px;border-radius:12px;font-weight:bold;cursor:pointer;">
            <i class="fas fa-arrow-right"></i> العودة للرئيسية
          </button>
        </div>
      </div>
    `;
    return;
  }

  const data = JSON.parse(storedData);
  const r = data.restaurant || {};

  // ============================================================
  // 2. دوال مساعدة
  // ============================================================
  function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2);
  }

  function getInvoiceNumber(id) {
    return (
      "" +
      String(id || Math.floor(Math.random() * 1000000)).padStart(6, "0")
    );
  }

  const MAX_ITEMS_PER_PAGE = 5;

  // ============================================================
  // 3. إنشاء صفحة فاتورة واحدة
  // ============================================================
  function createInvoicePage(pageItems, pageIndex, totalPages, grandTotal) {
    const pageNumber = pageIndex + 1;
    const items = pageItems || [];

    let pageTotal = 0;
    let itemsHtml = "";

    // بناء 5 صفوف بالضبط
    for (let i = 0; i < MAX_ITEMS_PER_PAGE; i++) {
      const item = items[i];
      if (item) {
        const total = (item.price || 0) * (item.qty || 1);
        pageTotal += total;
        const isDeposit = item.isDeposit || false;
        const depositStyle = isDeposit ? 'color:#8B6914; font-weight:900;' : '';
        itemsHtml += `
          <tr style="height: 8mm;">
            <td style="text-align:center; font-weight:900; font-size:12px; width:6%; background-color:#fafbf6; border: 1px solid #420a09;">${i + 1}</td>
            <td style="text-align:right; padding-right:6px; font-size:11px; border: 1px solid #420a09; ${depositStyle}">${item.name || "صنف"}</td>
            <td style="font-size:11px; text-align:center; border: 1px solid #420a09; ${depositStyle}">${item.qty || 1}</td>
            <td style="font-size:11px; text-align:center; border: 1px solid #420a09; ${depositStyle}">${formatCurrency(item.price || 0)}</td>
            <td style="font-weight:800; font-size:11px; text-align:center; border: 1px solid #420a09; ${depositStyle}">${formatCurrency(total)}</td>
          </tr>
        `;
      } else {
        itemsHtml += `
          <tr style="height: 8mm;">
            <td style="text-align:center; font-weight:900; font-size:12px; width:6%; background-color:#fafbf6; border: 1px solid #420a09;">${i + 1}</td>
            <td style="border: 1px solid #420a09;">&nbsp;</td>
            <td style="border: 1px solid #420a09;">&nbsp;</td>
            <td style="border: 1px solid #420a09;">&nbsp;</td>
            <td style="border: 1px solid #420a09;">&nbsp;</td>
          </tr>
        `;
      }
    }

    // تحديد النص المناسب للإجمالي
    const isLastPage = (pageIndex === totalPages - 1);
    const totalLabel = isLastPage ? "الإجمالي النهائي" : "إجمالي هذه الصفحة";
    const totalValue = isLastPage ? grandTotal : pageTotal;

    return `
      <div class="invoice-page">
        <div class="watermark">
          <img src="assets/watermark.png" alt="Watermark" />
        </div>

        <div class="invoice-inner">
          <!-- HEADER -->
          <div class="header" style="align-items: center;">
            <div class="header-right">
              <div class="title">${r.name || "مطابخ شواطئ عدن"}</div>
              <div class="subtitle">${r.subtitle || "للحجوزات الولائم والمناسبات"}</div>
              <div class="phone">
                <i class="fas fa-phone"></i>
                <span>${r.phone || "0550724459"}</span>
              </div>
            </div>

            <div class="logo-center">
              ${r.logo ? `<img src="${r.logo}" alt="شواطئ عدن" class="main-logo" />` : `<img src="assets/logo.png" alt="شواطئ عدن" class="main-logo" />`}
            </div>

            <div class="social-box">
              <div class="social-icons">
                <div class="social-icon"><i class="fab fa-snapchat-ghost"></i></div>
                <div class="social-icon"><i class="fab fa-instagram"></i></div>
                <div class="social-icon"><i class="fab fa-tiktok"></i></div>
                <div class="social-icon"><i class="fab fa-x-twitter"></i></div>
              </div>
              <div class="social-text">${r.social || "مطابخ شواطئ عدن"}</div>
              <div class="social-text" style="font-size:14px;font-weight:bold;color:black;">${r.social ? r.social.toUpperCase() : "SHAWATI ADEN KITCHENS"}</div>
            </div>
          </div>

          <!-- INVOICE BAR -->
          <div class="invoice-bar" style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 0;">
            <div class="invoice-no" style="color: #c0392b; font-weight: 900; font-size: 13px;">No./ <span>${getInvoiceNumber(data.id)}</span></div>
            <div class="invoice-badge-container">
              <div class="invoice-badge" style="padding: 6px 20px; font-size: 14px; border-radius: 6px;">فاتورة وليمة ${totalPages > 1 ? `(${pageNumber}/${totalPages})` : ""}</div>
            </div>
            <div style="width: 60px;"></div>
          </div>

          <!-- CUSTOMER BOX -->
          <div class="customer-box" style="margin-top: 1mm;">
            <div class="customer-row">
              <div class="customer-field">
                <span class="customer-label">اسم العميل :</span>
                <span class="customer-value" style="min-width: 45mm;">${data.customer?.name || ""}</span>
              </div>
              <div class="customer-field">
                <span class="customer-label">الجوال :</span>
                <span class="customer-value" style="min-width: 30mm;">${data.customer?.phone || ""}</span>
              </div>
            </div>
            <div class="customer-row">
              <div class="customer-field">
                <span class="customer-label">اليوم :</span>
                <span class="customer-value" style="min-width: 20mm;">${data.booking?.day || ""}</span>
              </div>
              <div class="customer-field">
                <span class="customer-label">الساعة :</span>
                <span class="customer-value" style="min-width: 20mm;">${(data.booking?.time || "").replace("صباحاً", "").replace("مساءً", "").trim()} ${data.booking?.deliveryTime || ""}</span>
              </div>
              <div class="customer-field">
                <span class="customer-label">التاريخ :</span>
                <span class="customer-value" style="min-width: 25mm;">${data.booking?.date || "2026 / /"}</span>
              </div>
            </div>
            <div class="customer-row">
              <div class="customer-field" style="flex:1.5;">
                <span class="customer-label">موقع التوصيل :</span>
                <span class="customer-value" style="min-width: 30mm;">${data.customer?.location || ""}</span>
              </div>
              <div class="customer-field" style="flex:1;">
                <span class="customer-label">العلامة :</span>
                <span class="customer-value" style="min-width: 20mm;">${data.booking?.mark || ""}</span>
              </div>
            </div>
          </div>

          <!-- ITEMS TABLE -->
          <div class="table-container" style="flex: none !important; margin-bottom: 2mm;">
            <table class="items-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #fafbf6;">
                  <th style="width: 6%; text-align: center; border: 1px solid #420a09; padding: 3px;"></th>
                  <th style="width: 44%; text-align: center; border: 1px solid #420a09; padding: 3px;">الصنف</th>
                  <th style="width: 15%; text-align: center; border: 1px solid #420a09; padding: 3px;">العدد</th>
                  <th style="width: 15%; text-align: center; border: 1px solid #420a09; padding: 3px;">السعر</th>
                  <th style="width: 20%; text-align: center; border: 1px solid #420a09; padding: 3px;">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <!-- NOTES BOX -->
          <div style="margin: 0 5mm 2mm 5mm; border: 1.5px solid #420a09; border-radius: 6px; height: 28mm; overflow: hidden; padding: 2mm 4mm; background-color: #fff; position: relative;">
            <span style="font-weight: 900; font-size: 13px; color: #420a09; position: absolute; top: 2mm; right: 4mm;">ملاحظة :</span>
            <div style="margin-top: 5mm; font-size: 11px; font-weight: 700; color: #420a09; line-height: 1.6; text-align: right; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${data.notes || ""}</div>
          </div>

          <!-- TOTAL BOX -->
          <div style="margin: 0 5mm; border: 1.5px solid #420a09; border-radius: 6px; padding: 2.5mm 4mm; background-color: #fff; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-weight: 900; font-size: 14px; color: #420a09; width: 30%;">${totalLabel} :</span>
            <span style="font-weight: 900; font-size: 18px; color: #420a09; width: 40%; text-align: center;">${formatCurrency(totalValue)}</span>
            <span style="font-size: 9px; font-weight: 800; color: #420a09; width: 30%; text-align: left; opacity: 0.8; line-height: 1.4;">
              المدفوع: <span style="color:#27ae60;">${formatCurrency(data.deposit)}</span><br>المتبقي: <span style="color:#c0392b;">${formatCurrency(grandTotal - (data.deposit || 0))}</span>
            </span>
          </div>

          <!-- FOOTER WAVE -->
          <div class="footer-wave" style="margin-top: auto;">
            <svg viewBox="0 0 800 100" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
              <path d="M0,67 C55,54 105,52 160,57 C225,63 285,82 350,87 C420,92 475,82 530,68 C585,54 635,51 690,57 C735,61 770,69 800,76" fill="none" stroke="#420A09" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M0,75 C55,62 105,60 160,65 C225,71 285,90 350,95 C420,100 475,90 530,76 C585,62 635,59 690,65 C735,69 770,77 800,84" fill="none" stroke="#8B6914" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
          
          <!-- WARNING BOX -->
          <div style="margin: 0 5mm; padding: 2mm 4mm; background-color: #fff; text-align: center;">
            <span style="font-weight: 900; font-size: 13px; color: #420a09;">ملاحظة : أي تعديل في محتوى الفاتورة يكون قبل الموعد بساعة</span>
          </div>
          <!-- FOOTER CONTENT -->
          <div class="footer-content">
            <div class="qr-box">
              <img src="assets/location-qr.png" class="qr-image" alt="Location QR" />
              <div class="qr-label">الموقع</div>
            </div>

            <div class="footer-center" style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%;">
              <div style="display:flex; justify-content:space-between; width:100%; align-items:center; padding:0 4mm; margin-bottom:4px;">
                <div class="address-location" style="display:flex; align-items:center; justify-content:center; gap:3mm; text-align:right; margin:0;">
                  <i class="fas fa-location-dot" style="font-size:22px; color:#420a09; flex-shrink:0;"></i>
                  <div class="address" style="text-align:right; margin:0;">
                    <p>${r.address || "جدة . شارع جاك<br />جوار كودو"}</p>
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div class="contact-row" style="margin:0; justify-content:flex-start;">
                    <i class="fab fa-whatsapp"></i>
                    <span>${r.delivery || r.phone || "0550724459"}</span>
                  </div>
                  <div class="contact-row" style="margin:0; justify-content:flex-start;">
                    <i class="fas fa-phone"></i>
                    <span>${r.phone || "0566869958"}</span>
                  </div>
                </div>
              </div>

              <div class="payment-box" style="margin-top:4px; display:flex; align-items:center; justify-content:center; gap:4mm;">
                <span>طريقة الدفع :</span>
                <span class="payment-line" style="display:inline-block; width:42mm; height:7mm; background-color:#fafbf6; border:1px solid #420a09; border-radius:2mm; text-align:center; font-weight:bold; font-size:11px; color:#420a09; line-height:7mm;">
                  ${data.paymentMethod || "نقدي"}
                </span>
              </div>
            </div>

            <div class="qr-box">
              <img src="assets/whatsapp-qr.png" class="qr-image" alt="Whatsapp QR" />
              <div class="qr-label">قناة واتساب</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // 4. تقسيم الأصناف وتوليد الفاتورة
  // ============================================================
  function renderInvoice() {
    const items = data.items || [];
    const platesDeposit = parseFloat(data.platesDeposit || 0);

    // بناء القائمة الكاملة للأصناف مع إضافة تأمين الصحون في البداية إذا كان موجوداً
    let fullItems = [];
    if (platesDeposit > 0) {
      fullItems.push({
        name: "تأمين الصحون",
        qty: 1,
        price: platesDeposit,
        total: platesDeposit,
        isDeposit: true
      });
    }
    fullItems = fullItems.concat(items.map(item => ({
      ...item,
      isDeposit: false
    })));

    // حساب الإجمالي الكلي (يشمل التأمين)
    const grandTotal = fullItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);

    // تقسيم القائمة إلى صفحات
    const pages = [];
    for (let i = 0; i < fullItems.length; i += MAX_ITEMS_PER_PAGE) {
      pages.push(fullItems.slice(i, i + MAX_ITEMS_PER_PAGE));
    }

    if (pages.length === 0) {
      pages.push([]);
    }

    let allPagesHtml = "";
    pages.forEach((pageItems, index) => {
      allPagesHtml += createInvoicePage(pageItems, index, pages.length, grandTotal);
    });

    document.getElementById("pagesWrapper").innerHTML = allPagesHtml;
  }

  // ============================================================
  // 5. مشاركة الفاتورة عبر واتساب
  // ============================================================
  window.shareInvoiceWhatsApp = async function () {
    const wrapper = document.getElementById("pagesWrapper");
    const btn = document.querySelector(".btn-whatsapp");
    const originalText = btn.innerHTML;

    const pages = wrapper.querySelectorAll(".invoice-page");
    if (!pages.length) {
      alert("لا توجد صفحات لعرضها.");
      return;
    }

    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left:4px;"></i> جاري التجهيز...';
      btn.disabled = true;
      document.querySelector(".actions").style.display = "none";

      const customerName = data.customer?.name ? data.customer.name.replace(/\s+/g, "") : "عميل";
      const pdfFileName = "فاتورة_" + customerName + ".pdf";

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        unit: "mm",
        format: "a5",
        orientation: "portrait",
      });

      const canvasOptions = {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      };

      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i];
        if (i > 0) {
          pdf.addPage();
        }

        const canvas = await html2canvas(pageElement, canvasOptions);
        const imgData = canvas.toDataURL("image/jpeg", 1.0);

        const pdfWidth = 148;
        const pdfHeight = 210;
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        const xOffset = (pdfWidth - finalWidth) / 2;
        const yOffset = (pdfHeight - finalHeight) / 2;

        pdf.addImage(imgData, "JPEG", xOffset, yOffset, finalWidth, finalHeight);
      }

      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });

      document.querySelector(".actions").style.display = "flex";

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: "فاتورة وليمة - مطابخ شواطئ عدن",
          text: "مرفق لكم تفاصيل فاتورة الوليمة من مطابخ شواطئ عدن. شكراً لثقتكم بنا!",
          files: [pdfFile],
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = pdfFileName;
        link.click();
        URL.revokeObjectURL(link.href);
        alert("تم تحميل الفاتورة بصيغة PDF بحجم A5. يمكنك إرسالها يدوياً.");
      }
    } catch (error) {
      console.error("Error generating PDF: ", error);
      alert("حدث خطأ أثناء تجهيز الفاتورة للمشاركة.");
      document.querySelector(".actions").style.display = "flex";
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  // ============================================================
  // 6. بدء التشغيل
  // ============================================================
  document.addEventListener("DOMContentLoaded", renderInvoice);
})();