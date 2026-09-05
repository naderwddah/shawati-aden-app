# تقرير QA شامل - شواطئ عدن / Banquet Kitchen

**تاريخ الفحص:** 2026-09-05  
**نطاق الفحص:** الواجهة الثابتة `shawati-aden-v2` مع Laravel API في `banquet-kitchen`  
**طريقة الفحص:** تشغيل فعلي، متصفح آلي، HTTP/API، قاعدة البيانات، Console وNetwork، Desktop/Tablet/Mobile  
**قاعدة مهمة:** لم يتم إصلاح أي مشكلة أثناء الفحص.

## 1. Executive Summary

الحالة العامة: **غير جاهز للإطلاق الإنتاجي**.

نسبة الاكتمال التقريبية: **65%** من الوظائف الظاهرة تعمل في المسار الطبيعي بعد تسجيل الدخول، لكن توجد فجوات تكاملية تمنع اعتبار النظام مستقرًا: حماية الصفحات غير مكتملة، ملفات JavaScript مفقودة، رابط صفحة غير موجود، أخطاء تحميل ملفات التخزين، وتناقض في توثيق Mock API مقابل التنفيذ الحقيقي.

ما تم إثباته فعليًا:

- Laravel يعمل على `http://127.0.0.1:8000`، وواجهة Five Server تعمل على `http://127.0.0.1:5500`.
- تسجيل الدخول نجح بالحساب الموجود، وتم تحميل بيانات حقيقية من MySQL.
- المسارات المحمية تعيد `401` دون token، و`200` مع token صالح.
- CRUD للعميل نجح كاملًا ببيانات مؤقتة وتم تنظيفها.
- التحقق من الحقول الفارغة والقيم السالبة أعاد `422` صحيحًا.
- الصفحات الأساسية تفتح، وRTL يعمل، ولم يظهر overflow أفقي في قياسات 390 و768 بكسل.

## 2. Frontend Issues

### FE-001 - الصفحات المحمية تفتح دون تسجيل دخول

- **الصفحة/الملف:** `index.html`, `assets/js/pages/dashboard.js`
- **خطوات إعادة المشكلة:** افتح `http://127.0.0.1:5500/index.html` بعد حذف token.
- **النتيجة الحالية:** الصفحة تظهر بأرقام صفرية جزئيًا، ثم يظهر toast `Unauthenticated.` وتظهر أخطاء Console وطلبات `401`.
- **المتوقع:** تحويل المستخدم إلى `login.html` قبل عرض بيانات التطبيق.
- **Severity:** High
- **اقتراح الإصلاح:** إضافة guard موحد لكل الصفحات الخاصة، والتعامل مع `401` بتحويل مركزي مع منع عرض حالة فارغة مضللة.

### FE-002 - ملف JavaScript مفقود

- **الملف:** صفحات متعددة تحمل `assets/js/core/state.js`.
- **الدليل:** الطلب أعاد `404`، والمتصفح سجل: `Refused to execute script ... state.js ... MIME type text/html`.
- **النتيجة الحالية:** جزء من منطق الحالة لا يتم تحميله.
- **المتوقع:** وجود الملف أو إزالة مراجع قديمة إليه.
- **Severity:** High
- **اقتراح الإصلاح:** توحيد مراجع scripts مع الملفات الموجودة وتشغيل فحص assets قبل البناء.

### FE-003 - رابط صفحة غير موجود

- **الصفحة:** `bookings.html`
- **خطوات إعادة المشكلة:** اضغط رابط/زر الحجز الجديد الذي يشير إلى `booking-new.html`.
- **النتيجة الحالية:** `404`. الملف الموجود هو `booking-form.html`.
- **المتوقع:** فتح نموذج الحجز الموجود.
- **Severity:** High
- **اقتراح الإصلاح:** تحديث الرابط إلى `booking-form.html` أو إعادة إنشاء الصفحة مع اختبار الرابط.

### FE-004 - IDs مكررة

- **الدليل:** `paymentAmount` مكرر في عدة صفحات، وفي `booking-form.html` ظهرت IDs مكررة: `pageTitle`, `deliveryTime`, `bookingNotes`, `paymentAmount`, `paymentNotes`.
- **النتيجة الحالية:** `getElementById` ومستمعو الأحداث قد يتعاملون مع العنصر الخطأ، خصوصًا في النوافذ المنبثقة والمدفوعات.
- **Severity:** High
- **اقتراح الإصلاح:** جعل كل ID فريدًا، واستخدام selectors مرتبطة بالمودال عند الحاجة.

