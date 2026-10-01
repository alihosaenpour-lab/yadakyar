/* ===== یدک‌یار — shared UI kit ===== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const en=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g,'');
const money=n=>fa(n)+' <small>تومان</small>';
const qs=k=>new URLSearchParams(location.search).get(k)||'';
const dt=t=>new Date(t).toLocaleDateString('fa-IR')+' — '+new Date(t).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});
function toast(msg,err){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';e.className='toast';document.body.appendChild(e)}
 e.className='toast show'+(err?' err':'');e.textContent=msg;clearTimeout(e._t);e._t=setTimeout(()=>e.className='toast',2200)}
function stockTag(s){return s===0?'<span class="tag t-bad">ناموجود</span>':s<=5?'<span class="tag t-warn">تنها '+fa(s)+' عدد</span>':'<span class="tag t-ok">موجود در انبار</span>'}
function gradeTag(g){const M={genuine:['اصلی کارخانه','t-pur'],oes:['OES تأمین‌کنندهٔ اصلی','t-inf'],quality:['باکیفیت (AM)','t-wrn'],economy:['اقتصادی','t-mut'],original:['اصلی کارخانه','t-pur']};const m=M[g]||['متفرقه','t-mut'];return `<span class="tag ${m[1]}">${m[0]}</span>`}

function header(active){
 const c=DB.cartCount(),me=DB.me();
 const nav=[['home.html','خانه','home'],['vehicles.html','خودروها','veh'],['shop.html','فروشگاه','shop'],
            ['cart.html','سبد خرید','cart'],['account.html',me?'حساب کاربری':'ورود / ثبت‌نام','acc']];
 return `<header class="hd"><div class="wrap">
 <div class="row">
  <a class="logo" href="home.html"><span class="mk"><i><s></s><s></s><s></s><s></s><s></s><s></s></i></span>
   <span><b>یدک‌یار</b><small>پلتفرم جامع قطعات خودرو</small></span></a>
  <nav class="mainnav">${nav.map(n=>`<a href="${n[0]}" class="${active===n[2]?'on':''}">${n[1]}</a>`).join('')}</nav>
  <div class="hsearch"><input id="gq" placeholder="جستجوی قطعه، شماره فنی یا OEM…" autocomplete="off"><span class="ic">🔍</span>
   <div class="sug" id="gsug"></div></div>
  <button class="iconbtn burger" id="bg">☰</button>
  <a href="cart.html"><button class="iconbtn">🛒${c?`<span class="badge">${fa(c)}</span>`:''}</button></a>
  <a href="account.html"><button class="iconbtn">${me?'👤':'🔑'}</button></a>
 </div>
 <div class="mob" id="mb">${nav.map(n=>`<a href="${n[0]}">${n[1]}</a>`).join('')}<a href="admin-login.html">پنل مدیریت</a></div>
 </div></header>`;
}
function footer(){return `<footer class="foot"><div class="wrap">
 <div class="cols">
  <div><b>یدک‌یار</b>پلتفرم تخصصی شناسایی و خرید قطعات خودرو با نمایش سه‌بعدی تعاملی.</div>
  <div><b>دسترسی سریع</b><a href="home.html">صفحه اصلی</a><a href="vehicles.html">نمایشگاه سه‌بعدی</a><a href="shop.html">فروشگاه</a><a href="account.html">پیگیری سفارش</a></div>
  <div><b>دسته‌بندی‌ها</b>${DB.categories().slice(0,5).map(c=>`<a href="shop.html?cat=${c.id}">${c.name}</a>`).join('')}</div>
  <div><b>مدیریت</b><a href="admin-login.html">ورود مدیران</a><span class="muted" style="display:block;margin-top:8px">نسخهٔ نمایشی — داده‌ها در مرورگر شما ذخیره می‌شود.</span></div>
 </div>
 <div class="muted" style="border-top:1px solid var(--bd);padding-top:12px">${DB.meta().priceNote||''}</div>
</div></footer>`}

function mountChrome(active){
 document.body.insertAdjacentHTML('afterbegin','<div class="bgfx"></div><div class="gridfx"></div>'+header(active));
 document.body.insertAdjacentHTML('beforeend',footer()+'<div class="toast" id="toast"></div>');
 $('#bg').onclick=()=>$('#mb').classList.toggle('on');
 const gq=$('#gq'),sg=$('#gsug');
 gq.addEventListener('input',()=>{const q=gq.value.trim();
  if(q.length<2){sg.classList.remove('on');return}
  const r=DB.search(q,{}).slice(0,6);
  sg.innerHTML=r.length?r.map(p=>`<a href="product.html?id=${p.id}"><img src="${p.img}" alt=""><span>
   <div style="font-size:12.5px">${p.name}</div><div class="muted" style="font-size:11px">${p.brand} — ${fa(p.price)} تومان</div></span></a>`).join('')
   +`<a href="shop.html?q=${encodeURIComponent(q)}" style="color:var(--acc2)">مشاهدهٔ همهٔ نتایج برای «${q}» ←</a>`
   :'<a class="muted">نتیجه‌ای یافت نشد</a>';
  sg.classList.add('on')});
 gq.addEventListener('keydown',e=>{if(e.key==='Enter'&&gq.value.trim())location.href='shop.html?q='+encodeURIComponent(gq.value.trim())});
 document.addEventListener('click',e=>{if(!e.target.closest('.hsearch'))sg.classList.remove('on')});
}
function productCard(p){
 const v=DB.vehicle(p.vehicleId);
 return `<article class="pcard">
  <a href="product.html?id=${p.id}"><div class="ph"><img src="${p.img}" alt="${p.name}" loading="lazy">
   <div class="cnr">${gradeTag(p.gradeCode)}${p.brand?`<span class="tag t-brd">${p.brand}</span>`:''}${p.oldPrice?'<span class="tag t-bad">تخفیف</span>':''}</div></div></a>
  <div class="bd">
   <div class="bnd">${p.brand}</div>
   <a href="product.html?id=${p.id}"><div class="nm">${p.name}</div></a>
   <div class="pn">کد: ${p.sku}</div>
   <div class="muted" style="font-size:11px">سازگار: ${v?v.brandFa+' '+v.modelFa:''} (${fa(p.years[0])}–${fa(p.years[1])})</div>
   <div style="margin:7px 0">${stockTag(p.stock)}</div>
   <div class="ft"><div>${p.oldPrice?`<div class="old">${fa(p.oldPrice)}</div>`:''}
     <div class="price">${money(p.price)}</div></div>
    <button class="btn sm" data-add="${p.id}" ${p.stock?'':'disabled'}>🛒</button></div>
  </div></article>`;
}
function bindAdd(root){
 (root||document).addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;
  const r=DB.addToCart(b.dataset.add,1);
  if(r===true){toast('به سبد خرید اضافه شد ✓');refreshCart()}
  else if(r==='stock')toast('موجودی کافی نیست',1);else toast('خطا',1)})}
function refreshCart(){const c=DB.cartCount();const b=$$('.iconbtn').find(x=>x.textContent.includes('🛒'));
 if(b)b.innerHTML='🛒'+(c?`<span class="badge">${fa(c)}</span>`:'')}
function modal(title,html,w){
 let ov=$('#ov');if(!ov){ov=document.createElement('div');ov.id='ov';ov.className='ov';document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('on')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')ov.classList.remove('on')})}
 ov.innerHTML=`<div class="mo" style="${w?'max-width:'+w+'px':''}"><div class="mh"><b>${title}</b><button class="x" onclick="document.getElementById('ov').classList.remove('on')">✕</button></div><div class="mb">${html}</div></div>`;
 ov.classList.add('on');return ov}

/* همگام‌سازی سبک قیمت‌ها از موتور به‌روزرسانی (حداکثر هر ۳۰ دقیقه) */
(function(){try{const k='yadakyar.v7.lastPriceSync',last=+localStorage.getItem(k)||0;
 if(Date.now()-last<18e5||!window.DB||!DB.syncPrices)return;localStorage.setItem(k,Date.now());
 DB.syncPrices().then(r=>{if(r.status==='ok'&&r.count)console.info('یدک‌یار: '+r.count+' قیمت به‌روز شد');});}catch(e){}})();
