import re
# -*- coding: utf-8 -*-
import json

IMG = lambda n: f"assets/img/part-{n}.jpg"

import os as _os
def BRANDIMG(pid, tier, fallback):
    """تصویر بسته‌بندی مخصوص هر سطح برند؛ اگر نبود به عکس خام قطعه برمی‌گردد."""
    p = f"assets/img/brand/{pid}-{tier}.jpg"
    return p if _os.path.exists("site/"+p) else PARTIMG(pid, fallback)

def PARTIMG(pid, fallback):
    p = f"assets/img/{pid}.jpg"
    return p if _os.path.exists("site/"+p) else IMG(fallback)


categories = [
 ("cat-engine","قطعات موتور","engine"),("cat-filter","فیلترها","filter"),
 ("cat-cooling","سیستم خنک‌کننده","cooling"),("cat-fuel","سوخت‌رسانی","fuel"),
 ("cat-brake","سیستم ترمز","brake"),("cat-susp","تعلیق و جلوبندی","suspension"),
 ("cat-steer","سیستم فرمان","suspension"),("cat-elec","برق و الکترونیک","electric"),
 ("cat-trans","انتقال قدرت","transmission"),("cat-body","بدنه و شاسی","body"),
 ("cat-light","روشنایی","light"),("cat-ac","تهویه و کولر","ac"),
 ("cat-cons","قطعات مصرفی","wiper"),("cat-interior","قطعات داخلی","body"),
]

vehicles = [
 dict(id="v-jac-s5", brand="JAC", brandFa="جک", model="S5", modelFa="S5 (اِس ۵)",
      years=[2015,2016,2017,2018,2019,2020], engines=["2.0L بنزینی","2.0T توربو"],
      origin="چینی", image="assets/img/car-suv.jpg", bay="assets/img/bay-turbo.jpg",
      body="SUV", color="#dfe6ef",
      note="مونتاژ کرمان‌موتور در ایران"),
 dict(id="v-hyundai-elantra", brand="Hyundai", brandFa="هیوندای", model="Elantra AD", modelFa="النترا (AD)",
      years=[2016,2017,2018,2019,2020], engines=["1.6L MPI","2.0L MPI","1.6L T-GDI"],
      origin="خارجی", image="assets/img/car-sedan-silver.jpg", bay="assets/img/bay-na.jpg",
      body="سدان", color="#cfd6e0", note="نسل ششم (AD)"),
 dict(id="v-toyota-corolla", brand="Toyota", brandFa="تویوتا", model="Corolla E170", modelFa="کرولا (E170)",
      years=[2014,2015,2016,2017,2018,2019], engines=["1.6L 1ZR-FE","1.8L 2ZR-FE"],
      origin="خارجی", image="assets/img/car-sedan-blue.jpg", bay="assets/img/bay-na.jpg",
      body="سدان", color="#c9d2de", note="نسل یازدهم (E170)"),
]

# hotspots: x%,y% روی تصویر موتورخانه
# مختصات بر اساس موقعیت واقعی اجزا روی همان دو عکس موتورخانه تنظیم شده است.
# فقط قطعاتی که واقعاً داخل محفظهٔ موتور دیده می‌شوند روی نقشه می‌آیند.
# --- bay-turbo.jpg (جک S5): محفظهٔ موتور تقریباً x=40..82٪ ، y=30..60٪
HOT_TURBO = [
 ("p-coolant",    43, 47), ("p-brakefluid", 61, 34), ("p-battery",   71, 37),
 ("p-turbo",      48, 46), ("p-sparkplug",  56, 41), ("p-injector",  60, 42),
 ("p-oilfilter",  52, 52), ("p-alternator", 55, 55), ("p-beltalt",   53, 50),
 ("p-radiator",   68, 52), ("p-airfilter",  75, 41), ("p-waterpump", 50, 49),
 ("p-acomp",      58, 56), ("p-thermostat", 46, 51), ("p-o2",        51, 43),
]
# --- bay-na.jpg (النترا و کرولا): محفظهٔ موتور تقریباً x=19..62٪ ، y=33..72٪
HOT_NA = [
 ("p-coolant",    27, 40), ("p-brakefluid", 51, 42), ("p-battery",   57, 50),
 ("p-airfilter",  51, 52), ("p-sparkplug",  40, 45), ("p-coil",      43, 43),
 ("p-injector",   44, 48), ("p-oilfilter",  36, 58), ("p-alternator",31, 52),
 ("p-beltalt",    29, 47), ("p-radiator",   31, 63), ("p-waterpump", 33, 50),
 ("p-acomp",      35, 61), ("p-thermostat", 28, 56), ("p-o2",        46, 57),
]
hot = {
 "v-jac-s5": HOT_TURBO,
 "v-hyundai-elantra": HOT_NA,
 "v-toyota-corolla": HOT_NA,
}