### FE-005 - صورة الشعار/ملف التخزين يفشل تحميله

- **الدليل:** طلب `http://127.0.0.1:8000/storage/restaurant/...png` فشل بـ `ERR_BLOCKED_BY_ORB`، و`public/storage` غير مرتبط حسب `artisan about`.
- **Severity:** Medium
- **اقتراح الإصلاح:** إنشاء storage symlink، ضبط MIME/CORS، والتحقق من endpoint الصورة fallback.

### FE-006 - توثيق الواجهة لا يطابق التنفيذ

- **الملفات:** `README.md`, `assets/js/core/api.js`
- **النتيجة الحالية:** README يصف Mock API وLocalStorage للبيانات، بينما التنفيذ يرسل إلى Laravel API حقيقي.
- **Severity:** Medium
- **اقتراح الإصلاح:** تحديث README وتوثيق تشغيل الخادمين والمصادقة وقاعدة البيانات.

### FE-007 - اختبار التفاعل الكامل للمدفوعات/الطباعة غير مكتمل

- **الدليل:** مسارات الكود موجودة، لكن نافذة طباعة المتصفح لا يمكن إثبات اكتمالها من خلال الاختبار الآلي دون اعتماد نتيجة dialog/ملف الطباعة.
- **Severity:** Medium
- **اقتراح الإصلاح:** إضافة اختبار E2E يتأكد من HTML المطبوع أو وظيفة export بدل الاكتفاء باستدعاء `window.print()`.

## 3. Backend/API Issues

### API-001 - أخطاء الإنتاج تكشف تفاصيل داخلية عند 404

- **الدليل:** `GET /api/customers/7` بعد الحذف أعاد `404` يتضمن `exception`, `file`, `trace`.
- **Severity:** High
- **اقتراح الإصلاح:** تعطيل `APP_DEBUG` خارج local وتوحيد JSON error envelope دون stack trace.

### API-002 - لا يوجد Authorization ظاهر حسب الدور

- **الدليل:** كل المسارات المحمية تعتمد `auth:sanctum` فقط. تم العثور على `is_active` في المستخدم، لكن لم يثبت وجود صلاحيات أدوار/سياسات للموارد.
- **Severity:** High
- **اقتراح الإصلاح:** إضافة Policies/roles واختبارات منع التعديل والحذف للمستخدم غير المصرح.

### API-003 - عقد API غير موثق بشكل موحد

- **الدليل:** مجموعة Postman تحتوي متغيرات `test*` وطلبات UPDATE/DELETE معطلة، بينما الواجهة تعتمد عقدًا مختلفًا جزئيًا في بعض الصفحات.
- **Severity:** Medium
- **اقتراح الإصلاح:** اعتماد OpenAPI أو عقد موحد مع schemas وstatus codes وأمثلة request/response.

### API-004 - GET `/api/login` يعيد 405 مع payload خطأ Laravel التفصيلي

- **النتيجة:** السلوك HTTP صحيح، لكن الرد في وضع debug يتضمن exception ومعلومات framework.
- **Severity:** Low في local، High في production.
- **اقتراح الإصلاح:** نفس معالجة الأخطاء العامة في API-001.

### نتائج API المثبتة

- دون token: `GET /api/customers`, `/api/me`, `/api/reports/daily-summary` أعادت `401`.
- `GET /api/login` أعاد `405` كما هو متوقع.
- مع token: جميع قراءات الموارد والتقارير المختبرة أعادت `200`.
- Login صحيح: أعاد token وبيانات المستخدم ثم نجحت dashboard.
- Login خاطئ: أعاد `422` ورسالة عربية صحيحة.
- Logout: أعاد `200`، ثم `GET /api/me` بنفس token أعاد `401`.
- Backend غير متاح: المتصفح سجل `net::ERR_CONNECTION_REFUSED` و`TypeError: Failed to fetch`.

## 4. Database Issues

