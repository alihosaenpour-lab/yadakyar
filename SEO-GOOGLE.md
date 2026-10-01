# راهنمای فعال‌سازی یدک‌یار در گوگل

## ۰) پیش‌نیاز
گوگل فقط سایتی را ایندکس می‌کند که روی یک **دامنهٔ عمومی با HTTPS** بالا باشد.
آدرس `localhost:8080` قابل ایندکس نیست. اول فایل‌های پوشهٔ `site/` را روی هاست یا
GitHub Pages / Cloudflare Pages / Netlify آپلود کنید.

## ۱) جایگزینی دامنه (مهم)
همه‌جا فعلاً `https://example.com` نوشته شده. با دامنهٔ واقعی جایگزین کنید:

```bash
cd site
grep -rl "https://example.com" . | xargs sed -i 's#https://example.com#https://YOUR-DOMAIN.ir#g'
```
این دستور `robots.txt`، `sitemap.xml` و تگ‌های canonical/og:url همهٔ صفحات را یکجا اصلاح می‌کند.

## ۲) تأیید مالکیت در Search Console
۱. به https://search.google.com/search-console بروید ← **Add property** ← **URL prefix** ← آدرس سایت.
۲. روش **HTML tag** را انتخاب کنید و متای داده‌شده را داخل `<head>` فایل `index.html` بگذارید:
   `<meta name="google-site-verification" content="کد-شما">`
۳. دکمهٔ **Verify**.

## ۳) ثبت نقشهٔ سایت
در Search Console ← **Sitemaps** ← وارد کنید: `sitemap.xml` ← Submit.
سپس در **URL Inspection** آدرس صفحهٔ اصلی را بزنید و **Request Indexing** را بزنید.

## ۴) آنچه از قبل آماده شده ✅
| مورد | وضعیت |
|---|---|
| `robots.txt` با Disallow روی admin/cart/checkout/account | ✅ |
| `sitemap.xml` با ۵ صفحهٔ عمومی + lastmod/priority | ✅ |
| `canonical` + `hreflang="fa-IR"` + `og:url` در ۹ صفحه | ✅ |
| `meta description` فارسی یکتا برای هر صفحه | ✅ |
| OpenGraph + Twitter Card | ✅ |
| داده‌های ساختاریافته JSON-LD: Organization + WebSite + Store + SearchAction | ✅ |
| `noindex,nofollow` روی صفحات مدیریتی | ✅ |
| `site.webmanifest` (PWA) + favicon | ✅ |
| `<noscript>` با محتوای متنی و لینک‌های قابل خزش در صفحهٔ اول | ✅ |
| `lang="fa"` + `dir="rtl"` + فونت با `font-display:swap` | ✅ |

## ۵) دو نکتهٔ فنی که روی رتبه اثر دارد
- **محتوای صفحات با JavaScript ساخته می‌شود.** گوگل جاوااسکریپت را اجرا می‌کند ولی با تأخیر و
  ناقص. برای ایندکس شدن تک‌تک ۳۸۸ محصول، در آینده باید صفحات محصول به‌صورت **HTML ایستا**
  تولید شوند (یک اسکریپت پایتون مثل `mkseed.py` می‌تواند برای هر محصول یک فایل بسازد) و
  به `sitemap.xml` اضافه شوند. الان فقط صفحات اصلی ایندکس‌پذیرند.
- **داده‌ها در localStorage هستند، نه سرور.** برای نتایج غنی محصول در گوگل
  (قیمت و موجودی زیر نتیجهٔ جست‌وجو) به JSON-LD از نوع `Product` در HTML هر صفحهٔ محصول نیاز است.