parts = [
 ("p-airfilter","فیلتر هوا","Air Filter","cat-filter","filter","سیستم ورود هوا","فیلتر هوای موتور، ذرات معلق را پیش از ورود به محفظهٔ احتراق حذف می‌کند."),
 ("p-oilfilter","فیلتر روغن","Oil Filter","cat-filter","filter","سیستم روانکاری","فیلتر روغن موتور، براده و آلودگی را از روغن جدا می‌کند."),
 ("p-cabinfilter","فیلتر کابین","Cabin Air Filter","cat-filter","filter","تهویه","فیلتر هوای ورودی به کابین؛ گرد و غبار و گرده را می‌گیرد."),
 ("p-fuelfilter","فیلتر بنزین","Fuel Filter","cat-filter","filter","سوخت‌رسانی","فیلتر سوخت، ناخالصی بنزین را قبل از انژکتور جدا می‌کند."),
 ("p-sparkplug","شمع موتور","Spark Plug","cat-elec","electric","جرقه‌زنی","شمع، جرقهٔ لازم برای احتراق مخلوط سوخت و هوا را ایجاد می‌کند."),
 ("p-coil","کوئل جرقه","Ignition Coil","cat-elec","electric","جرقه‌زنی","کوئل ولتاژ باتری را به چند هزار ولت برای شمع تبدیل می‌کند."),
 ("p-battery","باتری","Battery","cat-elec","battery","برق خودرو","باتری، انرژی استارت و تغذیهٔ مصرف‌کننده‌های برقی را تأمین می‌کند."),
 ("p-alternator","دینام","Alternator","cat-elec","electric","برق خودرو","دینام در حین کارکرد موتور برق تولید و باتری را شارژ می‌کند."),
 ("p-timingbelt","تسمه تایم","Timing Belt Kit","cat-engine","engine","موتور","تسمه تایم هماهنگی میل‌لنگ و میل‌سوپاپ را تضمین می‌کند."),
 ("p-beltalt","تسمه دینام","Serpentine / Alternator Belt","cat-engine","engine","موتور","تسمه دینام، نیروی موتور را به دینام، پمپ هیدرولیک و کمپرسور کولر می‌رساند."),
 ("p-waterpump","واتر پمپ","Water Pump","cat-cooling","cooling","خنک‌کننده","پمپ آب، گردش مایع خنک‌کننده در موتور و رادیاتور را برقرار می‌کند."),
 ("p-radiator","رادیاتور آب","Radiator","cat-cooling","cooling","خنک‌کننده","رادیاتور حرارت مایع خنک‌کننده را به هوا منتقل می‌کند."),
 ("p-thermostat","ترموستات","Thermostat","cat-cooling","cooling","خنک‌کننده","ترموستات دمای کارکرد موتور را تنظیم می‌کند."),
 ("p-coolant","مخزن و مایع خنک‌کننده","Coolant Reservoir","cat-cooling","cooling","خنک‌کننده","مخزن انبساط، حجم اضافی مایع خنک‌کننده را نگه می‌دارد."),
 ("p-fuelpump","پمپ بنزین","Fuel Pump","cat-fuel","fuel","سوخت‌رسانی","پمپ بنزین سوخت را با فشار مشخص به ریل انژکتور می‌رساند."),
 ("p-injector","انژکتور","Fuel Injector","cat-fuel","fuel","سوخت‌رسانی","انژکتور سوخت را به‌صورت پودری وارد مانیفولد یا سیلندر می‌کند."),
 ("p-o2","سنسور اکسیژن","Oxygen Sensor","cat-fuel","fuel","سوخت‌رسانی","سنسور اکسیژن نسبت سوخت به هوا را به ECU گزارش می‌دهد."),
 ("p-turbo","توربوشارژر","Turbocharger","cat-engine","engine","موتور","توربو با استفاده از گاز خروجی، هوای فشرده به موتور می‌دهد."),
 ("p-padf","لنت ترمز جلو","Front Brake Pads","cat-brake","brake","ترمز","لنت جلو با اصطکاک روی دیسک، خودرو را متوقف می‌کند."),
 ("p-padr","لنت ترمز عقب","Rear Brake Pads","cat-brake","brake","ترمز","لنت عقب سهم کمتری از نیروی ترمز را تأمین می‌کند."),
 ("p-discf","دیسک ترمز جلو","Front Brake Disc","cat-brake","brake","ترمز","دیسک ترمز سطح تماس لنت و انتقال حرارت را فراهم می‌کند."),
 ("p-brakefluid","روغن ترمز / مخزن","Brake Fluid Reservoir","cat-brake","brake","ترمز","مخزن روغن ترمز فشار هیدرولیک سیستم را تأمین می‌کند."),
 ("p-shockf","کمک فنر جلو","Front Shock Absorber","cat-susp","suspension","تعلیق","کمک فنر نوسان فنر و تماس چرخ با جاده را کنترل می‌کند."),
 ("p-controlarm","طبق چرخ","Control Arm","cat-susp","suspension","تعلیق","طبق، اتصال متحرک بین شاسی و سگ‌دست است."),
 ("p-tierod","سیبک فرمان","Tie Rod End","cat-steer","suspension","فرمان","سیبک فرمان حرکت جعبه‌فرمان را به چرخ منتقل می‌کند."),
 ("p-clutch","دیسک و صفحه کلاچ","Clutch Kit","cat-trans","transmission","انتقال قدرت","کیت کلاچ ارتباط موتور و گیربکس را قطع و وصل می‌کند."),
 ("p-cvaxle","پلوس","CV Axle","cat-trans","transmission","انتقال قدرت","پلوس گشتاور گیربکس را به چرخ منتقل می‌کند."),
 ("p-acomp","کمپرسور کولر","A/C Compressor","cat-ac","ac","تهویه","کمپرسور، گاز مبرد را در مدار کولر فشرده می‌کند."),
 ("p-headlight","چراغ جلو","Headlight Assembly","cat-light","light","روشنایی","چراغ جلو، روشنایی و دید در شب را تأمین می‌کند."),
 ("p-taillight","چراغ عقب","Tail Light","cat-light","light","روشنایی","چراغ عقب موقعیت و ترمز خودرو را به دیگران اعلام می‌کند."),
 ("p-bumperf","سپر جلو","Front Bumper","cat-body","body","بدنه","سپر جلو ضربه‌های کم‌سرعت را جذب می‌کند."),
 ("p-mirror","آینه بغل","Side Mirror","cat-body","body","بدنه","آینه بغل دید جانبی و عقب را فراهم می‌کند."),
 ("p-wiper","تیغه برف‌پاک‌کن","Wiper Blades","cat-cons","wiper","مصرفی","تیغه برف‌پاک‌کن، آب و گِل را از شیشه پاک می‌کند."),
]