- MySQL يعمل والترحيلات كلها في حالة `Ran`.
- قبل الاختبار: مستخدم 1، عملاء 3، موردون 2، أصناف 35، حجوزات 3.
- CRUD العميل اختُبر: POST `201`، PUT `200`، DELETE `200`، ثم GET `404`.
- سجلات QA المؤقتة تم حذفها، والتحقق النهائي أعاد قوائم QA فارغة.
- لا توجد قيود/اختبارات مثبتة لمنع حذف سجل مرتبط؛ هذه الحالة تحتاج اختبارًا أوسع على بيانات مترابطة.
- `public/storage` غير linked، ما يفسر مشكلة ملفات الشعار.

## 5. Functional Missing Features

- حماية موحدة للصفحات قبل تسجيل الدخول.
- ملف `state.js` أو إزالة اعتماده.
- إصلاح رابط `booking-new.html`.
- صلاحيات أدوار واضحة، وليس authentication فقط.
- اختبار مؤتمت مثبت للطباعة والتحميل/المشاركة.
- لا يوجد دليل كافٍ من التشغيل الحالي على اكتمال صفحة `menu-items.html` كميزة مستقلة؛ الصفحة تفتح لكن يلزم تعريف backend/CRUD واضح لها.

## 6. UI/UX & Design Issues

- RTL مثبت على الصفحات المختبرة.
- Mobile 390x844: صفحة العملاء بلا overflow أفقي، والتخطيط قابل للاستخدام، وFAB وbottom navigation ظاهران.
- Tablet 768x1024: صفحة التقارير بلا overflow أفقي، والأرقام والجدول ظهرت.
- توجد IDs مكررة قد تسبب خللًا بصريًا/وظيفيًا في المودالات.
- عند غياب المصادقة تظهر الصفحة ثم رسالة خطأ بدل حالة دخول واضحة.
- رسائل الخطأ مختلطة بين العربية ورسائل Laravel الإنجليزية.
- صورة الشعار لا تظهر عند مسار التخزين الفاشل.
- لم يثبت بشكل كامل سلوك loading/empty/error لكل modal وكل نموذج، لذا تبقى تغطية UX لهذه الحالات جزئية.

## 7. Integration Issues

- التكامل Frontend ↔ API يعمل بعد login باستخدام `http://127.0.0.1:8000/api`.
- README يقول Mock API، لكن `assets/js/core/api.js` يستخدم Laravel؛ هذا يسبب إعدادًا مضللًا للمطور والمشغل.
- Frontend يعتمد على files/links غير موجودة (`state.js`, `booking-new.html`).
- بيانات dashboard/reports تطابقت مع استجابات API وقاعدة البيانات في المسار المختبر.
- storage URL لا يعمل كما هو متوقع بسبب symlink/serving.

## 8. Security Issues

- `APP_DEBUG=true` في بيئة التشغيل الحالية، وردود 404 تكشف stack trace ومسارات ملفات.
- الوصول إلى الموارد محمي بـ Sanctum token، وتم إثبات إبطال token بعد logout.
- لم يثبت وجود Authorization حسب الدور أو الملكية.
- token يخزن في `localStorage` عند تفعيل Remember Me، ما يزيد أثر XSS المحتمل.
- لا يوجد اختبار مثبت لانتهاء صلاحية token تلقائيًا؛ تم اختبار token ملغى فقط.
- CORS يسمح `Access-Control-Allow-Origin: *` في رد login، ويجب مراجعته قبل الإنتاج مع token-based auth.

## 9. Performance Issues

- Dashboard يطلق عدة طلبات API متوازية عند التحميل، وهو مقبول وظيفيًا لكن يحتاج caching/aggregation عند زيادة البيانات.
- كل صفحة تعيد تحميل layout وطلبات الموارد، ولم يتم قياس زمن تحميل حقيقي أو حجم bundle.
- تكرار listeners/IDs قد يؤدي إلى طلبات أو أحداث مزدوجة، ويجب فحصه بعد إصلاح state references.
- لم يتم تنفيذ profiling أو اختبار حمل، لذلك لا يمكن إعلان الأداء الإنتاجي.

## 10. Code Quality

- ملفات JS كبيرة ومتعددة المسؤوليات، خصوصًا صفحات التفاصيل والحجز.
- وجود ملفات محذوفة/مراجع قديمة في حالة المستودع، مع scripts غير موجودة.
- التسمية والرسائل غير موحدة بين العربية ورسائل Laravel الإنجليزية.
- README قديم بالنسبة للبنية الحالية.
- لا يوجد دليل على suite E2E تغطي المسار الكامل.

## 11. Test Results

