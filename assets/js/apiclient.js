/* ===== یدک‌یار — کلاینت API =====
   اگر بک‌اند در دسترس باشد، کاتالوگ از سرور خوانده می‌شود و سفارش/ورود/ویرایش
   واقعاً روی پایگاه دادهٔ سرور انجام می‌شود. اگر در دسترس نباشد، سایت به حالت
   نمایشی (localStorage) برمی‌گردد تا هرگز سفید نشود.
   این فایل باید *قبل از* seed.js و db.js بارگذاری شود. */
(function () {
  'use strict';

  // آدرس API: اگر سایت و API روی یک دامنه باشند، همین دامنه؛ وگرنه data-api روی تگ اسکریپت
  const cur = document.currentScript;
  const BASE = (cur && cur.dataset.api) || window.YADAKYAR_API || '';

  const API = {
    base: BASE,
    online: false,
    reason: '',

    url(p) { return (this.base || '') + p; },

    token() { return localStorage.getItem('yadakyar.token') || ''; },
    setToken(t) { t ? localStorage.setItem('yadakyar.token', t) : localStorage.removeItem('yadakyar.token'); },
    adminToken() { return sessionStorage.getItem('yadakyar.atoken') || ''; },
    setAdminToken(t) { t ? sessionStorage.setItem('yadakyar.atoken', t) : sessionStorage.removeItem('yadakyar.atoken'); },

    /* ---- درخواست ناهمگام ---- */
    async req(path, { method = 'GET', body, admin = false } = {}) {
      const h = { 'Content-Type': 'application/json' };
      const t = admin ? this.adminToken() : this.token();
      if (t) h.Authorization = 'Bearer ' + t;
      const r = await fetch(this.url(path), {
        method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'
      });
      let d = null;
      try { d = await r.json(); } catch (e) { d = null; }
      if (!r.ok) {
        const msg = (d && (d.detail || d.message)) || ('خطای سرور ' + r.status);
        const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        err.status = r.status;
        throw err;
      }
      return d;
    },

    /* ---- بارگذاری همگام کاتالوگ در شروع ----
       یک درخواست کوتاه همگام تا صفحات موجود (که داده را همگام می‌خوانند)
       بدون بازنویسی کار کنند. فقط یک‌بار در شروع صفحه اجرا می‌شود. */
    bootSync() {
      try {
        const x = new XMLHttpRequest();
        x.open('GET', this.url('/api/catalog'), false);
        x.send(null);
        if (x.status !== 200) { this.reason = 'catalog ' + x.status; return false; }
        const cat = JSON.parse(x.responseText);

        const y = new XMLHttpRequest();
        y.open('GET', this.url('/api/products?all=true'), false);
        y.send(null);
        if (y.status !== 200) { this.reason = 'products ' + y.status; return false; }
        const pr = JSON.parse(y.responseText);

        window.SEED = Object.assign({}, window.SEED || {}, {
          vehicles: cat.vehicles, parts: cat.parts, categories: cat.categories,
          products: pr.items,
          meta: Object.assign({}, (window.SEED && window.SEED.meta) || {},
            { source: 'api', total: pr.total, loadedAt: new Date().toISOString() })
        });
        window.API_SETTINGS = cat.settings || {};
        this.online = true;
        return true;
      } catch (e) {
        this.reason = String(e && e.message || e);
        return false;
      }
    },

    /* ---- عملیات واقعی ---- */
    createOrder(o) { return this.req('/api/orders', { method: 'POST', body: o }); },
    track(code, phone) {
      return this.req('/api/orders/track?code=' + encodeURIComponent(code) +
        '&phone=' + encodeURIComponent(phone));
    },
    myOrders() { return this.req('/api/orders/mine'); },

    async register(d) { const r = await this.req('/api/auth/register', { method: 'POST', body: d }); this.setToken(r.token); return r; },
    async login(d) { const r = await this.req('/api/auth/login', { method: 'POST', body: d }); this.setToken(r.token); return r; },
    logout() { this.setToken(''); },
    me() { return this.req('/api/auth/me'); },
    saveMe(d) { return this.req('/api/auth/me', { method: 'PUT', body: d }); },

    async adminLogin(username, password) {
      const r = await this.req('/api/admin/login', { method: 'POST', body: { username, password } });
      this.setAdminToken(r.token); return r;
    },
    adminLogout() { this.setAdminToken(''); },
    stats() { return this.req('/api/admin/stats', { admin: true }); },
    adminOrders() { return this.req('/api/admin/orders', { admin: true }); },
    patchOrder(code, d) { return this.req('/api/admin/orders/' + code, { method: 'PATCH', body: d, admin: true }); },
    patchProduct(id, d) { return this.req('/api/admin/products/' + id, { method: 'PATCH', body: d, admin: true }); },
    bulkPrice(d) { return this.req('/api/admin/products/bulk-price', { method: 'POST', body: d, admin: true }); },
    getSettings() { return this.req('/api/admin/settings', { admin: true }); },
    putSettings(d) { return this.req('/api/admin/settings', { method: 'PUT', body: d, admin: true }); },
    customers() { return this.req('/api/admin/customers', { admin: true }); },
    audit() { return this.req('/api/admin/audit', { admin: true }); },
    payStart(code) {
      const cb = location.origin + '/api/pay/verify';
      return this.req('/api/pay/start?code=' + encodeURIComponent(code) +
        '&callback=' + encodeURIComponent(cb), { method: 'POST' });
    }
  };

  window.API = API;
  API.bootSync();

  /* نوار وضعیت وقتی بک‌اند نیست — تا کاربر بداند حالت نمایشی است */
  if (!API.online) {
    document.addEventListener('DOMContentLoaded', function () {
      if (/admin/.test(location.pathname) || document.getElementById('demo-bar')) return;
      const b = document.createElement('div');
      b.id = 'demo-bar';
      b.textContent = 'حالت نمایشی — سرور متصل نیست؛ سفارش‌ها فقط در همین مرورگر ذخیره می‌شوند.';
      b.style.cssText = 'position:fixed;inset-inline:0;bottom:0;z-index:9998;background:#92400e;color:#fff;' +
        'font-size:12.5px;text-align:center;padding:7px 12px;font-family:inherit';
      document.body.appendChild(b);
    });
  }
})();