# ============================================================================
# برندهای واقعی بازار — هر قطعه در ۴ سطح برند عرضه می‌شود.
# منابع تحقیق: shopearl.com (Top aftermarket brands 2026)، ridenrepair.com (OEM/OES/
# aftermarket tiers)، lent.ir و shahrelent.com (برندهای لنت هیوندای در ایران)،
# lentline.com (برندهای لنت تویوتا)، parsmotoroil.ir و roghansharahi.com (فیلتر سرکان/موبیس)،
# yadakpart.com (برندهای لنت ایرانی: پارس لنت، امکو، ایساکو).
# سطح‌ها: genuine (اصلی سازندهٔ خودرو) | oes (تأمین‌کنندهٔ اصلی کارخانه) |
#         quality (آفترمارکت باکیفیت) | economy (اقتصادی/ایرانی)
# ============================================================================
GENUINE = {
 "v-jac-s5":          ("JAC Genuine Parts", "جک اصلی", "چین"),
 "v-hyundai-elantra": ("Hyundai Mobis",     "موبیس (اصلی هیوندای)", "کره جنوبی"),
 "v-toyota-corolla":  ("Toyota Genuine Parts","تویوتا اصلی", "ژاپن"),
}
# سه برند غیر اصلی برای هر گروه قطعه: (نام لاتین، نام فارسی، کشور، سطح)
BRAND_SETS = {
 "filter":   [("MANN-FILTER","مان فیلتر","آلمان","oes"),("Bosch","بوش","آلمان","quality"),("Sarkan","سرکان","ایران","economy")],
 "ignition": [("NGK","ان جی کی","ژاپن","oes"),("Denso","دنسو","ژاپن","quality"),("Bosch","بوش","آلمان","economy")],
 "battery":  [("Bosch","بوش","آلمان","oes"),("Varta","وارتا","آلمان","quality"),("Sepahan Battery","سپاهان باتری","ایران","economy")],
 "charging": [("Bosch","بوش","آلمان","oes"),("Denso","دنسو","ژاپن","quality"),("Valeo","والئو","فرانسه","economy")],
 "belt":     [("Gates","گیتس","آمریکا","oes"),("ContiTech","کنتی‌تک","آلمان","quality"),("Dayco","دایکو","ایتالیا","economy")],
 "turbo":    [("Garrett","گرت","آمریکا","oes"),("BorgWarner","بورگ‌وارنر","آلمان","quality"),("Mitsubishi Turbo","میتسوبیشی","ژاپن","economy")],
 "cooling":  [("Denso","دنسو","ژاپن","oes"),("Behr Hella Service","بهر هلا","آلمان","quality"),("NRF","ان آر اف","هلند","economy")],
 "fuel":     [("Bosch","بوش","آلمان","oes"),("Denso","دنسو","ژاپن","quality"),("Delphi","دلفی","بریتانیا","economy")],
 "brake":    [("Textar","تکستار","آلمان","oes"),("Hi-Q","های کیو","کره جنوبی","quality"),("Pars Lent","پارس لنت","ایران","economy")],
 "fluid":    [("ATE","آ ت ای","آلمان","oes"),("Bosch","بوش","آلمان","quality"),("Behran","بهران","ایران","economy")],
 "susp":     [("KYB","کایابا","ژاپن","oes"),("Sachs","زاکس","آلمان","quality"),("CTR","سی تی آر","کره جنوبی","economy")],
 "steer":    [("Lemförder","لمفوردر","آلمان","oes"),("CTR","سی تی آر","کره جنوبی","quality"),("555","تری‌فایو","ژاپن","economy")],
 "clutch":   [("LuK","لوک","آلمان","oes"),("Valeo","والئو","فرانسه","quality"),("Exedy","اکسدی","ژاپن","economy")],
 "driveshaft":[("GKN Löbro","جی کی ان","بریتانیا","oes"),("CTR","سی تی آر","کره جنوبی","quality"),("Maxgear","مکس‌گیر","لهستان","economy")],
 "ac":       [("Denso","دنسو","ژاپن","oes"),("Sanden","ساندن","ژاپن","quality"),("Valeo","والئو","فرانسه","economy")],
 "light":    [("Hella","هلا","آلمان","oes"),("Depo","دپو","تایوان","quality"),("TYC","تی وای سی","تایوان","economy")],
 "body":     [("Depo","دپو","تایوان","oes"),("TYC","تی وای سی","تایوان","quality"),("Gordon","گوردون","تایوان","economy")],
 "wiper":    [("Bosch","بوش","آلمان","oes"),("Valeo","والئو","فرانسه","quality"),("Trico","تریکو","آمریکا","economy")],
}
# هر قطعه به کدام گروه برند تعلق دارد
PART_BRAND_GROUP = {
 "p-airfilter":"filter","p-oilfilter":"filter","p-cabinfilter":"filter","p-fuelfilter":"filter",
 "p-sparkplug":"ignition","p-coil":"ignition",
 "p-battery":"battery","p-alternator":"charging",
 "p-timingbelt":"belt","p-beltalt":"belt","p-turbo":"turbo",
 "p-waterpump":"cooling","p-radiator":"cooling","p-thermostat":"cooling","p-coolant":"cooling",
 "p-fuelpump":"fuel","p-injector":"fuel","p-o2":"fuel",
 "p-padf":"brake","p-padr":"brake","p-discf":"brake","p-brakefluid":"fluid",
 "p-shockf":"susp","p-controlarm":"susp","p-tierod":"steer",
 "p-clutch":"clutch","p-cvaxle":"driveshaft","p-acomp":"ac",
 "p-headlight":"light","p-taillight":"light",
 "p-bumperf":"body","p-mirror":"body","p-wiper":"wiper",
}
TIER = {
 "genuine": dict(fa="اصلی کارخانه (Genuine)", mul=1.00, warr="۱۸ ماه گارانتی اصالت", rank=1),
 "oes":     dict(fa="تأمین‌کنندهٔ اصلی (OES)", mul=0.76, warr="۱۲ ماه گارانتی شرکتی", rank=2),
 "quality": dict(fa="آفترمارکت باکیفیت",       mul=0.58, warr="۹ ماه گارانتی فروشنده", rank=3),
 "economy": dict(fa="اقتصادی",                 mul=0.42, warr="۶ ماه گارانتی فروشنده", rank=4),
}
TIER_SRC = ("سطح‌بندی کیفی بر اساس ridenrepair.com و shopearl.com؛ "
            "برندهای بازار ایران از lent.ir، shahrelent.com، lentline.com، parsmotoroil.ir و yadakpart.com")

