#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
یدک‌یار — موتور به‌روزرسانی ساعتیِ قیمت
=====================================
هر N دقیقه یک‌بار به منبع قیمتِ تنظیم‌شده سر می‌زند، قیمت‌ها را استخراج می‌کند
و در assets/data/prices.json می‌نویسد. سایت این فایل را می‌خواند و قیمت‌ها را
به‌روز می‌کند (بدون نیاز به بیلد مجدد).

تنظیمات در price_config.json:
{
  "enabled": false,
  "source_url": "",            # آدرس صفحهٔ لیست قیمت
  "interval_minutes": 60,
  "selector": "",              # CSS selector اختیاری برای آیتم‌ها
  "match": "name",             # name | oem | sku  → کلید تطبیق
  "margin_percent": 0          # درصد سود روی قیمت مرجع
}

اجرا:  python3 price_worker.py          (حلقهٔ دائمی)
       python3 price_worker.py --once   (یک بار)
"""
import json, os, re, sys, time, datetime, urllib.request, urllib.error, html as htmlmod

BASE = os.path.dirname(os.path.abspath(__file__))
CFG  = os.path.join(BASE, "price_config.json")
OUT  = os.path.join(BASE, "assets", "data", "prices.json")
LOG  = os.path.join(BASE, "assets", "data", "price-log.json")
SEED = os.path.join(BASE, "assets", "js", "seed.js")

DEFAULT = {"enabled": False, "source_url": "", "interval_minutes": 60,
           "selector": "", "match": "name", "margin_percent": 0}


def cfg():
    if os.path.exists(CFG):
        try:
            return {**DEFAULT, **json.load(open(CFG, encoding="utf-8"))}
        except Exception:
            pass
    json.dump(DEFAULT, open(CFG, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return dict(DEFAULT)


def fa2en(s):
    return s.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; YadakyarPriceBot/1.0)",
        "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    enc = r.headers.get_content_charset() or "utf-8"
    return raw.decode(enc, "replace")


PRICE_RE = re.compile(r"([\d۰-۹,٬\.]{4,})\s*(?:تومان|ريال|ریال|تومن)")


def parse(page):
    """استخراج جفت‌های (عنوان، قیمت) از HTML به روش عمومی."""
    txt = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
    blocks = re.split(r"</(?:li|article|div|tr|section)>", txt, flags=re.I)
    out = []
    for b in blocks:
        m = PRICE_RE.search(b)
        if not m:
            continue
        price = int(re.sub(r"\D", "", fa2en(m.group(1))) or 0)
        if price < 10000:          # ریال یا عدد بی‌ربط
            continue
        if price > 100_000_000:
            price //= 10           # احتمالاً ریال بوده
        name = " ".join(htmlmod.unescape(re.sub(r"<[^>]+>", " ", b)).split())
        name = name.replace(m.group(0), " ").strip()[:120]
        if len(name) > 8:
            out.append({"title": name, "price": price})
    # حذف تکراری‌ها
    seen, uniq = set(), []
    for it in out:
        k = it["title"][:60]
        if k in seen:
            continue
        seen.add(k)
        uniq.append(it)
    return uniq


def catalog():
    if not os.path.exists(SEED):
        return []
    s = open(SEED, encoding="utf-8").read()
    return json.loads(s[len("window.SEED="):-1])["products"]


def norm(t):
    t = fa2en(t).lower()
    t = re.sub(r"[يى]", "ی", t).replace("ك", "ک")
    return re.sub(r"[^\w\u0600-\u06FF]+", " ", t).strip()


def match(items, prods, mode, margin):
    upd, idx = {}, []
    for it in items:
        idx.append((set(norm(it["title"]).split()), it))
    for p in prods:
        keys = []
        if mode == "oem":
            keys = [norm(x) for x in p.get("oem", [])]
        elif mode == "sku":
            keys = [norm(p.get("sku", ""))]
        else:
            keys = [norm(p["name"])]
        best, score = None, 0
        for kw in keys:
            kt = set(kw.split())
            if not kt:
                continue
            for toks, it in idx:
                sc = len(kt & toks) / max(1, len(kt))
                if sc > score:
                    score, best = sc, it
        if best and score >= .62:
            price = int(round(best["price"] * (1 + margin / 100) / 1000) * 1000)
            upd[p["id"]] = {"price": price, "ref": best["title"][:80], "score": round(score, 2)}
    return upd


def run_once():
    c = cfg()
    now = datetime.datetime.now().isoformat(timespec="seconds")
    res = {"updatedAt": now, "source": c["source_url"], "count": 0, "prices": {}, "status": "skipped"}
    if not c["enabled"] or not c["source_url"]:
        res["status"] = "disabled"
        res["message"] = "منبع قیمت تنظیم نشده است. آدرس را در پنل مدیریت ← تنظیمات وارد کنید."
    else:
        try:
            page = fetch(c["source_url"])
            items = parse(page)
            upd = match(items, catalog(), c["match"], c["margin_percent"])
            res.update(status="ok", count=len(upd), prices=upd, scanned=len(items))
        except Exception as e:
            res.update(status="error", message=f"{type(e).__name__}: {e}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(res, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log = []
    if os.path.exists(LOG):
        try:
            log = json.load(open(LOG, encoding="utf-8"))
        except Exception:
            log = []
    log.insert(0, {"at": now, "status": res["status"], "count": res["count"],
                   "message": res.get("message", "")})
    json.dump(log[:50], open(LOG, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{now}] status={res['status']} updated={res['count']}")
    return res


if __name__ == "__main__":
    if "--once" in sys.argv:
        run_once()
    else:
        while True:
            run_once()
            time.sleep(max(5, cfg()["interval_minutes"]) * 60)
