# -*- coding: utf-8 -*-
"""می‌سازد: assets/img/brand/<partId>-<tier>.jpg
عکس خام قطعه + پس‌زمینه و نوار رنگی مخصوص سطح برند + نام لاتین برند.
هیچ لوگوی ثبت‌شده‌ای بازتولید نمی‌شود؛ فقط نام برند به‌صورت متن."""
import os, json, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "site/assets/img"; OUT = "site/assets/img/brand"
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

TIERS = {
 "genuine": dict(c1=(11,32,68),  c2=(29,78,216), tag="GENUINE OE",   bar=(37,99,235)),
 "oes":     dict(c1=(6,59,74),   c2=(14,116,144),tag="OES SUPPLIER", bar=(8,145,178)),
 "quality":  dict(c1=(60,29,10), c2=(180,83,9),  tag="QUALITY AFTERMARKET", bar=(217,119,6)),
 "economy": dict(c1=(24,50,30),  c2=(4,120,87),  tag="ECONOMY",      bar=(5,150,105)),
}
W = H = 560

def grad(w,h,c1,c2):
    g = Image.new("RGB",(1,h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t=y/(h-1)
        d.point((0,y),tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3)))
    return g.resize((w,h),Image.BILINEAR)

def build(part_img, tier, brand_en, out):
    T = TIERS[tier]
    src = Image.open(part_img).convert("RGB")
    # تمام‌قاب: عکس قطعه کل کارت را پر می‌کند (بدون مربع پس‌زمینهٔ تودرتو)
    r = max(W/src.width, H/src.height)
    src = src.resize((int(src.width*r+1), int(src.height*r+1)), Image.LANCZOS)
    left = (src.width-W)//2; top = (src.height-H)//2
    card = src.crop((left, top, left+W, top+H))

    # ملایم‌سازی رنگ کلی به سمت رنگ سطح برند (۸٪) تا چهار نسخه از هم متمایز شوند
    tintv = Image.new("RGB",(W,H),T["c2"])
    card = Image.blend(card, tintv, 0.07)

    ov = Image.new("RGBA",(W,H),(0,0,0,0)); d = ImageDraw.Draw(ov)
    # سایه‌بان پایین برای خوانایی نام برند
    for i in range(150):
        a = int(210*(i/149)**1.7)
        d.line((0,H-150+i,W,H-150+i), fill=T["c1"]+(a,))
    # نوار رنگی بالا + ریبون گوشه
    d.rectangle((0,0,W,7), fill=T["bar"]+(255,))
    d.polygon([(W,0),(W,96),(W-96,0)], fill=T["bar"]+(235,))
    card = Image.alpha_composite(card.convert("RGBA"), ov).convert("RGB")

    d = ImageDraw.Draw(card,"RGBA")
    fb = ImageFont.truetype(FB,34); fr = ImageFont.truetype(FR,13); fs = ImageFont.truetype(FB,12)
    # نام برند
    tw = d.textlength(brand_en,font=fb)
    d.text(((W-tw)/2+1,H-92+1), brand_en, font=fb, fill=(0,0,0,110))
    d.text(((W-tw)/2,  H-92),   brand_en, font=fb, fill=(255,255,255))
    # خط جداکننده + تگ سطح
    d.line((W/2-46,H-46,W/2+46,H-46), fill=(255,255,255,130), width=2)
    tw2 = d.textlength(T["tag"],font=fr)
    d.text(((W-tw2)/2,H-38), T["tag"], font=fr, fill=(255,255,255,215))
    # کد سطح روی ریبون
    code = {"genuine":"OE","oes":"OES","quality":"AM","economy":"ECO"}[tier]
    tw3 = d.textlength(code,font=fs)
    d.text((W-52-tw3/2, 20), code, font=fs, fill=(255,255,255))
    card.save(out,"JPEG",quality=86,optimize=True,progressive=True)

seed = json.loads(open("site/assets/js/seed.js",encoding="utf-8").read()[len("window.SEED="):-1])
partimg = {p["id"]: p["imgUrl"].replace("assets/img/","") for p in seed["parts"]}
seen = set(); n = 0
for pr in seed["products"]:
    key = (pr["partId"], pr["gradeCode"])
    if key in seen: continue
    seen.add(key)
    src = os.path.join(SRC, partimg[pr["partId"]])
    if not os.path.exists(src): print("missing:",src); continue
    build(src, pr["gradeCode"], pr["brand"], f"{OUT}/{pr['partId']}-{pr['gradeCode']}.jpg")
    n += 1
print("brand images:", n)