# داده‌های فنی تأییدشده از منابع (OEM واقعی)
verified = {
 ("v-toyota-corolla","p-oilfilter"):dict(oem=["90915-YZZJ1","90915-YZZF2","04152-YZZA6"],src="ebay.com / amazon.com — کاتالوگ قطعات تویوتا"),
 ("v-toyota-corolla","p-airfilter"):dict(oem=["17801-0T030","17801-YZZ05","17801-21050"],src="ebay.com — قطعات اصلی تویوتا"),
 ("v-toyota-corolla","p-cabinfilter"):dict(oem=["87139-YZZ08","87139-YZZ20","87139-0N010"],src="ebay.com / amazon.com"),
 ("v-hyundai-elantra","p-oilfilter"):dict(oem=["26300-35505","26300-35504"],src="partshyundai.com — قطعات اصلی هیوندای"),
 ("v-hyundai-elantra","p-airfilter"):dict(oem=["28113-F2000"],src="hyundaipartsdeal.com — قطعات اصلی هیوندای"),
 ("v-hyundai-elantra","p-cabinfilter"):dict(oem=["97133-F2000"],src="amazon.com — مرجع تطبیق قطعه"),
 ("v-jac-s5","p-oilfilter"):dict(oem=["1010208GD190","1012020-03"],src="cnfastwin.com / chinaautoparts.info — کاتالوگ JAC"),
 ("v-jac-s5","p-airfilter"):dict(oem=["1109010U8010","1109130V5070"],src="chinaautoparts.info — کاتالوگ JAC"),
 ("v-jac-s5","p-cabinfilter"):dict(oem=["8126100U8510-25"],src="cnfastwin.com — کاتالوگ JAC"),
 ("v-jac-s5","p-sparkplug"):dict(oem=["1026106GAA","1026106GD190"],src="cinaautoparts.com / made-in-china.com"),
 ("v-jac-s5","p-clutch"):dict(oem=["1600010U1050","1600020U1050"],src="cnfastwin.com — کاتالوگ JAC"),
 ("v-jac-s5","p-oilcooler"):dict(oem=["1726101DT000"],src="cinaautoparts.com"),
}

