"""
یدک‌یار — API واقعی
اجرا:  uvicorn main:app --host 0.0.0.0 --port 8000
مستندات خودکار:  /api/docs
"""
import json, os, time, secrets, urllib.request, urllib.error
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import store

ROOT = Path(__file__).resolve().parent
SITE = Path(os.environ.get("YADAKYAR_SITE", ROOT.parent / "site"))

app = FastAPI(title="یدک‌یار API", version="1.0.0",
              docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")

ALLOWED = os.environ.get("YADAKYAR_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup():
    store.init()
    seed = SITE / "assets" / "js" / "seed.js"
    if seed.exists():
        r = store.import_seed(str(seed))
        print("seed:", r)


# ------------------------------------------------------------------ کمکی
def J(row, extra=None):
    d = json.loads(row["data"])
    if extra:
        d.update(extra)
    return d


def live(row):
    """دادهٔ محصول با قیمت/موجودی زندهٔ ستون‌های جدول (نه نسخهٔ منجمد JSON)."""
    return J(row, {"price": row["price"], "oldPrice": row["oldPrice"],
                   "stock": row["stock"], "active": bool(row["active"]),
                   "img": row["img"]})


def auth_admin(authorization: Optional[str] = Header(None)):
    tok = (authorization or "").removeprefix("Bearer ").strip()
    body = store.read_token(tok)
    if not body or body.get("role") != "admin":
        raise HTTPException(401, "دسترسی مدیر لازم است")
    return body


def auth_user(authorization: Optional[str] = Header(None)):
    tok = (authorization or "").removeprefix("Bearer ").strip()
    body = store.read_token(tok)
    if not body or body.get("role") != "customer":
        raise HTTPException(401, "ابتدا وارد شوید")
    return body


def maybe_user(authorization: Optional[str] = Header(None)):
    tok = (authorization or "").removeprefix("Bearer ").strip()
    b = store.read_token(tok) if tok else None
    return b if b and b.get("role") == "customer" else None


# ------------------------------------------------------------------ کاتالوگ
@app.get("/api/health")
def health():
    with store.conn() as c:
        n = c.execute("SELECT COUNT(*) n FROM products").fetchone()["n"]
    return {"ok": True, "products": n, "time": store.now()}


@app.get("/api/catalog")
def catalog():
    """یک‌جا: خودروها، قطعات، دسته‌ها و تنظیمات عمومی — برای بارگذاری اولیهٔ سایت."""
    with store.conn() as c:
        s = store.get_settings()
        return {
            "vehicles": [json.loads(r["data"]) for r in c.execute("SELECT data FROM vehicles")],
            "parts": [json.loads(r["data"]) for r in c.execute("SELECT data FROM parts")],
            "categories": [json.loads(r["data"]) for r in c.execute("SELECT data FROM categories")],
            "settings": {"shopName": s["shopName"], "freeShipOver": s["freeShipOver"],
                         "shipping": s["shipping"], "payMethods": s["payMethods"]},
        }


@app.get("/api/products")
def products(q: Optional[str] = None, vehicleId: Optional[str] = None,
             categoryId: Optional[str] = None, partId: Optional[str] = None,
             brand: Optional[str] = None, grade: Optional[str] = None,
             minPrice: Optional[int] = None, maxPrice: Optional[int] = None,
             inStock: Optional[bool] = None, sort: str = "pop",
             page: int = 1, perPage: int = 24, all: bool = False):
    w, p = ["active=1"], []
    if vehicleId:  w.append("vehicleId=?"); p.append(vehicleId)
    if categoryId: w.append("categoryId=?"); p.append(categoryId)
    if partId:     w.append("partId=?"); p.append(partId)
    if brand:      w.append("brand=?"); p.append(brand)
    if grade:      w.append("gradeCode=?"); p.append(grade)
    if minPrice:   w.append("price>=?"); p.append(minPrice)
    if maxPrice:   w.append("price<=?"); p.append(maxPrice)
    if inStock:    w.append("stock>0")
    if q:
        w.append("(name LIKE ? OR nameEn LIKE ? OR sku LIKE ? OR oem LIKE ? OR brand LIKE ?)")
        p += [f"%{q}%"] * 5
    order = {"cheap": "price ASC", "exp": "price DESC", "new": "id DESC",
             "pop": "tierRank ASC, price DESC"}.get(sort, "tierRank ASC")
    where = " AND ".join(w)
    with store.conn() as c:
        total = c.execute(f"SELECT COUNT(*) n FROM products WHERE {where}", p).fetchone()["n"]
        sql = f"SELECT * FROM products WHERE {where} ORDER BY {order}"
        if not all:
            sql += " LIMIT ? OFFSET ?"
            p = p + [max(1, min(perPage, 100)), (max(1, page) - 1) * perPage]
        rows = c.execute(sql, p).fetchall()
    return {"total": total, "page": page, "items": [live(r) for r in rows]}


@app.get("/api/products/{pid}")
def product(pid: str):
    with store.conn() as c:
        r = c.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if not r:
        raise HTTPException(404, "محصول یافت نشد")
    return live(r)


@app.get("/api/brands")
def brands():
    with store.conn() as c:
        rows = c.execute("SELECT brand, COUNT(*) n FROM products WHERE active=1 "
                         "GROUP BY brand ORDER BY n DESC").fetchall()
    return [{"brand": r["brand"], "count": r["n"]} for r in rows]


# ------------------------------------------------------------------ حساب مشتری
class Reg(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=6, max_length=128)
    name: str = ""
    email: str = ""


class Login(BaseModel):
    phone: str
    password: str


@app.post("/api/auth/register")
def register(b: Reg):
    phone = b.phone.strip()
    with store.conn() as c:
        if c.execute("SELECT 1 FROM customers WHERE phone=?", (phone,)).fetchone():
            raise HTTPException(409, "این شمارهٔ موبایل قبلاً ثبت شده است")
        cur = c.execute("INSERT INTO customers(phone,name,email,pwhash,createdAt) VALUES(?,?,?,?,?)",
                        (phone, b.name.strip(), b.email.strip(), store.hash_pw(b.password), store.now()))
        uid = cur.lastrowid
    return {"token": store.make_token({"role": "customer", "uid": uid, "phone": phone}),
            "user": {"id": uid, "phone": phone, "name": b.name}}


@app.post("/api/auth/login")
def login(b: Login):
    with store.conn() as c:
        r = c.execute("SELECT * FROM customers WHERE phone=?", (b.phone.strip(),)).fetchone()
    if not r or not store.check_pw(b.password, r["pwhash"]):
        raise HTTPException(401, "شمارهٔ موبایل یا رمز عبور نادرست است")
    return {"token": store.make_token({"role": "customer", "uid": r["id"], "phone": r["phone"]}),
            "user": {"id": r["id"], "phone": r["phone"], "name": r["name"], "email": r["email"],
                     "address": r["address"], "city": r["city"], "postcode": r["postcode"]}}


@app.get("/api/auth/me")
def me(u=Depends(auth_user)):
    with store.conn() as c:
        r = c.execute("SELECT id,phone,name,email,address,city,postcode FROM customers WHERE id=?",
                      (u["uid"],)).fetchone()
    if not r:
        raise HTTPException(404, "کاربر یافت نشد")
    return dict(r)


class Profile(BaseModel):
    name: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    postcode: str = ""


@app.put("/api/auth/me")
def update_me(b: Profile, u=Depends(auth_user)):
    with store.conn() as c:
        c.execute("UPDATE customers SET name=?,email=?,address=?,city=?,postcode=? WHERE id=?",
                  (b.name, b.email, b.address, b.city, b.postcode, u["uid"]))
    return {"ok": True}


# ------------------------------------------------------------------ سفارش
class Item(BaseModel):
    id: str
    qty: int = Field(ge=1, le=99)


class NewOrder(BaseModel):
    items: List[Item]
    name: str
    phone: str
    address: str
    city: str = ""
    postcode: str = ""
    note: str = ""
    shipMethod: str = "post"
    payMethod: str = "cod"


@app.post("/api/orders")
def create_order(b: NewOrder, request: Request, u=Depends(maybe_user)):
    if not b.items:
        raise HTTPException(400, "سبد خرید خالی است")
    s = store.get_settings()
    lines, subtotal = [], 0

    with store.conn() as c:
        for it in b.items:
            r = c.execute("SELECT * FROM products WHERE id=? AND active=1", (it.id,)).fetchone()
            if not r:
                raise HTTPException(400, f"محصول {it.id} موجود نیست")
            if r["stock"] < it.qty:
                raise HTTPException(409, f"موجودی «{r['name']}» کافی نیست (موجود: {r['stock']})")
            # قیمت از سرور خوانده می‌شود، نه از مرورگر — جلوگیری از دستکاری
            line = r["price"] * it.qty
            subtotal += line
            lines.append({"id": r["id"], "sku": r["sku"], "name": r["name"],
                          "brand": r["brand"], "img": r["img"],
                          "price": r["price"], "qty": it.qty, "sum": line})

        ship = next((x["price"] for x in s["shipping"] if x["id"] == b.shipMethod), 0)
        if subtotal >= s["freeShipOver"]:
            ship = 0
        total = subtotal + ship
        code = str(100000 + int(time.time()) % 900000) + secrets.choice("0123456789")

        cur = c.execute("""INSERT INTO orders
          (code,customerId,phone,name,items,subtotal,shipping,discount,total,
           shipMethod,payMethod,address,city,postcode,note,status,payStatus,createdAt,updatedAt)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (code, u["uid"] if u else None, b.phone.strip(), b.name.strip(),
                         json.dumps(lines, ensure_ascii=False), subtotal, ship, 0, total,
                         b.shipMethod, b.payMethod, b.address, b.city, b.postcode, b.note,
                         "pending", "unpaid", store.now(), store.now()))
        oid = cur.lastrowid
        # کسر موجودی
        for it in b.items:
            c.execute("UPDATE products SET stock=stock-? WHERE id=?", (it.qty, it.id))

    store.log(b.phone, "order.create", code, f"total={total}")
    return {"id": oid, "code": code, "subtotal": subtotal, "shipping": ship, "total": total,
            "payMethod": b.payMethod, "status": "pending"}


@app.get("/api/orders/track")
def track(code: str = Query(...), phone: str = Query(...)):
    with store.conn() as c:
        r = c.execute("SELECT * FROM orders WHERE code=? AND phone=?",
                      (code.strip(), phone.strip())).fetchone()
    if not r:
        raise HTTPException(404, "سفارشی با این کد و شماره یافت نشد")
    d = dict(r)
    d["items"] = json.loads(d["items"])
    return d


@app.get("/api/orders/mine")
def my_orders(u=Depends(auth_user)):
    with store.conn() as c:
        rows = c.execute("SELECT * FROM orders WHERE customerId=? OR phone=? ORDER BY id DESC",
                         (u["uid"], u["phone"])).fetchall()
    out = []
    for r in rows:
        d = dict(r); d["items"] = json.loads(d["items"]); out.append(d)
    return out


# ------------------------------------------------------------------ پرداخت زرین‌پال
ZP = "https://sandbox.zarinpal.com/pg/v4/payment/{}.json"
ZP_LIVE = "https://api.zarinpal.com/pg/v4/payment/{}.json"
ZP_GATE = "https://sandbox.zarinpal.com/pg/StartPay/{}"
ZP_GATE_LIVE = "https://www.zarinpal.com/pg/StartPay/{}"


def zp_call(path, payload, sandbox):
    url = (ZP if sandbox else ZP_LIVE).format(path)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


@app.post("/api/pay/start")
def pay_start(code: str, callback: str):
    s = store.get_settings()
    if not s.get("zarinpalMerchant"):
        raise HTTPException(503, "درگاه پرداخت هنوز پیکربندی نشده است. "
                                 "کد پذیرندهٔ زرین‌پال را در پنل مدیریت وارد کنید.")
    with store.conn() as c:
        o = c.execute("SELECT * FROM orders WHERE code=?", (code,)).fetchone()
    if not o:
        raise HTTPException(404, "سفارش یافت نشد")
    if o["payStatus"] == "paid":
        raise HTTPException(409, "این سفارش قبلاً پرداخت شده است")
    try:
        r = zp_call("request", {
            "merchant_id": s["zarinpalMerchant"],
            "amount": o["total"] * 10,          # زرین‌پال ریال می‌گیرد
            "description": f"سفارش {code} — یدک‌یار",
            "callback_url": callback,
            "metadata": {"mobile": o["phone"]},
        }, s.get("zarinpalSandbox", True))
    except urllib.error.URLError as e:
        raise HTTPException(502, f"ارتباط با درگاه برقرار نشد: {e}")
    data = r.get("data") or {}
    if data.get("code") != 100:
        raise HTTPException(502, f"درگاه خطا داد: {r.get('errors')}")
    auth = data["authority"]
    with store.conn() as c:
        c.execute("UPDATE orders SET payAuthority=?,updatedAt=? WHERE code=?",
                  (auth, store.now(), code))
    gate = (ZP_GATE if s.get("zarinpalSandbox", True) else ZP_GATE_LIVE).format(auth)
    return {"url": gate, "authority": auth}


@app.get("/api/pay/verify")
def pay_verify(Authority: str, Status: str = "OK"):
    s = store.get_settings()
    with store.conn() as c:
        o = c.execute("SELECT * FROM orders WHERE payAuthority=?", (Authority,)).fetchone()
    if not o:
        raise HTTPException(404, "تراکنش یافت نشد")
    if Status != "OK":
        with store.conn() as c:
            c.execute("UPDATE orders SET payStatus='failed',updatedAt=? WHERE id=?",
                      (store.now(), o["id"]))
        return RedirectResponse(f"/order.html?code={o['code']}&pay=failed")
    r = zp_call("verify", {"merchant_id": s["zarinpalMerchant"],
                           "amount": o["total"] * 10, "authority": Authority},
                s.get("zarinpalSandbox", True))
    data = r.get("data") or {}
    ok = data.get("code") in (100, 101)
    with store.conn() as c:
        c.execute("UPDATE orders SET payStatus=?,payRef=?,status=?,updatedAt=? WHERE id=?",
                  ("paid" if ok else "failed", str(data.get("ref_id", "")),
                   "paid" if ok else o["status"], store.now(), o["id"]))
    store.log(o["phone"], "pay.verify", o["code"], str(data.get("ref_id", "")))
    return RedirectResponse(f"/order.html?code={o['code']}&pay={'ok' if ok else 'failed'}")


# ------------------------------------------------------------------ مدیر
class AdminLogin(BaseModel):
    username: str
    password: str


@app.post("/api/admin/login")
def admin_login(b: AdminLogin):
    with store.conn() as c:
        r = c.execute("SELECT * FROM admins WHERE username=?", (b.username.strip(),)).fetchone()
    if not r or not store.check_pw(b.password, r["pwhash"]):
        time.sleep(1)       # کند کردن حملهٔ حدس رمز
        raise HTTPException(401, "نام کاربری یا رمز عبور نادرست است")
    store.log(b.username, "admin.login")
    return {"token": store.make_token({"role": "admin", "u": r["username"]}, ttl=86400),
            "username": r["username"]}


class PwChange(BaseModel):
    current: str
    new: str = Field(min_length=8)


@app.post("/api/admin/password")
def admin_password(b: PwChange, a=Depends(auth_admin)):
    with store.conn() as c:
        r = c.execute("SELECT * FROM admins WHERE username=?", (a["u"],)).fetchone()
        if not store.check_pw(b.current, r["pwhash"]):
            raise HTTPException(401, "رمز فعلی نادرست است")
        c.execute("UPDATE admins SET pwhash=? WHERE id=?", (store.hash_pw(b.new), r["id"]))
    store.log(a["u"], "admin.password")
    return {"ok": True}


@app.get("/api/admin/stats")
def stats(a=Depends(auth_admin)):
    with store.conn() as c:
        g = lambda q, *p: c.execute(q, p).fetchone()[0]
        return {
            "products": g("SELECT COUNT(*) FROM products WHERE active=1"),
            "outOfStock": g("SELECT COUNT(*) FROM products WHERE stock=0 AND active=1"),
            "orders": g("SELECT COUNT(*) FROM orders"),
            "pending": g("SELECT COUNT(*) FROM orders WHERE status='pending'"),
            "paid": g("SELECT COUNT(*) FROM orders WHERE payStatus='paid'"),
            "revenue": g("SELECT COALESCE(SUM(total),0) FROM orders WHERE payStatus='paid'"),
            "customers": g("SELECT COUNT(*) FROM customers"),
        }


@app.get("/api/admin/orders")
def admin_orders(status: Optional[str] = None, a=Depends(auth_admin)):
    q = "SELECT * FROM orders"
    p = []
    if status:
        q += " WHERE status=?"; p.append(status)
    q += " ORDER BY id DESC LIMIT 500"
    with store.conn() as c:
        rows = c.execute(q, p).fetchall()
    out = []
    for r in rows:
        d = dict(r); d["items"] = json.loads(d["items"]); out.append(d)
    return out


class OrderPatch(BaseModel):
    status: Optional[str] = None
    payStatus: Optional[str] = None


@app.patch("/api/admin/orders/{code}")
def patch_order(code: str, b: OrderPatch, a=Depends(auth_admin)):
    sets, p = [], []
    if b.status:    sets.append("status=?"); p.append(b.status)
    if b.payStatus: sets.append("payStatus=?"); p.append(b.payStatus)
    if not sets:
        raise HTTPException(400, "چیزی برای تغییر نیست")
    sets.append("updatedAt=?"); p.append(store.now()); p.append(code)
    with store.conn() as c:
        c.execute(f"UPDATE orders SET {','.join(sets)} WHERE code=?", p)
    store.log(a["u"], "order.update", code, json.dumps(b.model_dump(exclude_none=True)))
    return {"ok": True}


class ProductPatch(BaseModel):
    price: Optional[int] = None
    oldPrice: Optional[int] = None
    stock: Optional[int] = None
    active: Optional[bool] = None
    img: Optional[str] = None
    name: Optional[str] = None


@app.patch("/api/admin/products/{pid}")
def patch_product(pid: str, b: ProductPatch, a=Depends(auth_admin)):
    with store.conn() as c:
        r = c.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        if not r:
            raise HTTPException(404, "محصول یافت نشد")
        d = json.loads(r["data"])
        sets, p = [], []
        for k, v in b.model_dump(exclude_none=True).items():
            d[k] = v
            sets.append(f"{k}=?")
            p.append(int(v) if isinstance(v, bool) else v)
        sets += ["data=?", "updatedAt=?"]
        p += [json.dumps(d, ensure_ascii=False), store.now(), pid]
        c.execute(f"UPDATE products SET {','.join(sets)} WHERE id=?", p)
    store.log(a["u"], "product.update", pid, json.dumps(b.model_dump(exclude_none=True), ensure_ascii=False))
    return {"ok": True}


class BulkPrice(BaseModel):
    percent: float
    vehicleId: Optional[str] = None
    gradeCode: Optional[str] = None


@app.post("/api/admin/products/bulk-price")
def bulk_price(b: BulkPrice, a=Depends(auth_admin)):
    w, p = ["1=1"], []
    if b.vehicleId: w.append("vehicleId=?"); p.append(b.vehicleId)
    if b.gradeCode: w.append("gradeCode=?"); p.append(b.gradeCode)
    f = 1 + b.percent / 100
    with store.conn() as c:
        n = c.execute(f"UPDATE products SET oldPrice=price, "
                      f"price=CAST(ROUND(price*{f}/10000.0) AS INTEGER)*10000, updatedAt='{store.now()}' "
                      f"WHERE {' AND '.join(w)}", p).rowcount
    store.log(a["u"], "product.bulk_price", "", f"{b.percent}% n={n}")
    return {"updated": n}


@app.get("/api/admin/settings")
def admin_get_settings(a=Depends(auth_admin)):
    return store.get_settings()


@app.put("/api/admin/settings")
def admin_put_settings(body: dict, a=Depends(auth_admin)):
    store.set_settings(body)
    store.log(a["u"], "settings.update", "", ",".join(body.keys()))
    return {"ok": True}


@app.get("/api/admin/customers")
def admin_customers(a=Depends(auth_admin)):
    with store.conn() as c:
        rows = c.execute("SELECT id,phone,name,email,city,createdAt FROM customers "
                         "ORDER BY id DESC LIMIT 500").fetchall()
    return [dict(r) for r in rows]


@app.get("/api/admin/audit")
def admin_audit(a=Depends(auth_admin)):
    with store.conn() as c:
        rows = c.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 200").fetchall()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------ سرو کردن خود سایت
if SITE.exists():
    app.mount("/", StaticFiles(directory=str(SITE), html=True), name="site")