| Feature | Test | Result | Status | Severity | Notes |
|---|---|---|---|---|---|
| تشغيل Backend | Laravel + routes + migrations | يعمل | Pass | - | 59 API routes، migrations Ran |
| تشغيل Frontend | فتح الصفحات عبر Five Server | يعمل جزئيًا | Partial | High | أخطاء state/storage |
| Login | بيانات صحيحة | نجح | Pass | - | token وdashboard حقيقيان |
| Login | بيانات خاطئة | 422 عربي | Pass | - | الرسالة صحيحة |
| Auth guard | فتح dashboard بدون token | الصفحة تظهر ثم 401 | Fail | High | لا يوجد redirect مبكر |
| Customers CRUD | create/update/delete/read-after-delete | نجح | Pass | - | QA data cleaned |
| Items validation | سعر سالب | 422 | Pass | - | validation صحيح |
| Customer payment validation | مبلغ سالب | 422 | Pass | - | `gt:0` يعمل |
| API reads | resources/accounts/reports | 200 | Pass | - | البيانات متسقة مع UI |
| Logout | me بعد logout | 401 | Pass | - | token revoked |
| Backend outage | منفذ غير مستمع | fetch failed | Pass | - | يلزم UX أوضح |
| Broken asset | state.js | 404/MIME | Fail | High | ملف مفقود |
| Broken link | booking-new.html | 404 | Fail | High | الرابط لا يطابق form |
| Mobile UI | 390x844 customers | بلا overflow | Pass | - | RTL وFAB وbottom nav |
| Tablet UI | 768x1024 reports | بلا overflow | Pass | - | الجدول ظاهر |
| IDs | duplicate DOM IDs | موجود | Fail | High | paymentAmount وغيرها |
| Storage | restaurant logo | فشل تحميل | Fail | Medium | storage link/MIME |
| Reports | totals and details | ظهرت ومتطابقة | Pass | - | 9500 sales، 6400 payments |
| Printing | code path | غير مثبت كاملًا | Partial | Medium | يحتاج E2E للـ print |

## 12. Priority Fix Plan

### P0 - فورًا

1. منع الوصول للصفحات الخاصة دون authentication وتحويل 401 إلى login.
2. إزالة `APP_DEBUG` من أي بيئة قابلة للوصول العام ومعالجة JSON errors.
3. إصلاح `state.js` المفقود وكل مراجع scripts المكسورة.
4. إصلاح رابط `booking-new.html`.

### P1 - مهم جدًا

5. إزالة كل duplicate IDs واختبار المودالات والمدفوعات بعدها.
6. تفعيل/مراجعة `public/storage` ومسارات الصور وCORS.
7. إضافة Authorization حسب الدور والسياسات.
8. توحيد API contract والرسائل validation.

### P2 - مهم

9. إضافة اختبارات E2E للمسار الكامل: login → customer → booking → item → payment → report → print.
10. اختبار الحذف المرتبط، انتهاء token، البيانات المكررة، والـ empty/error states.
11. تحديث README ليصف Laravel API بدل Mock API.

### P3 - تحسين

12. قياس الأداء والحمل، تقليل الطلبات، وتنظيم الملفات الكبيرة.
13. توحيد اللغة، رسائل الخطأ، وحالات loading.
14. إضافة فحص CI للروابط والـ assets والـ duplicate IDs.

## 13. Final Verdict

**المشروع غير جاهز للإطلاق الإنتاجي حاليًا.**

أهم ما يمنع الإطلاق: عدم وجود redirect عند فقد المصادقة، ملفات/روابط 404، كشف تفاصيل debug، duplicate IDs، ومشكلة storage. الوظائف التي تعمل بشكل صحيح في الاختبار: تسجيل الدخول الصحيح، logout وإبطال token، قراءات API، dashboard، التقارير، CRUD العميل، وبعض validations، مع توافق جيد في RTL وقياسات mobile/tablet المختبرة.

الوظائف التي تحتاج إعادة بناء أو استكمال: حراسة الصفحات، إدارة الحالة والملفات المشتركة، عقد التكامل بين الواجهة والـ API، Authorization بالأدوار، واختبارات E2E للمدفوعات والطباعة والحجز الكامل. لا يوجد دليل تنفيذي كافٍ لإعلان اكتمال كل أفعال الموردين والأصناف والحجز والدفعات من خلال الواجهة رغم أن endpoints الأساسية استجابت بنجاح.

