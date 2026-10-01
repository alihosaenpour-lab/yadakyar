"""
یدک‌یار — لایهٔ پایگاه داده
SQLite با کتابخانهٔ استاندارد پایتون (بدون ORM) تا وابستگی کمتر باشد.
برای PostgreSQL فقط DSN و چند کوئری تغییر می‌کند؛ ساختار جدول‌ها یکسان است.
"""
import sqlite3, json, os, time, hashlib, hmac, secrets, base64, re
from pathlib import Path

DB_PATH = os.environ.get("YADAKYAR_DB", str(Path(__file__).parent / "yadakyar.db"))
SECRET = os.environ.get("YADAKYAR_SECRET", "")
if not SECRET:
    # کلید پایدار محلی؛ در تولید حتماً از متغیر محیطی استفاده شود
    kf = Path(__file__).parent / ".secret"
    if kf.exists():
        SECRET = kf.read_text().strip()
    else:
        SECRET = secrets.token_hex(32)
        kf.write_text(SECRET)
        os.chmod(kf, 0o600)

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS vehicles(
  id TEXT PRIMARY KEY, data TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS parts(
  id TEXT PRIMARY KEY, data TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS categories(
  id TEXT PRIMARY KEY, data TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY,
  sku TEXT, name TEXT, nameEn TEXT,
  partId TEXT, vehicleId TEXT, categoryId TEXT,
  brand TEXT, gradeCode TEXT, tierRank INTEGER,
  price INTEGER, oldPrice INTEGER, stock INTEGER,
  active INTEGER DEFAULT 1,
  oem TEXT, img TEXT,
  data TEXT NOT NULL,
  updatedAt TEXT);
CREATE INDEX IF NOT EXISTS ix_p_vehicle  ON products(vehicleId);
CREATE INDEX IF NOT EXISTS ix_p_part     ON products(partId);
CREATE INDEX IF NOT EXISTS ix_p_cat      ON products(categoryId);
CREATE INDEX IF NOT EXISTS ix_p_brand    ON products(brand);
CREATE INDEX IF NOT EXISTS ix_p_grade    ON products(gradeCode);
CREATE INDEX IF NOT EXISTS ix_p_price    ON products(price);

CREATE TABLE IF NOT EXISTS customers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT, email TEXT,
  pwhash TEXT NOT NULL,
  address TEXT, city TEXT, postcode TEXT,
  createdAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  customerId INTEGER REFERENCES customers(id),
  phone TEXT, name TEXT,
  items TEXT NOT NULL,
  subtotal INTEGER, shipping INTEGER, discount INTEGER, total INTEGER,
  shipMethod TEXT, payMethod TEXT,
  address TEXT, city TEXT, postcode TEXT, note TEXT,
  status TEXT DEFAULT 'pending',
  payStatus TEXT DEFAULT 'unpaid',
  payRef TEXT, payAuthority TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT);
CREATE INDEX IF NOT EXISTS ix_o_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS ix_o_status ON orders(status);

CREATE TABLE IF NOT EXISTS admins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pwhash TEXT NOT NULL,
  createdAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS settings(
  k TEXT PRIMARY KEY, v TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT, action TEXT, target TEXT, detail TEXT, at TEXT);
"""


def conn():
    c = sqlite3.connect(DB_PATH, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init():
    with conn() as c:
        c.executescript(SCHEMA)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------- رمز عبور
def hash_pw(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return "pbkdf2$200000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def check_pw(pw: str, stored: str) -> bool:
    try:
        algo, it, salt, dk = stored.split("$")
        if algo != "pbkdf2":
            return False
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(salt), int(it))
        return hmac.compare_digest(calc, base64.b64decode(dk))
    except Exception:
        return False


# ---------------------------------------------------------------- توکن امضاشده
def make_token(payload: dict, ttl=86400 * 7) -> str:
    body = dict(payload)
    body["exp"] = int(time.time()) + ttl
    raw = base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":")).encode()).rstrip(b"=")
    sig = base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), raw, hashlib.sha256).digest()).rstrip(b"=")
    return (raw + b"." + sig).decode()


def read_token(tok: str):
    try:
        raw, sig = tok.encode().split(b".")
        exp_sig = base64.urlsafe_b64encode(
            hmac.new(SECRET.encode(), raw, hashlib.sha256).digest()).rstrip(b"=")
        if not hmac.compare_digest(sig, exp_sig):
            return None
        body = json.loads(base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4)))
        if body.get("exp", 0) < time.time():
            return None
        return body
    except Exception:
        return None


# ---------------------------------------------------------------- تنظیمات
DEFAULT_SETTINGS = {
    "shopName": "یدک‌یار",
    "freeShipOver": 3_000_000,
    "shipping": [
        {"id": "post", "name": "پست پیشتاز", "price": 65000},
        {"id": "tipax", "name": "تیپاکس (پس‌کرایه)", "price": 0},
        {"id": "peyk", "name": "پیک موتوری تهران", "price": 95000},
    ],
    "payMethods": [
        {"id": "online", "name": "پرداخت اینترنتی", "enabled": True},
        {"id": "cod", "name": "پرداخت در محل", "enabled": True},
    ],
    "zarinpalMerchant": "",
    "zarinpalSandbox": True,
}


def get_settings() -> dict:
    with conn() as c:
        rows = c.execute("SELECT k,v FROM settings").fetchall()
    s = dict(DEFAULT_SETTINGS)
    for r in rows:
        try:
            s[r["k"]] = json.loads(r["v"])
        except Exception:
            s[r["k"]] = r["v"]
    return s


def set_settings(d: dict):
    with conn() as c:
        for k, v in d.items():
            c.execute("INSERT INTO settings(k,v) VALUES(?,?) "
                      "ON CONFLICT(k) DO UPDATE SET v=excluded.v",
                      (k, json.dumps(v, ensure_ascii=False)))


def log(actor, action, target="", detail=""):
    with conn() as c:
        c.execute("INSERT INTO audit(actor,action,target,detail,at) VALUES(?,?,?,?,?)",
                  (actor, action, target, detail, now()))


# ---------------------------------------------------------------- واردکردن کاتالوگ از seed.js
def import_seed(seed_js_path: str, force=False) -> dict:
    with conn() as c:
        n = c.execute("SELECT COUNT(*) n FROM products").fetchone()["n"]
    if n and not force:
        return {"skipped": True, "products": n}

    txt = Path(seed_js_path).read_text(encoding="utf-8").strip()
    txt = re.sub(r"^window\.SEED\s*=\s*", "", txt).rstrip(";")
    seed = json.loads(txt)

    with conn() as c:
        if force:
            for t in ("products", "vehicles", "parts", "categories"):
                c.execute(f"DELETE FROM {t}")
        for v in seed.get("vehicles", []):
            c.execute("INSERT OR REPLACE INTO vehicles(id,data) VALUES(?,?)",
                      (v["id"], json.dumps(v, ensure_ascii=False)))
        for p in seed.get("parts", []):
            c.execute("INSERT OR REPLACE INTO parts(id,data) VALUES(?,?)",
                      (p["id"], json.dumps(p, ensure_ascii=False)))
        for k in seed.get("categories", []):
            c.execute("INSERT OR REPLACE INTO categories(id,data) VALUES(?,?)",
                      (k["id"], json.dumps(k, ensure_ascii=False)))
        for p in seed.get("products", []):
            c.execute("""INSERT OR REPLACE INTO products
              (id,sku,name,nameEn,partId,vehicleId,categoryId,brand,gradeCode,tierRank,
               price,oldPrice,stock,active,oem,img,data,updatedAt)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (p["id"], p.get("sku"), p.get("name"), p.get("nameEn"),
                       p.get("partId"), p.get("vehicleId"), p.get("categoryId"),
                       p.get("brand"), p.get("gradeCode"), p.get("tierRank"),
                       p.get("price"), p.get("oldPrice"), p.get("stock"),
                       1 if p.get("active", True) else 0,
                       " ".join(p.get("oem", [])), p.get("img"),
                       json.dumps(p, ensure_ascii=False), now()))

        # مدیر پیش‌فرض فقط اگر هیچ مدیری نیست
        if not c.execute("SELECT 1 FROM admins LIMIT 1").fetchone():
            pw = os.environ.get("YADAKYAR_ADMIN_PASS") or secrets.token_urlsafe(9)
            c.execute("INSERT INTO admins(username,pwhash,createdAt) VALUES(?,?,?)",
                      ("admin", hash_pw(pw), now()))
            Path(Path(__file__).parent / "ADMIN_PASSWORD.txt").write_text(
                f"نام کاربری: admin\nرمز عبور: {pw}\n\n"
                "این فایل فقط یک‌بار هنگام ساخت پایگاه داده ساخته می‌شود.\n"
                "رمز را جای امنی ذخیره و این فایل را پاک کنید.\n", encoding="utf-8")

    with conn() as c:
        return {
            "skipped": False,
            "products": c.execute("SELECT COUNT(*) n FROM products").fetchone()["n"],
            "vehicles": c.execute("SELECT COUNT(*) n FROM vehicles").fetchone()["n"],
            "parts": c.execute("SELECT COUNT(*) n FROM parts").fetchone()["n"],
            "categories": c.execute("SELECT COUNT(*) n FROM categories").fetchone()["n"],
        }
