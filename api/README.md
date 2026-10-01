# یدک‌یار — بک‌اند واقعی

API کامل با FastAPI + SQLite که سایت را هم خودش سرو می‌کند. یک پورت، یک سرویس.

## اجرای محلی

```bash
pip install -r api/requirements.txt
cd api && uvicorn main:app --host 0.0.0.0 --port 8000
```
سایت: `http://localhost:8000/` · مستندات تعاملی API: `http://localhost:8000/api/docs`

بار اول پایگاه داده از `site/assets/js/seed.js` پر می‌شود (۳۸۸ محصول) و رمز مدیر
در فایل `api/ADMIN_PASSWORD.txt` نوشته می‌شود. آن را جایی امن بگذارید و فایل را پاک کنید.

## چه چیزی واقعاً واقعی شد

| قابلیت | قبلاً | حالا |
|---|---|---|
| کاتالوگ | در مرورگر هر کاربر | جدول `products` روی سرور |
| تغییر قیمت از پنل | فقط مرورگر خودتان | `PATCH /api/admin/products/{id}` → برای همه |
| ثبت سفارش | در localStorage مشتری | جدول `orders` + کسر موجودی اتمیک |
| **قیمت سفارش** | از مرورگر خوانده می‌شد | **از سرور خوانده می‌شود؛ دستکاری ممکن نیست** |
| موجودی | تزئینی | اگر کافی نباشد `409` و سفارش رد می‌شود |
| رمز عبور | متن ساده | PBKDF2-SHA256 با ۲۰۰٬۰۰۰ تکرار و نمک تصادفی |
| نشست | بدون اعتبارسنجی | توکن امضاشده با HMAC-SHA256 و انقضا |
| پیگیری سفارش | — | با کد رهگیری + شمارهٔ موبایل |
| پرداخت | شبیه‌سازی | اتصال واقعی زرین‌پال (نیاز به کد پذیرنده) |
| گزارش تغییرات | — | جدول `audit` |

## نقشهٔ API

**عمومی:** `GET /api/health` · `/api/catalog` · `/api/products` (با `q, vehicleId, categoryId, partId, brand, grade, minPrice, maxPrice, inStock, sort, page`) · `/api/products/{id}` · `/api/brands`

**مشتری:** `POST /api/auth/register` · `/api/auth/login` · `GET|PUT /api/auth/me` · `POST /api/orders` · `GET /api/orders/track?code=&phone=` · `GET /api/orders/mine`

**پرداخت:** `POST /api/pay/start?code=&callback=` · `GET /api/pay/verify`

**مدیر** (هدر `Authorization: Bearer …`): `POST /api/admin/login` · `/api/admin/password` · `GET /api/admin/stats` · `/api/admin/orders` · `PATCH /api/admin/orders/{code}` · `PATCH /api/admin/products/{id}` · `POST /api/admin/products/bulk-price` · `GET|PUT /api/admin/settings` · `GET /api/admin/customers` · `/api/admin/audit`

## متغیرهای محیطی

نمونه در `.env.example`. مهم‌ترین‌ها:

| متغیر | توضیح |
|---|---|
| `YADAKYAR_SECRET` | کلید امضای توکن. **در تولید حتماً تنظیم شود**، وگرنه با هر دیپلوی همهٔ نشست‌ها باطل می‌شود. |
| `YADAKYAR_ADMIN_PASS` | رمز مدیر هنگام ساخت اولیه |
| `YADAKYAR_DB` | مسیر فایل پایگاه داده — روی دیسک پایدار بگذارید |
| `YADAKYAR_ORIGINS` | دامنه‌های مجاز CORS |

## استقرار روی لیارا (پیشنهادی برای ایران)

```bash
npm i -g @liara/cli
liara login
liara deploy --platform docker --port 8000
```
در پنل لیارا یک **دیسک** به نام `data` بسازید و به `/app/data` وصل کنید، سپس
`YADAKYAR_DB=/app/data/yadakyar.db` و `YADAKYAR_SECRET` را در متغیرهای محیطی ثبت کنید.
بدون دیسک، پایگاه داده با هر دیپلوی پاک می‌شود.

## فعال‌سازی درگاه پرداخت

۱. از [زرین‌پال](https://www.zarinpal.com) کد پذیرنده بگیرید (نیاز به نماد اعتماد / جواز کسب).
۲. در پنل مدیریت ← تنظیمات، مقدار `zarinpalMerchant` را وارد و `zarinpalSandbox` را `false` کنید.
۳. تا وقتی کد پذیرنده خالی است، `/api/pay/start` پاسخ `503` با پیام فارسی می‌دهد و
   سفارش به‌صورت «پرداخت در محل» ثبت می‌شود — یعنی سایت هرگز نمی‌شکند.

## نکتهٔ مقیاس

SQLite برای چند ده هزار سفارش کافی است. برای ترافیک بالاتر، `store.py` را به
PostgreSQL ببرید؛ ساختار جدول‌ها یکسان است و فقط اتصال و چند کوئری عوض می‌شود.