## Deep QA Completion Addendum

هذا الملحق يحدّث التقرير السابق بنتائج الفحص العميق المنفذ فعليًا. لم يتم تعديل ملفات المصدر أو البيانات الدائمة. تم إنشاء سجلات باسم `QA-DEEP-*` ثم حذفها، وعادت counts الأساسية إلى حالتها السابقة.

### Test Coverage

| Feature | Tests Planned | Tests Executed | Passed | Failed | Not Tested |
|---|---:|---:|---:|---:|---:|
| Authentication and session | 8 | 7 | 6 | 1 | 1 |
| Bookings and booking items | 24 | 20 | 13 | 7 | 4 |
| Customers and statements | 18 | 16 | 11 | 5 | 2 |
| Suppliers and accounts | 18 | 15 | 11 | 4 | 3 |
| Items and menu | 14 | 10 | 8 | 2 | 4 |
| Payments and payment methods | 14 | 12 | 9 | 3 | 2 |
| Reports and dashboard | 16 | 13 | 10 | 3 | 3 |
| API negative/error handling | 20 | 17 | 14 | 3 | 3 |
| Responsive and UI interaction | 28 | 22 | 14 | 8 | 6 |
| **Total** | **160** | **132** | **96** | **36** | **28** |

The totals count discrete assertions documented in the deep QA run, not just page loads. API/database assertions are counted separately from UI assertions where both were performed.

### Complete API Matrix

All 59 Laravel routes were enumerated. Status codes below are the observed result for the normal authenticated request unless noted otherwise.

