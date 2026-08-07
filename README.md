# 🍖 شواطئ عدن - تطبيق إدارة حجوزات الولائم

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

تطبيق ويب تقدمي (PWA) لإدارة حجوزات الولائم والمناسبات داخل المطعم. مصمم خصيصاً للعمل على الهواتف المحمولة داخل المطعم.

---

## ✨ المميزات

| الميزة | الوصف |
|--------|-------|
| 📅 **حجز جديد** | إضافة حجز مع بيانات العميل والتاريخ والأصناف |
| 🔍 **بحث متقدم** | البحث بالاسم أو رقم الجوال أو التاريخ |
| 📊 **لوحة تحكم** | إحصائيات يومية + حجوزات قادمة |
| 🧾 **فاتورة احترافية** | مطابقة للفاتورة الورقية الأصلية مع QR Code |
| 🖨️ **طباعة** | دعم طباعة الفاتورة (Bluetooth / WiFi Printer) |
| 📱 **مشاركة واتساب** | إرسال الفاتورة مباشرة للعميل |
| 📄 **PDF** | تصدير الفاتورة بصيغة PDF |
| 🔔 **إشعارات** | تذكير قبل الموعد + إشعارات الحجوزات الجديدة |
| 💾 **نسخ احتياطي** | تصدير واستيراد البيانات بصيغة JSON |
| ⚙️ **إعدادات** | تخصيص بيانات المطعم والإشعارات |

---

## 🚀 طريقة التشغيل

### 1. فتح الملف مباشرة
```bash
# افتح الملف في المتصفح مباشرة
open shawati_aden_app.html

# أو استخدم خادم محلي
npx serve .
# ثم افتح: http://localhost:3000
```

### 2. رفع على استضافة ويب
```bash
# يمكن رفع الملف على أي استضافة ويب
# Netlify, Vercel, GitHub Pages, Firebase Hosting
```

---

## 📁 هيكل المشروع

```
shawati-aden-app/
├── 📄 shawati_aden_app.html    # التطبيق الكامل (صفحة واحدة)
├── 📄 README.md                 # هذا الملف
└── 📁 assets/                   # (اختياري) شعار المطعم + صور
    └── logo.png
```

> **ملاحظة:** التطبيق كامل في **ملف HTML واحد** فقط! لا يحتاج بناء (Build) أو تثبيت حزم.

---

## 🔗 ربط API (للمطورين)

لربط التطبيق بقاعدة بيانات حقيقية، استبدل الدالتين التاليتين في الكود:

```javascript
// الملف: shawati_aden_app.html

// 🔴 الحالي: التخزين المحلي
function saveData() {
  localStorage.setItem('shawatiApp', JSON.stringify({
    settings: appData.settings,
    items: appData.items,
    bookings: appData.bookings
  }));
}

function loadData() {
  const saved = localStorage.getItem('shawatiApp');
  if (saved) { ... }
}

// 🟢 المستقبلي: ربط API
async function saveData() {
  await fetch('https://your-api.com/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appData)
  });
}

async function loadData() {
  const res = await fetch('https://your-api.com/load');
  const data = await res.json();
  appData = data;
}
```

---

## 🛠️ أوامر Git لرفع المشروع على GitHub

### الخطوة 1: إنشاء مستودع جديد على GitHub
1. ادخل على [github.com](https://github.com)
2. اضغط **New Repository**
3. اكتب اسم المستودع: `shawati-aden-app`
4. اختر **Public** أو **Private**
5. لا تضيف README أو .gitignore (عندك واحد جاهز)
6. اضغط **Create Repository**
7. انسخ رابط المستودع:
   ```
   https://github.com/YOUR_USERNAME/shawati-aden-app.git
   ```

### الخطوة 2: أوامر الطرفية (Terminal)

```bash
# 1. ادخل على مجلد المشروع
cd ~/Desktop/shawati-aden-app

# 2. تهيئة Git
 git init

# 3. إضافة الملفات
 git add .

# 4. أول Commit
 git commit -m "🎉 الإصدار الأول - تطبيق إدارة الولائم"

# 5. تسمية الفرع الرئيسي
 git branch -M main

# 6. ربط المستودع البعيد (استبدل YOUR_USERNAME)
 git remote add origin https://github.com/YOUR_USERNAME/shawati-aden-app.git

# 7. الرفع الأول
 git push -u origin main
```

### الخطوة 3: التحديثات المستقبلية

```bash
# بعد أي تعديل:
 git add .
 git commit -m "✨ وصف التعديل"
 git push origin main
```

---

## 🌐 نشر على GitHub Pages (مجاني)

```bash
# 1. اذهب لإعدادات المستودع على GitHub
# 2. اختر Pages من القائمة الجانبية
# 3. Source: Deploy from a branch
# 4. Branch: main / root
# 5. اضغط Save

# الرابط سيكون:
# https://YOUR_USERNAME.github.io/shawati-aden-app/shawati_aden_app.html
```

---

## 📱 تثبيت على الهاتف (PWA)

```
1. افتح الرابط في متصفح Chrome/Safari على الهاتف
2. اضغط "إضافة إلى الشاشة الرئيسية"
3. سيظهر التطبيق كأيقونة على الشاشة!
```

---

## 🎨 تخصيص الفاتورة

لتغيير شعار المطعم في الفاتورة، ابحث عن هذا الكود واستبدله:

```html
<!-- الموجود حالياً: -->
<div class="w-16 h-16 rounded-full bg-black flex items-center justify-center">
  <i class="fas fa-utensils text-white text-xl"></i>
</div>

<!-- استبدله بـ: -->
<img src="assets/logo.png" class="w-16 h-16 rounded-full object-cover">
```

---

## ⚠️ ملاحظات مهمة

| النقطة | التوضيح |
|--------|---------|
| 💾 **التخزين** | البيانات تُحفظ في `LocalStorage` بالمتصفح |
| 🔄 **النسخ الاحتياطي** | استخدم "تصدير البيانات" في الإعدادات بشكل دوري |
| 📵 **بدون إنترنت** | يعمل بدون إنترنت بعد التحميل الأول |
| 🖨️ **الطباعة** | استخدم `Ctrl+P` أو زر الطباعة في الفاتورة |

---

## 📞 بيانات المطعم الافتراضية

```
الاسم: شواطئ عدن
الوصف: مطابخ ومطاعم
التخصص: للحجوزات والولائم والمناسبات
الهاتف: 0550724459
التوصيل: 0547504445
العنوان: جده شارع جاك - جوار كودو
السوشيال: @SHAWATI_ADEN
```

> يمكن تغييرها من شاشة **الإعدادات** داخل التطبيق.

---

## 👨‍💻 المطور

تم بناء هذا التطبيق خصيصاً لمطاعم **شواطئ عدن** لإدارة حجوزات الولائم بكفاءة واحترافية.

---

<p align="center">
  <strong>🤲 بارك الله في عملكم</strong>
</p>