# برندهای واقعی سازندهٔ قطعه
brands = {
 "filter":["MANN-FILTER","MAHLE","Bosch","Denso","Sakura","AMC Filter"],
 "electric":["NGK","Denso","Bosch","Champion","Valeo"],
 "battery":["Varta","Bosch","Exide","سپاهان باتری","برنا باتری"],
 "engine":["Gates","Dayco","ContiTech","INA","SKF"],
 "cooling":["Behr/MAHLE","Valeo","Denso","Nissens","ایران رادیاتور"],
 "fuel":["Bosch","Denso","Delphi","Walbro"],
 "brake":["TEXTAR","Brembo","TRW","Ferodo","عظام","آفورتیس"],
 "suspension":["KYB","Sachs","Monroe","Bilstein","عظام"],
 "transmission":["LUK","Valeo","SACHS","GKN"],
 "ac":["Denso","Valeo","Sanden"],
 "light":["Depo","TYC","Valeo","Hella"],
 "body":["Depo","TYC","Original"],
 "wiper":["Bosch","Valeo","SWF","Denso"],
}

# قیمت پایه تخمینی بازار ایران (تومان) برای هر قطعه، و ضریب خودرو
base = {
 "p-airfilter":420_000,"p-oilfilter":300_000,"p-cabinfilter":380_000,"p-fuelfilter":650_000,
 "p-sparkplug":950_000,"p-coil":1_900_000,"p-battery":5_200_000,"p-alternator":9_500_000,
 "p-timingbelt":3_800_000,"p-beltalt":850_000,"p-waterpump":2_600_000,"p-radiator":5_400_000,
 "p-thermostat":700_000,"p-coolant":900_000,"p-fuelpump":4_800_000,"p-injector":2_600_000,
 "p-o2":3_500_000,"p-turbo":38_000_000,"p-padf":2_100_000,"p-padr":1_650_000,"p-discf":3_200_000,
 "p-brakefluid":450_000,"p-shockf":4_600_000,"p-controlarm":3_300_000,"p-tierod":1_100_000,
 "p-clutch":7_800_000,"p-cvaxle":6_500_000,"p-acomp":16_000_000,"p-headlight":9_500_000,
 "p-taillight":4_200_000,"p-bumperf":6_800_000,"p-mirror":3_900_000,"p-wiper":780_000,
}
vmult={"v-jac-s5":1.0,"v-hyundai-elantra":1.45,"v-toyota-corolla":1.6}
# قطعاتی که برای هر خودرو معنی دارند
skip={"v-hyundai-elantra":{"p-turbo"},"v-toyota-corolla":{"p-turbo"}}