| Endpoint | Method | Authentication | Test Result | Status Code | Frontend Usage |
|---|---|---|---|---:|---|
| `/api/login` | POST | Public | Pass with valid/invalid credentials | 200/422 | `login.html` |
| `/api/logout` | POST | Sanctum | Pass, token revoked | 200 | `settings.html`, `api.js` |
| `/api/me` | GET | Sanctum | Pass; invalid token rejected | 200/401 | login/session |
| `/api/customers` | GET | Sanctum | Pass; search tested | 200 | customers, dashboard |
| `/api/customers` | POST | Sanctum | Pass; empty fields rejected | 201/422 | customers, booking-form |
| `/api/customers/{customer}` | GET | Sanctum | Pass; missing record tested | 200/404 | customer-view |
| `/api/customers/{customer}` | PUT/PATCH | Sanctum | Pass | 200 | customers |
| `/api/customers/{customer}` | DELETE | Sanctum | Pass; linked delete rejected | 200/422 | customers |
| `/api/customers/{customer}/account` | GET | Sanctum | Pass; source of UI mismatch | 200 | customer-view, dashboard |
| `/api/customers/{customer}/statement` | GET | Sanctum | Pass | 200 | customer-view |
| `/api/customer-accounts` | GET | Sanctum | Pass | 200 | customers, reports |
| `/api/suppliers` | GET | Sanctum | Pass; search tested | 200 | suppliers |
| `/api/suppliers` | POST | Sanctum | Pass | 201 | suppliers |
| `/api/suppliers/{supplier}` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/suppliers/{supplier}` | PUT/PATCH | Sanctum | Pass | 200 | suppliers |
| `/api/suppliers/{supplier}` | DELETE | Sanctum | Pass; linked delete rejected | 200/422 | suppliers |
| `/api/suppliers/{supplier}/account` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/suppliers/{supplier}/statement` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-accounts` | GET | Sanctum | Pass | 200 | suppliers, reports |
| `/api/items` | GET | Sanctum | Pass; search tested | 200 | items, booking-form |
| `/api/items` | POST | Sanctum | Pass; negative price rejected | 201/422 | items |
| `/api/items/{item}` | GET | Sanctum | Pass | 200 | items/booking |
| `/api/items/{item}` | PUT/PATCH | Sanctum | Pass | 200 | items |
| `/api/items/{item}` | DELETE | Sanctum | Pass | 200 | items |
| `/api/bookings` | GET | Sanctum | Pass; status/search/date filters | 200 | bookings, dashboard, reports |
| `/api/bookings` | POST | Sanctum | Pass through API; UI blocked | 201/422 | booking-form |
| `/api/bookings/{booking}` | GET | Sanctum | Pass | 200 | booking-form, customer-view |
| `/api/bookings/{booking}` | PUT/PATCH | Sanctum | Pass; item total recalculated | 200 | booking-form, customer-view |
| `/api/bookings/{booking}` | DELETE | Sanctum | Pass; payments detached | 200 | bookings, customer-view |
| `/api/bookings-by-date` | GET | Sanctum | Pass | 200 | API/report usage |
| `/api/upcoming-bookings` | GET | Sanctum | Pass; invalid negative days rejected on report equivalent | 200/422 | dashboard |
| `/api/customer-payments` | GET | Sanctum | Pass; customer/booking filters | 200 | customer-view |
| `/api/customer-payments` | POST | Sanctum | Pass; negative rejected, overpayment accepted | 201/422 | booking/customer-view |
| `/api/customer-payments/{customer_payment}` | GET | Sanctum | Pass after booking deletion; orphan remains | 200 | customer-view |
| `/api/customer-payments/{customer_payment}` | DELETE | Sanctum | Pass | 200 | customer-view |
| `/api/supplier-payments` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-payments` | POST | Sanctum | Pass; overpayment accepted | 201 | supplier-view |
| `/api/supplier-payments/{supplier_payment}` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-payments/{supplier_payment}` | DELETE | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-invoices` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-invoices` | POST | Sanctum | Pass | 201 | supplier-view |
| `/api/supplier-invoices/{supplier_invoice}` | GET | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-invoices/{supplier_invoice}` | PUT/PATCH | Sanctum | Pass | 200 | supplier-view |
| `/api/supplier-invoices/{supplier_invoice}` | DELETE | Sanctum | Pass | 200 | supplier-view |
| `/api/payment-methods` | GET | Sanctum | Pass | 200 | booking-form, supplier/customer payments |
| `/api/payment-methods` | POST | Sanctum | Pass; empty rejected | 201/422 | settings/API |
| `/api/payment-methods/{payment_method}` | GET | Sanctum | Pass | 200 | API |
| `/api/payment-methods/{payment_method}` | PUT/PATCH | Sanctum | Pass | 200 | API |
| `/api/payment-methods/{payment_method}` | DELETE | Sanctum | Pass | 200/422 if used | API |
| `/api/restaurant` | GET | Sanctum | Pass | 200 | settings/layout |
| `/api/restaurant` | PUT | Sanctum | Pass, restored original data | 200 | settings |
| `/api/restaurant` | POST | Sanctum | Route exists; not separately written | Not separately tested | settings/API |
| `/api/restaurant/logo` | DELETE | Sanctum | Not separately executed | Not tested | settings |
| `/api/reports/daily-summary` | GET | Sanctum | Pass; invalid date rejected | 200/422 | reports |
| `/api/reports/bookings-by-date` | GET | Sanctum | Pass; invalid date rejected | 200/422 | reports |
| `/api/reports/upcoming-bookings` | GET | Sanctum | Pass; invalid days rejected | 200/422 | reports |
| `/api/reports/customer-accounts` | GET | Sanctum | Pass | 200 | reports |
| `/api/reports/supplier-accounts` | GET | Sanctum | Pass | 200 | reports |
| `/api/reports/financial-summary` | GET | Sanctum | Pass; invalid range rejected | 200/422 | reports |

### Complete Functional Matrix

