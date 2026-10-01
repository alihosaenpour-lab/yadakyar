/* ===== یدک‌یار — دستیار هوشمند فروشگاه =====
   موتور پاسخ‌گویی روی کاتالوگ واقعی سایت (بازیابی + استنتاج قاعده‌محور).
   بدون سرویس ابری کار می‌کند، آفلاین است و هیچ داده‌ای بیرون نمی‌فرستد. */
(function () {
  if (!window.DB) return;

  /* ---------- نرمال‌سازی فارسی ---------- */
  const FA = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
               '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  const norm = t => (t || '').toString()
    .replace(/[۰-۹٠-٩]/g, d => FA[d])
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-\/]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  const money = n => new Intl.NumberFormat('fa-IR').format(n) + ' تومان';
  const faN = n => new Intl.NumberFormat('fa-IR').format(n);

  /* ---------- نمایهٔ جست‌وجو ---------- */
  let IDX = null;
  function index() {
    if (IDX) return IDX;
    const prods = DB.products().filter(p => p.active !== false);
    IDX = prods.map(p => {
      const v = DB.vehicle(p.vehicleId) || {};
      const part = DB.part(p.partId) || {};
      const cat = (DB.categories() || []).find(c => c.id === p.categoryId) || {};
      return {
        p, v, part,
        hay: norm([p.name, p.nameEn, p.brand, p.brandFa, p.sku, (p.oem || []).join(' '),
                   part.name, part.nameEn, cat.name, v.brandFa, v.modelFa, v.brand, v.model,
                   p.grade, p.country, part.system].join(' '))
      };
    });
    return IDX;
  }

  const STOP = new Set(['برای','قیمت','چند','است','هست','چیه','چیست','میخوام','می','خوام','دارید',
    'دارین','چقدر','یه','یک','از','به','با','در','رو','را','و','های','ها','من','خودرو','ماشین','لطفا','سلام']);

  function tokens(q) { return norm(q).split(' ').filter(w => w.length > 1 && !STOP.has(w)); }

  function search(q, limit = 6) {
    const tk = tokens(q); if (!tk.length) return [];
    return index().map(it => {
      let sc = 0;
      tk.forEach(w => {
        if (it.hay.includes(' ' + w + ' ') || it.hay.startsWith(w + ' ')) sc += 3;
        else if (it.hay.includes(w)) sc += 1.5;
      });
      if (it.p.stock > 0) sc += .4;
      if (it.p.gradeCode === 'genuine') sc += .25;
      return { it, sc };
    }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, limit).map(x => x.it);
  }

  /* ---------- کارت محصول در چت ---------- */
  const card = it => `<a class="ac-p" href="product.html?id=${it.p.id}">
      <img src="${it.p.img}" alt="${it.p.name}" loading="lazy">
      <span><b>${it.p.name}</b>
        <i>${it.p.grade} · ${it.p.brandFa || it.p.brand}${it.p.country ? ' · ' + it.p.country : ''}</i>
        <em>${money(it.p.price)} ${it.p.stock > 0 ? '· موجود' : '· ناموجود'}</em></span></a>`;

  const list = items => items.map(card).join('');

  /* ---------- قواعد پاسخ ---------- */
  function answer(qRaw) {
    const q = norm(qRaw);
    const has = (...w) => w.some(x => q.includes(x));

    // احوال‌پرسی
    if (/^(سلام|درود|hi|hello|سلم)\b/.test(q) || q === 'سلام')
      return { t: 'سلام! 👋 من دستیار یدک‌یارم. اسم قطعه، شمارهٔ فنی یا OEM را بنویسید، یا بپرسید «لنت جلو النترا چند؟»' };

    if (has('ممنون', 'مرسی', 'سپاس', 'دمت'))
      return { t: 'خواهش می‌کنم! 🙌 اگر قطعهٔ دیگری لازم داشتید در خدمتم.' };

    // پیگیری سفارش
    if (has('سفارش', 'پیگیری', 'مرسوله', 'کد رهگیری')) {
      const m = qRaw.match(/\d{4,}/);
      if (m) {
        const o = (DB.orders() || []).find(x => String(x.code).includes(m[0]) || String(x.id).includes(m[0]));
        if (o) return { t: `سفارش <b>${o.code || o.id}</b> — وضعیت: <b>${o.status}</b><br>مبلغ: ${money(o.total)}<br><a href="order.html?id=${o.id}">مشاهدهٔ جزئیات ←</a>` };
        return { t: 'سفارشی با این شماره پیدا نکردم. در صفحهٔ <a href="account.html">حساب کاربری</a> همهٔ سفارش‌هایتان را می‌بینید.' };
      }
      return { t: 'شمارهٔ سفارش را بفرستید تا وضعیتش را بگویم، یا از <a href="account.html">حساب کاربری ← سفارش‌ها</a> پیگیری کنید.' };
    }

    // ارسال و گارانتی و پرداخت
    if (has('ارسال', 'پست', 'تیپاکس', 'پیک', 'چند روز'))
      return { t: 'ارسال با <b>پست پیشتاز</b> و <b>تیپاکس</b> به سراسر کشور و <b>پیک</b> در تهران انجام می‌شود. سفارش‌های ثبت‌شده تا ساعت ۱۴ همان روز کاری ارسال می‌شوند.' };
    if (has('گارانتی', 'ضمانت', 'مرجوع', 'پس دادن'))
      return { t: 'گارانتی بر اساس سطح کیفی قطعه است:<br>• اصلی کارخانه: <b>۱۸ ماه</b><br>• OES: <b>۱۲ ماه</b><br>• آفترمارکت باکیفیت: <b>۹ ماه</b><br>• اقتصادی: <b>۶ ماه</b><br>۷ روز مهلت بازگشت کالای سالم و پلمب.' };
    if (has('پرداخت', 'اقساط', 'درب منزل', 'کارت به کارت'))
      return { t: 'پرداخت آنلاین با درگاه بانکی و همچنین <b>پرداخت در محل</b> برای تهران فعال است. مراحل خرید در <a href="checkout.html">صفحهٔ تسویه‌حساب</a> در ۷ گام انجام می‌شود.' };

    // تفاوت سطوح کیفی
    if (has('تفاوت', 'فرق', 'oem', 'oes', 'اصلی', 'اورجینال', 'شرکتی', 'کدام بهتر', 'کدوم بهتر'))
      if (has('تفاوت', 'فرق', 'کدام بهتر', 'کدوم بهتر'))
        return { t: `در یدک‌یار هر قطعه در <b>۴ سطح</b> عرضه می‌شود:<br>
        <b>۱) اصلی کارخانه</b> — همان جعبهٔ سازندهٔ خودرو، بالاترین قیمت و اطمینان.<br>
        <b>۲) OES</b> — همان کارخانهٔ سازنده، جعبهٔ خودش (مثل بوش، دنسو، مان). کیفیت تقریباً یکسان، حدود ۲۵٪ ارزان‌تر.<br>
        <b>۳) آفترمارکت باکیفیت</b> — برند مستقل معتبر، حدود ۴۰٪ ارزان‌تر.<br>
        <b>۴) اقتصادی</b> — مناسب مصرف شهری و بودجهٔ محدود.<br>
        برای قطعات ایمنی (لنت، سنسور، انژکتور) سطح اصلی یا OES توصیه می‌شود.` };

    // خودروهای پشتیبانی‌شده
    if (has('چه خودرو', 'کدام خودرو', 'چه ماشین', 'کدوم ماشین', 'لیست خودرو')) {
      const vs = DB.vehicles();
      return { t: 'در حال حاضر این خودروها پشتیبانی می‌شوند:<br>' +
        vs.map(v => `• <a href="vehicles.html?v=${v.id}">${v.brandFa} ${v.modelFa}</a> (${faN(v.years[0])}–${faN(v.years[v.years.length - 1])})`).join('<br>') };
    }

    // ارزان‌ترین / گران‌ترین
    const cheap = has('ارزان', 'ارزون', 'کمترین قیمت', 'اقتصادی ترین');
    const exp = has('گران', 'گرون', 'بهترین', 'باکیفیت ترین');
    let hits = search(qRaw, 24);
    if (hits.length && (cheap || exp)) {
      hits.sort((a, b) => cheap ? a.p.price - b.p.price : b.p.price - a.p.price);
      return { t: (cheap ? 'ارزان‌ترین' : 'باکیفیت‌ترین') + ' گزینه‌هایی که پیدا کردم:', h: list(hits.slice(0, 4)) };
    }

    // موجودی
    if (has('موجود', 'موجودی', 'هست یا نه')) {
      hits = search(qRaw, 8);
      if (hits.length) {
        const inS = hits.filter(x => x.p.stock > 0);
        return { t: inS.length ? `بله، ${faN(inS.length)} گزینه موجود است:` : 'متأسفانه این مورد فعلاً ناموجود است. گزینه‌های نزدیک:',
                 h: list((inS.length ? inS : hits).slice(0, 4)) };
      }
    }

    // جست‌وجوی عمومی محصول
    hits = search(qRaw, 6);
    if (hits.length) {
      const byPart = {};
      hits.forEach(h => { (byPart[h.p.partId] = byPart[h.p.partId] || []).push(h); });
      const first = hits[0];
      const sameP = (byPart[first.p.partId] || []).slice(0, 4);
      const prices = sameP.map(x => x.p.price);
      let t = `<b>${first.part.name}</b> برای <b>${first.v.brandFa} ${first.v.modelFa}</b> در ${faN(sameP.length)} برند موجود است`;
      if (prices.length > 1) t += ` — از ${money(Math.min(...prices))} تا ${money(Math.max(...prices))}`;
      if (first.p.oemVerified && first.p.oem.length) t += `<br>شمارهٔ OEM تأییدشده: <code>${first.p.oem.join('، ')}</code>`;
      if (first.part.desc) t += `<br><span class="ac-d">${first.part.desc}</span>`;
      return { t, h: list(sameP.length ? sameP : hits.slice(0, 4)) };
    }

    return { t: 'چیزی پیدا نکردم 🤔 این‌طور بپرسید: «فیلتر روغن کرولا»، «لنت جلو النترا چند؟»، «شمع جک S5 موجوده؟» یا شمارهٔ OEM را بنویسید.' };
  }

  /* ---------- رابط کاربری ---------- */
  const CSS = `
.ac-fab{position:fixed;inset-inline-start:22px;bottom:22px;z-index:900;width:58px;height:58px;border-radius:50%;
 border:0;cursor:pointer;color:#fff;font-size:24px;background:linear-gradient(135deg,#2563eb,#0891b2);
 box-shadow:0 14px 34px rgba(37,99,235,.45);transition:.2s}
.ac-fab:hover{transform:translateY(-3px) scale(1.05)}
.ac-fab b{position:absolute;top:-3px;inset-inline-end:-3px;width:16px;height:16px;border-radius:50%;
 background:#22d3ee;border:2px solid #fff;font-size:0}
.ac-w{position:fixed;inset-inline-start:22px;bottom:92px;z-index:901;width:min(390px,calc(100vw - 32px));
 max-height:min(620px,calc(100vh - 130px));display:none;flex-direction:column;overflow:hidden;
 background:#fff;border:1px solid var(--bd,#e2e8f2);border-radius:22px;box-shadow:0 30px 70px rgba(13,32,68,.28)}
.ac-w.on{display:flex;animation:acin .25s ease}
@keyframes acin{from{opacity:0;transform:translateY(14px)}}
.ac-h{display:flex;align-items:center;gap:10px;padding:14px 16px;color:#fff;background:linear-gradient(135deg,#0d2044,#1d4ed8)}
.ac-h b{font-size:15px;display:block;line-height:1.5}.ac-h i{font-size:11.5px;opacity:.82;font-style:normal}
.ac-h .x{margin-inline-start:auto;background:rgba(255,255,255,.16);border:0;color:#fff;width:28px;height:28px;
 border-radius:9px;cursor:pointer;font-size:15px}
.ac-b{flex:1;overflow:auto;padding:14px;background:#f5f8fc;display:flex;flex-direction:column;gap:10px}
.ac-m{max-width:88%;padding:10px 13px;border-radius:15px;font-size:13.5px;line-height:2}
.ac-m.u{align-self:flex-end;background:#1d4ed8;color:#fff;border-bottom-left-radius:5px}
.ac-m.a{align-self:flex-start;background:#fff;border:1px solid var(--bd,#e2e8f2);border-bottom-right-radius:5px;color:#16243d}
.ac-m code{background:#eef3fb;padding:1px 6px;border-radius:6px;font-size:12px;direction:ltr;display:inline-block}
.ac-m a{color:#1d4ed8}
.ac-d{color:#64748b;font-size:12.5px}
.ac-p{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--bd,#e2e8f2);
 border-radius:13px;padding:8px;margin-top:7px;text-decoration:none;transition:.16s}
.ac-p:hover{border-color:#3b82f6;box-shadow:0 6px 16px rgba(37,99,235,.14);transform:translateY(-1px)}
.ac-p img{width:52px;height:52px;object-fit:cover;border-radius:9px;flex:none;background:#f1f5fb}
.ac-p b{display:block;font-size:12.5px;color:#12213b;line-height:1.7}
.ac-p i{display:block;font-size:11px;color:#64748b;font-style:normal}
.ac-p em{display:block;font-size:12.5px;color:#1d4ed8;font-weight:700;font-style:normal;margin-top:2px}
.ac-s{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--bd,#e2e8f2);background:#fff}
.ac-s span{font-size:11.5px;padding:6px 11px;border-radius:999px;cursor:pointer;background:#eef3fb;
 color:#1d4ed8;border:1px solid #dbe6f7;transition:.15s}
.ac-s span:hover{background:#1d4ed8;color:#fff}
.ac-f{display:flex;gap:8px;padding:11px 12px;border-top:1px solid var(--bd,#e2e8f2);background:#fff}
.ac-f input{flex:1;font:inherit;font-size:13.5px;padding:11px 13px;border:1px solid var(--bd,#e2e8f2);
 border-radius:12px;background:#f7fafd;color:#0f1e35}
.ac-f input:focus{outline:0;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.14)}
.ac-f button{border:0;border-radius:12px;padding:0 17px;cursor:pointer;color:#fff;font:inherit;font-size:14px;
 background:linear-gradient(135deg,#2563eb,#0891b2)}
.ac-t{display:flex;gap:4px;padding:11px 14px}
.ac-t i{width:6px;height:6px;border-radius:50%;background:#94a9c6;animation:acb 1.2s infinite}
.ac-t i:nth-child(2){animation-delay:.18s}.ac-t i:nth-child(3){animation-delay:.36s}
@keyframes acb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
@media(max-width:560px){.ac-w{inset-inline:12px;width:auto;bottom:86px}.ac-fab{inset-inline-start:14px;bottom:14px}}`;

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const SUG = ['فیلتر روغن کرولا', 'لنت جلو النترا چند؟', 'شمع جک S5 موجوده؟',
               'فرق اصلی و OES چیه؟', 'چه خودروهایی دارید؟', 'گارانتی چطوریه؟'];

  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <button class="ac-fab" id="acFab" aria-label="دستیار هوشمند">🤖<b></b></button>
  <div class="ac-w" id="acW" role="dialog" aria-label="دستیار هوشمند یدک‌یار">
    <div class="ac-h"><span style="font-size:20px">🤖</span>
      <span><b>دستیار هوشمند یدک‌یار</b><i>جست‌وجو در ${''}کاتالوگ قطعات</i></span>
      <button class="x" id="acX" aria-label="بستن">✕</button></div>
    <div class="ac-b" id="acB"></div>
    <div class="ac-s" id="acS">${SUG.map(s => `<span>${s}</span>`).join('')}</div>
    <form class="ac-f" id="acF"><input id="acI" placeholder="نام قطعه، شمارهٔ فنی یا OEM…" autocomplete="off">
      <button type="submit" aria-label="ارسال">↑</button></form>
  </div>`;
  document.body.appendChild(wrap);

  const W = wrap.querySelector('#acW'), B = wrap.querySelector('#acB'), I = wrap.querySelector('#acI');
  const push = (cls, html) => {
    const d = document.createElement('div'); d.className = 'ac-m ' + cls; d.innerHTML = html;
    B.appendChild(d); B.scrollTop = B.scrollHeight; return d;
  };
  const ask = q => {
    if (!q.trim()) return;
    push('u', q.replace(/</g, '&lt;'));
    I.value = '';
    const t = push('a', '<span class="ac-t"><i></i><i></i><i></i></span>');
    setTimeout(() => {
      const r = answer(q);
      t.innerHTML = r.t + (r.h || '');
      B.scrollTop = B.scrollHeight;
    }, 320 + Math.random() * 260);
  };

  wrap.querySelector('#acFab').onclick = () => {
    W.classList.toggle('on');
    if (W.classList.contains('on')) {
      if (!B.children.length)
        push('a', 'سلام! 👋 من دستیار <b>یدک‌یار</b> هستم.<br>اسم قطعه، شمارهٔ فنی یا OEM را بنویسید تا بین <b>' +
          faN(DB.products().length) + '</b> محصول برایتان پیدا کنم.');
      I.focus();
    }
  };
  wrap.querySelector('#acX').onclick = () => W.classList.remove('on');
  wrap.querySelector('#acF').onsubmit = e => { e.preventDefault(); ask(I.value); };
  wrap.querySelector('#acS').onclick = e => { if (e.target.tagName === 'SPAN') ask(e.target.textContent); };
  addEventListener('keydown', e => { if (e.key === 'Escape') W.classList.remove('on'); });

  window.Assistant = { ask, answer, search };
})();