partmap={p[0]:p for p in parts}
products=[];pid=1000
for v in vehicles:
    for p in parts:
        key=p[0]
        if key in skip.get(v["id"],set()):continue
        vv=verified.get((v["id"],key))
        grp   = PART_BRAND_GROUP.get(key, "filter")
        gen   = GENUINE[v["id"]]
        lineup = [(gen[0], gen[1], gen[2], "genuine")] + BRAND_SETS[grp]
        for bi,(ben, bfa, country, tier) in enumerate(lineup):
            pid += 1
            t = TIER[tier]
            price = int(round(base[key]*vmult[v["id"]]*t["mul"]/10000)*10000)
            disc  = int(price*0.12/10000)*10000 if pid % 9 == 0 else 0
            stock = [0,4,9,15,27,38,52,6][pid % 8]
            slug  = re.sub(r"[^a-z0-9]+","", ben.lower())[:10]
            products.append(dict(
             id="P"+str(pid),
             sku=f"{v['brand'][:3].upper()}-{key.split('-')[1][:4].upper()}-{slug.upper()[:4]}-{pid}",
             partId=key, vehicleId=v["id"],
             name=f"{p[1]} {v['brandFa']} {v['modelFa']} — {bfa}",
             nameEn=f"{p[2]} for {v['brand']} {v['model']} — {ben}",
             grade=t["fa"], gradeCode=tier, tierRank=t["rank"],
             brand=ben, brandFa=bfa, country=country, manufacturer=ben,
             categoryId=p[3], img=BRANDIMG(key, tier, p[4]),
             oem=(vv["oem"] if vv else []),
             oemVerified=bool(vv),
             source=((vv["src"]+" | " if vv else "")+TIER_SRC),
             price=price, oldPrice=(price+disc if disc else 0), stock=stock,
             years=[v["years"][0],v["years"][-1]], engines=v["engines"],
             warranty=t["warr"], desc=p[6],
             specs={"دستهٔ سیستم":p[5], "سطح کیفی":t["fa"], "برند":f"{bfa} ({ben})",
                    "کشور سازنده":country,
                    "خودروی سازگار":f"{v['brandFa']} {v['modelFa']}",
                    "سال‌های سازگار":f"{v['years'][0]} تا {v['years'][-1]}",
                    "موتور":"، ".join(v["engines"])},
             sold=(pid*37) % 180,
             active=True))

data=dict(
 categories=[dict(id=c[0],name=c[1],icon=c[2]) for c in categories],
 vehicles=[dict(**v, hotspots=[dict(partId=h[0],x=h[1],y=h[2]) for h in hot[v["id"]]]) for v in vehicles],
 parts=[dict(id=p[0],name=p[1],nameEn=p[2],categoryId=p[3],img=p[4],imgUrl=PARTIMG(p[0],p[4]),system=p[5],desc=p[6]) for p in parts],
 products=products,
 meta=dict(currency="تومان",
   priceNote="قیمت‌ها تخمینی بازار ایران (مهر ۱۴۰۴) هستند و توسط مدیر از پنل قابل ویرایش‌اند؛ اعداد به‌عنوان قیمت رسمی فروشنده تأیید نشده‌اند.",
   oemNote="شماره‌های OEM فقط برای موارد دارای نشان «تأییدشده» از کاتالوگ سازنده استخراج شده‌اند؛ باقی موارد باید توسط مدیر تکمیل شود."))
open("site/assets/js/seed.js","w",encoding="utf-8").write("window.SEED="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";")
print("products:",len(products),"vehicles:",len(vehicles),"parts:",len(parts))