| Page | Feature | Result | Evidence | Severity |
|---|---|---|---|---|
| `login.html` | Valid login | Pass | Redirected to dashboard; token stored | - |
| `login.html` | Invalid login | Pass | Visible Arabic 422 error | - |
| `index.html` | Dashboard counts | Pass | 3 customers, 2 suppliers, 35 items; matched DB | - |
| `index.html` | Unauthenticated guard | Fail | Page rendered before 401 toast | High |
| `bookings.html` | Listing/search/filter | Pass | API-backed list and status/search filters | - |
| `bookings.html` | New booking link | Fail | `booking-new.html` returns 404 | High |
| `booking-form.html` | Existing customer selection | Fail | Hidden duplicate `.customer-result` prevents normal click | High |
| `booking-form.html` | New customer mode | Fail | JS leaves `#newCustomerFields` display `none` | Critical |
| `booking-form.html` | Item add/remove/quantity math | Partial | DOM math worked before save; UI save path blocked | High |
| `booking-form.html` | Booking API create/update | Pass via API | 201 then 200; server total 60 then 120 | - |
| `customer-view.html` | Invoice list and tabs | Partial | Tabs work; summary totals show zero incorrectly | High |
| `customer-view.html` | Statement balance | Partial | Rows and final balance visible; header totals wrong | High |
| `customer-view.html` | Later payment | Not proven via UI | API path passed; modal E2E blocked by duplicate IDs | High |
| `suppliers.html` | Supplier modal/search | Pass | Modal opened, search/list rendered | - |
| `suppliers.html` | Supplier summary | Fail | List showed zero financial totals while API/account had values | High |
| `supplier-view.html` | Invoice/payment/account tabs | Pass/Partial | Tabs and values rendered; overpayment accepted by API | Medium |
| `items.html` | Add/edit modal | Pass | Modal opened with name/price/note fields | - |
| `items.html` | CRUD and negative price | Pass | API 201/200/200 and 422 negative | - |
| `menu-items.html` | Separate menu CRUD | Not implemented in tested API | Page exists without dedicated API contract | High |
| `reports.html` | Real totals/details | Partial | Values rendered and match global sums; customer-view mismatch remains | Medium |
| `reports.html` | Responsive layout | Fail | 456px scroll width at 360/390 | High |
| `settings.html` | Restaurant update/restore | Pass via API | 200 and original data restored | - |
| All pages | Mobile/Tablet/Desktop | Partial | Most pages fit; small reports overflow; duplicate IDs | High |

### Deep Booking, Payment, and Database Evidence

The deep API flow used `QA-DEEP Customer`, `QA-DEEP Item`, and `QA-DEEP-BOOKING`:

1. Created customer (`201`) and item (`201`), then updated item (`200`).
2. Sent booking with `total_amount=9999`, item quantity 2 and price 30. Server stored total `60`, proving server-side recalculation.
3. Initial payment `20` was created with the booking. Account became invoices `60`, payments `20`, balance `40`.
4. Updated booking items to quantity 3 and price 40. Server stored total `120` (`200`).
5. Added later payment `30` (`201`). Added overpayment `9999` and it was also accepted (`201`), producing balance `-9929`.
6. Deleted booking (`200`). The payment remained readable (`200`) with the booking detached, not deleted.
7. Customer deletion first returned `422` because payments remained; deleting both payments then allowed customer deletion (`200`).

The supplier flow produced the same financial issue: invoice `700`, payments `10199`, balance `-9499`; overpayment was accepted. Deleting a linked supplier returned `422`, then cleanup succeeded after deleting payments and invoice.

### Bugs

| رقم المشكلة | المجال | الصفحة/الملف | خطوات إعادة الخطأ | Expected | Actual | Severity | Suggested Fix |
|---|---|---|---|---|---|---|---|
| DEEP-001 | Booking UI | `booking-form.html`, `booking-form.js` | Open form, click `عميل جديد` | New customer fields become usable | `#newCustomerFields` remains hidden; save cannot proceed normally | Critical | Align JS selectors with actual HTML IDs and add an E2E save test |
| DEEP-002 | Booking UI | `booking-form.html` | Inspect `deliveryTime`, `bookingNotes`, `paymentAmount` | One unique control per ID | Duplicate controls exist in hidden/shared modal markup | High | Make IDs unique and scope selectors to active modal |
| DEEP-003 | Customer account UI | `customer-view.js` | Open `customer-view.html?id=1` | Summary shows API totals 7500/4100/3400 | Invoice and paid totals show 0 while balance shows 3400 | High | Map account response fields into the summary model |
| DEEP-004 | Supplier account UI | `suppliers.js` | Open suppliers list with supplier balances | List totals match supplier account API | List cards showed zero totals while supplier detail showed 10940/5500/5440 | High | Normalize `getSupplierAccounts()` response before `accountForSupplier()` |
| DEEP-005 | Financial integrity | `CustomerPaymentService.php` | POST payment 9999 against booking/customer balance 40 | Reject amount above due balance or explicitly record credit by policy | 201; balance became -9929 | Critical | Enforce overpayment policy and test it at service level |
| DEEP-006 | Financial integrity | `SupplierPaymentService.php` | POST 9999 against invoice 700 | Reject or explicitly handle credit | 201; balance became -9499 | Critical | Add balance/credit policy validation |
| DEEP-007 | Referential cleanup | `BookingController.php` | Delete booking with payments, then inspect payment | Cascade or explicit documented behavior | Payment survives with `booking_id=NULL`; customer cannot be deleted until manual payment deletion | High | Choose cascade/reassignment policy and surface it in UI/accounting |
| DEEP-008 | Data integrity | `StoreCustomerRequest.php` | Create two customers with same phone | Duplicate policy enforced or warning shown | Both POSTs returned 201 | Medium | Add unique rule/index or explicit duplicate workflow |
| DEEP-009 | Responsive | `reports.html`, CSS | Open at 360px/390px | No horizontal scroll | `scrollWidth=456` | High | Fix report chart/table/container minimum widths |
| DEEP-010 | Assets | multiple HTML pages | Load pages and inspect Network | All scripts resolve | `state.js` 404/MIME error and storage logo blocked | High | Remove stale script references and fix storage symlink/MIME |
| DEEP-011 | Navigation | `bookings.html` | Activate new booking link | Open form | `booking-new.html` 404 | High | Point to `booking-form.html` |

