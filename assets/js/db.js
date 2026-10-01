/* ===== یدک‌یار — Data Layer (modular repository, localStorage-backed) =====
   جایگزینی با API واقعی: فقط توابع read/write این فایل را به fetch تغییر دهید. */
(function(){
const NS='yadakyar.v7.';
// نسخه‌های قدیمی داده پاک می‌شوند تا کاتالوگ/تصاویر جدید اعمال شود
['ap360.v1.','ap360.v2.','ap360.v3.','yadakyar.v1.','yadakyar.v2.','yadakyar.v3.','yadakyar.v4.','yadakyar.v5.','yadakyar.v6.'].forEach(old=>Object.keys(localStorage)
  .filter(k=>k.startsWith(old)).forEach(k=>localStorage.removeItem(k)));
const raw=k=>localStorage.getItem(NS+k);
const read=(k,d)=>{try{const v=raw(k);return v?JSON.parse(v):d}catch(e){return d}};
const write=(k,v)=>localStorage.setItem(NS+k,JSON.stringify(v));

function seedOnce(){
  if(raw('products'))return;
  const S=window.SEED;
  write('categories',S.categories); write('vehicles',S.vehicles);
  write('parts',S.parts); write('products',S.products); write('meta',S.meta);
  write('orders',[]); write('customers',[]); write('session',null);
  write('settings',{shopName:'یدک‌یار',adminUser:'admin',adminPass:'admin123',
    shipping:[{id:'post',name:'پست پیشتاز',price:120000,eta:'۳ تا ۵ روز کاری'},
              {id:'tipax',name:'تیپاکس',price:180000,eta:'۲ تا ۳ روز کاری'},
              {id:'peyk',name:'پیک شهری (تهران)',price:90000,eta:'همان روز'}],
    payments:[{id:'gateway',name:'پرداخت اینترنتی'},{id:'cod',name:'پرداخت در محل'},{id:'card',name:'کارت به کارت'}],
    freeShipOver:20000000});
}
const STATUSES=[
 {id:'placed',name:'ثبت سفارش',color:'t-inf'},{id:'paid',name:'پرداخت شده',color:'t-inf'},
 {id:'preparing',name:'در حال آماده‌سازی',color:'t-warn'},{id:'packed',name:'بسته‌بندی شده',color:'t-warn'},
 {id:'shipped',name:'ارسال شده',color:'t-pur'},{id:'delivered',name:'تحویل داده شده',color:'t-ok'},
 {id:'canceled',name:'لغو شده',color:'t-bad'}];

const DB={
 STATUSES,
 reset(){Object.keys(localStorage).filter(k=>k.startsWith(NS)).forEach(k=>localStorage.removeItem(k));seedOnce()},
 // ---- generic collections ----
 all(c){return read(c,[])},
 set(c,v){write(c,v)},
 get(c,id){return read(c,[]).find(x=>x.id===id)},
 upsert(c,obj){const a=read(c,[]);const i=a.findIndex(x=>x.id===obj.id);
   if(i<0)a.unshift(obj);else a[i]={...a[i],...obj};write(c,a);return obj},
 remove(c,id){write(c,read(c,[]).filter(x=>x.id!==id))},
 settings(){return read('settings',{})},
 saveSettings(s){write('settings',{...read('settings',{}),...s})},
 meta(){return read('meta',{})},
 // ---- domain helpers ----
 vehicles(){return read('vehicles',[])},
 vehicle(id){return this.get('vehicles',id)},
 parts(){return read('parts',[])},
 part(id){return this.get('parts',id)},
 categories(){return read('categories',[])},
 category(id){return this.get('categories',id)},
 products(){return read('products',[]).filter(p=>p.active!==false)},
 allProducts(){return read('products',[])},
 product(id){return this.get('products',id)},
 productsFor(vehicleId,partId){return this.products().filter(p=>
   (!vehicleId||p.vehicleId===vehicleId)&&(!partId||p.partId===partId))},
 brandsOf(){return [...new Set(this.products().map(p=>p.brand))].sort()},
 nextProductId(){const n=read('products',[]).map(p=>+String(p.id).replace(/\D/g,'')||0);
   return 'P'+(Math.max(1000,...n)+1)},
 search(q,f={}){
   q=(q||'').trim();
   let r=this.products();
   if(f.vehicleId)r=r.filter(p=>p.vehicleId===f.vehicleId);
   if(f.categoryId)r=r.filter(p=>p.categoryId===f.categoryId);
   if(f.partId)r=r.filter(p=>p.partId===f.partId);
   if(f.brand)r=r.filter(p=>p.brand===f.brand);
   if(f.grade)r=r.filter(p=>p.gradeCode===f.grade);
   if(f.year)r=r.filter(p=>+f.year>=p.years[0]&&+f.year<=p.years[1]);
   if(f.inStock)r=r.filter(p=>p.stock>0);
   if(f.min)r=r.filter(p=>p.price>=+f.min);
   if(f.max)r=r.filter(p=>p.price<=+f.max);
   if(q){const t=q.toLowerCase();
     r=r.filter(p=>(p.name+' '+p.nameEn+' '+p.brand+' '+p.sku+' '+(p.oem||[]).join(' ')).toLowerCase().includes(t))}
   const s=f.sort||'new';
   const cmp={cheap:(a,b)=>a.price-b.price,exp:(a,b)=>b.price-a.price,
     pop:(a,b)=>b.sold-a.sold,new:(a,b)=>String(b.id).localeCompare(String(a.id))}[s];
   return r.sort(cmp);
 },
 // ---- cart ----
 cart(){return read('cart',[])},
 cartCount(){return this.cart().reduce((s,i)=>s+i.qty,0)},
 addToCart(pid,qty){const c=read('cart',[]);const i=c.findIndex(x=>x.id===pid);
   const p=this.product(pid); if(!p)return false;
   const cur=i<0?0:c[i].qty; const want=cur+(qty||1);
   if(want>p.stock)return 'stock';
   if(i<0)c.push({id:pid,qty:qty||1});else c[i].qty=want;
   write('cart',c);return true},
 setQty(pid,q){const c=read('cart',[]);const i=c.findIndex(x=>x.id===pid);
   if(i>=0){if(q<=0)c.splice(i,1);else c[i].qty=q;write('cart',c)}},
 clearCart(){write('cart',[])},
 cartDetail(){return this.cart().map(i=>{const p=this.product(i.id);return p?{...p,qty:i.qty,line:p.price*i.qty}:null}).filter(Boolean)},
 cartTotal(){return this.cartDetail().reduce((s,i)=>s+i.line,0)},
 // ---- auth ----
 session(){return read('session',null)},
 login(email,pass){const u=read('customers',[]).find(c=>c.email===email&&c.pass===pass);
   if(!u)return null;write('session',{type:'customer',id:u.id});return u},
 register(o){const c=read('customers',[]);
   if(c.find(x=>x.email===o.email))return null;
   const u={id:'C'+Date.now(),...o,addresses:[],fav:[],createdAt:Date.now()};
   c.push(u);write('customers',c);write('session',{type:'customer',id:u.id});return u},
 me(){const s=this.session();return s&&s.type==='customer'?this.get('customers',s.id):null},
 logout(){write('session',null)},
 saveMe(patch){const u=this.me();if(!u)return;this.upsert('customers',{...u,...patch})},
 adminLogin(u,p){const s=this.settings();
   if(u===s.adminUser&&p===s.adminPass){write('admin',{at:Date.now()});return true}return false},
 isAdmin(){const a=read('admin',null);return !!a&&(Date.now()-a.at<1000*60*60*8)},
 adminLogout(){localStorage.removeItem(NS+'admin')},
 // ---- orders ----
 createOrder(o){
   const orders=read('orders',[]);
   const num=100000+orders.length+1;
   const items=this.cartDetail().map(i=>({id:i.id,name:i.name,img:i.img,price:i.price,qty:i.qty,sku:i.sku}));
   const order={id:'O'+num,number:'#'+num,createdAt:Date.now(),status:'placed',
     history:[{s:'placed',t:Date.now()}],items,...o};
   orders.unshift(order);write('orders',orders);
   // کسر موجودی
   const ps=read('products',[]);
   items.forEach(it=>{const p=ps.find(x=>x.id===it.id);if(p){p.stock=Math.max(0,p.stock-it.qty);p.sold=(p.sold||0)+it.qty}});
   write('products',ps);
   this.clearCart();return order},

 /* ---- همگام‌سازی قیمت از موتور به‌روزرسانی ساعتی (assets/data/prices.json) ---- */
 async syncPrices(){
  try{
   const r=await fetch('assets/data/prices.json?t='+Date.now(),{cache:'no-store'});
   if(!r.ok) return {status:'offline',count:0};
   const d=await r.json();
   if(d.status!=='ok'||!d.prices) return {status:d.status,count:0,message:d.message,updatedAt:d.updatedAt};
   const all=read('products',[]); let n=0;
   all.forEach(p=>{const u=d.prices[p.id];
    if(u&&u.price&&u.price!==p.price){p.oldPrice=p.price;p.price=u.price;p.priceSource=u.ref;p.priceSyncedAt=d.updatedAt;n++;}});
   if(n)write('products',all);
   return {status:'ok',count:n,updatedAt:d.updatedAt,source:d.source};
  }catch(e){return {status:'error',count:0,message:String(e)}}
 },
 orders(){return read('orders',[])},
 myOrders(){const u=this.me();return read('orders',[]).filter(o=>u?o.customerId===u.id:false)},
 setStatus(id,st){const o=read('orders',[]);const x=o.find(y=>y.id===id);
   if(x){x.status=st;x.history.push({s:st,t:Date.now()});write('orders',o)}},
 stats(){
   const p=this.allProducts(),o=this.orders(),c=read('customers',[]);
   const rev=o.filter(x=>x.status!=='canceled').reduce((s,x)=>s+x.total,0);
   return {products:p.length,active:p.filter(x=>x.active!==false).length,
     orders:o.length,newOrders:o.filter(x=>x.status==='placed').length,
     customers:c.length,revenue:rev,
     low:p.filter(x=>x.stock>0&&x.stock<=5),out:p.filter(x=>x.stock===0),
     stockValue:p.reduce((s,x)=>s+x.price*x.stock,0)}}
};
seedOnce();
window.DB=DB;
})();

/* ===== اتصال به بک‌اند واقعی =====
   وقتی API در دسترس است، عملیات حیاتی (سفارش، ورود، ویرایش قیمت/موجودی)
   روی سرور انجام می‌شود، نه در localStorage. خواندن کاتالوگ از SEEDِ
   پرشده توسط apiclient.js انجام می‌شود، پس بقیهٔ صفحات بدون تغییر کار می‌کنند. */
(function(){
  if(!window.API) return;
  const A=window.API, D=window.DB;
  if(!A.online){ D.ONLINE=false; return; }
  D.ONLINE=true;

  // کاتالوگِ سرور همیشه جایگزین نسخهٔ ذخیره‌شدهٔ مرورگر شود
  try{
    const NSk='yadakyar.v7.';
    localStorage.setItem(NSk+'products', JSON.stringify(window.SEED.products));
    localStorage.setItem(NSk+'vehicles', JSON.stringify(window.SEED.vehicles));
    localStorage.setItem(NSk+'parts',    JSON.stringify(window.SEED.parts));
    localStorage.setItem(NSk+'categories', JSON.stringify(window.SEED.categories));
    if(window.API_SETTINGS){
      const cur=D.settings()||{};
      D.saveSettings(Object.assign({},cur,{
        shopName:window.API_SETTINGS.shopName||cur.shopName,
        freeShipOver:window.API_SETTINGS.freeShipOver??cur.freeShipOver,
        shipping:window.API_SETTINGS.shipping||cur.shipping}));
    }
  }catch(e){ console.warn('cache catalog failed',e); }

  // ---- سفارش واقعی ----
  const localCreate=D.createOrder.bind(D);
  D.createOrderRemote=async function(o){
    const items=(o.items||D.cartDetail().map(x=>({id:x.id,qty:x.qty})))
      .map(x=>({id:x.id,qty:x.qty}));
    const r=await A.createOrder({
      items, name:o.name||'', phone:o.phone||'', address:o.address||'',
      city:o.city||'', postcode:o.postcode||'', note:o.note||'',
      shipMethod:o.shipMethod||'post', payMethod:o.payMethod||'cod'});
    D.clearCart();
    return r;                       // {code,total,...}
  };

  // ---- حساب مشتری واقعی ----
  D.registerRemote = d=>A.register(d);
  D.loginRemote    = d=>A.login(d);
  D.myOrdersRemote = ()=>A.myOrders();
  D.trackRemote    = (c,p)=>A.track(c,p);
  const _logout=D.logout.bind(D);
  D.logout=function(){ A.logout(); return _logout(); };

  // ---- مدیر واقعی ----
  D.adminLoginRemote = (u,p)=>A.adminLogin(u,p);
  D.isAdminRemote    = ()=>!!A.adminToken();
  D.statsRemote      = ()=>A.stats();
  D.adminOrdersRemote= ()=>A.adminOrders();
  D.patchOrderRemote = (c,d)=>A.patchOrder(c,d);
  D.auditRemote      = ()=>A.audit();
  D.customersRemote  = ()=>A.customers();

  // ویرایش محصول: هم سرور هم کش محلی
  const _upsert=D.upsert.bind(D);
  D.upsert=function(col,obj){
    const res=_upsert(col,obj);
    if(col==='products'&&obj&&obj.id&&A.adminToken()){
      const d={};
      ['price','oldPrice','stock','active','img','name'].forEach(k=>{
        if(obj[k]!==undefined) d[k]=obj[k];
      });
      if(Object.keys(d).length)
        A.patchProduct(obj.id,d).catch(e=>console.warn('sync محصول ناموفق:',e.message));
    }
    return res;
  };

  // تنظیمات فروشگاه روی سرور
  const _saveSettings=D.saveSettings.bind(D);
  D.saveSettings=function(s){
    const r=_saveSettings(s);
    if(A.adminToken()){
      const srv={};
      ['shopName','freeShipOver','shipping','zarinpalMerchant','zarinpalSandbox']
        .forEach(k=>{ if(s[k]!==undefined) srv[k]=s[k]; });
      if(Object.keys(srv).length)
        A.putSettings(srv).catch(e=>console.warn('sync تنظیمات ناموفق:',e.message));
    }
    return r;
  };

  console.info('یدک‌یار: متصل به سرور ✓ ('+window.SEED.products.length+' محصول زنده)');
})();