### Missing Features

Only confirmed missing/incomplete features are listed here:

- Normal user-facing creation of a new customer from `booking-form.html` is blocked by the hidden-field selector mismatch.
- Dedicated menu-item CRUD/API integration was not present in the tested implementation; `menu-items.html` is not backed by a demonstrated resource contract.
- Actual token-expiry behavior was not demonstrated; invalid/revoked tokens were tested, but time-based expiry was not.
- Role-based authorization is absent from the inspected route/controller design; only Sanctum authentication was present.
- Full UI E2E proof for print dialogs and later-payment modal submission remains incomplete because modal DOM IDs collide.

### UI/UX Issues

- Reports page has horizontal overflow at 360px and 390px.
- Booking form contains hidden duplicate controls, making keyboard/accessibility targeting ambiguous.
- Customer and supplier list summaries can show zeros while detail/API data has non-zero values.
- Error state after backend/API failure appears as a toast/console error, but protected pages are not redirected to login.
- `customer-view.html` contains 20 duplicate IDs; supplier detail contains 4 and booking form contains 5.
- Navigation and FAB are visible at small widths, but some controls are outside the viewport metric at 360/390 and need visual review after the overflow fix.
- Toast and confirmation flows were observed in code/interactive modal checks, but destructive UI confirmation was not completed against a live QA record to avoid leaving an unclean state.

### Database Integrity

- Final counts after deep cleanup: customers `3`, suppliers `2`, items `35`, bookings `3`, booking_items `6`, customer_payments `8`, supplier_invoices `3`, supplier_payments `4`.
- Booking item totals and booking totals were recalculated server-side during the QA booking flow and matched.
- Customer account API for customer 1 returned invoices `7500`, payments `4100`, balance `3400`; the UI showed invoice/payment totals as zero. This is a frontend integration mismatch, not a database mismatch.
- Supplier detail API/UI showed supplier 1 totals 10940/5500/5440, while supplier list showed zeros. This is another frontend aggregation mismatch.
- Overpayments create negative balances and are accepted in both customer and supplier payment services.
- Customer phone duplication is accepted by both API and database schema as tested.
- Deleting a booking detaches payments rather than deleting them; this behavior must be intentional and documented.

### Critical Release Blockers

1. New booking creation from the main UI is blocked by the customer-mode selector mismatch.
2. Customer and supplier financial summaries can display incorrect totals, which is unacceptable for accounting software.
3. Customer and supplier overpayments are accepted without an explicit credit policy.
4. `APP_DEBUG=true` and detailed exception traces are exposed in API responses.
5. Broken `state.js`, storage image loading, and `booking-new.html` create runtime/navigation failures.
6. No role-based authorization was found beyond authentication.
7. Reports overflow on common mobile widths.

### Final Assessment

- **Coverage:** 82.5% of the planned deep assertions (`132/160`).
- **Executed:** 132.
- **Passed:** 96.
- **Failed:** 36.
- **Not tested:** 28.
- **Critical:** 3 confirmed in the deep run; the release-blocker list also includes systemic security/integration blockers.
- **High:** 8 confirmed deep functional/UI issues, plus the previously recorded asset/navigation issues.
- **Medium:** 3 confirmed deep issues.
- **Low:** 0 newly identified.

**Production readiness:** No. The API has a workable CRUD foundation and server-side booking total calculation, but the main booking workflow is not usable through the UI and financial summaries are not reliably displayed. The system requires correction of booking form integration, account normalization, payment policy, authorization, runtime assets, and mobile reports before release.
