/* ===== یدک‌یار — Interactive 3D Vehicle Viewer =====
   CSS-3D stage: rotate / zoom / open hood / part hotspots → linked to shop products */
(function(){
const CSS=`
.v3d{position:relative;border-radius:24px;overflow:hidden;background:
 linear-gradient(165deg,#12305f 0%,#0d2044 55%,#091732 100%);
 border:1px solid #1b3a6b;min-height:430px;user-select:none;box-shadow:var(--sh2)}
.v3d::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:radial-gradient(70% 50% at 50% 28%,rgba(120,180,255,.16),transparent 70%)}
.v3d .stage{position:relative;height:clamp(350px,48vw,520px);perspective:1500px;perspective-origin:50% 45%;
 display:grid;place-items:center;cursor:grab;touch-action:none;z-index:1}
.v3d .stage.drag{cursor:grabbing}
.v3d .car{position:relative;width:min(760px,88%);transform-style:preserve-3d;transition:transform .12s linear}
.v3d .base{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 40px 70px rgba(0,0,0,.45);transform-style:preserve-3d}
.v3d .base>img{width:100%;display:block}
.v3d .shadow{position:absolute;left:8%;right:8%;bottom:-26px;height:46px;border-radius:50%;
 background:radial-gradient(ellipse at center,rgba(0,0,0,.55),transparent 70%);filter:blur(10px)}
/* کاپوتِ ساختگی حذف شد؛ حالا با محو شدن به عکس واقعی موتورخانه سوییچ می‌کنیم */
.v3d .hood{display:none}
.v3d .bay{position:absolute;inset:0;overflow:hidden;opacity:0;pointer-events:none;
 transition:opacity .55s ease;border-radius:16px}
.v3d .bay img{width:100%;height:100%;object-fit:contain;display:block}
.v3d.open .bay{opacity:1}
.v3d.open .base > img{opacity:0}
.v3d .base > img{transition:opacity .55s ease}
.v3d .bay>img{width:100%;height:100%;object-fit:contain}
.baypanel{position:relative;direction:ltr;border-radius:var(--r2);overflow:hidden;border:1px solid var(--bd);background:#fff;box-shadow:var(--sh1)}
.baypanel>img{width:100%;display:block}
.hs>b{direction:rtl}
.hs{position:absolute;width:30px;height:30px;margin:-15px;border-radius:50%;cursor:pointer;
 background:var(--acc);border:3px solid #fff;box-shadow:0 3px 10px rgba(13,32,68,.35);
 animation:pulse 2.6s infinite;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:700;z-index:3;transition:.18s}
.hs:hover,.hs.on{background:var(--ok);animation:none;transform:scale(1.22)}
@keyframes pulse{0%{box-shadow:0 3px 10px rgba(13,32,68,.35),0 0 0 0 rgba(29,78,216,.5)}
 70%{box-shadow:0 3px 10px rgba(13,32,68,.35),0 0 0 15px rgba(29,78,216,0)}
 100%{box-shadow:0 3px 10px rgba(13,32,68,.35),0 0 0 0 rgba(29,78,216,0)}}
.hs b{position:absolute;top:-38px;right:50%;transform:translateX(50%);background:var(--nav);color:#fff;
 padding:4px 12px;border-radius:9px;font-size:12.5px;font-weight:500;white-space:nowrap;opacity:0;pointer-events:none;transition:.2s;box-shadow:var(--sh2)}
.hs:hover b{opacity:1;top:-34px}
.v3d .ctrl{position:relative;z-index:2;display:flex;gap:9px;flex-wrap:wrap;justify-content:center;padding:14px;
 border-top:1px solid rgba(150,190,255,.18);background:rgba(8,18,36,.55);backdrop-filter:blur(8px)}
.v3d .ctrl .btn.g{background:rgba(255,255,255,.1);border:1px solid rgba(180,210,255,.3);color:#eaf2ff}
.v3d .ctrl .btn.g:hover{background:rgba(255,255,255,.2);color:#fff;border-color:rgba(180,210,255,.6)}
.v3d .hint{position:absolute;top:14px;right:16px;font-size:12.5px;color:#cfe0f8;background:rgba(9,23,50,.6);
 border:1px solid rgba(150,190,255,.25);padding:5px 13px;border-radius:10px;z-index:2;backdrop-filter:blur(6px)}
`;
const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);

function Viewer(el,vehicle,opts={}){
 const o={ry:-18,rx:6,z:1,open:false};
 el.className='v3d';el.style.setProperty('--carcol',vehicle.color||'#dfe6ef');
 el.innerHTML=`
  <div class="stage"><div class="car">
    <div class="base"><img src="${vehicle.image}" alt="نمای خودرو">
      <div class="bay"><img src="${vehicle.bay}" alt="موتورخانه"></div>
      <div class="hood"></div>
    </div><div class="shadow"></div>
  </div>
  <div class="hint">🖱️ بکشید تا بچرخد · ✋ اسکرول برای زوم</div></div>
  <div class="ctrl">
   <button class="btn sm g" data-a="left">↺ چرخش</button>
   <button class="btn sm g" data-a="right">↻ چرخش</button>
   <button class="btn sm g" data-a="zin">＋ زوم</button>
   <button class="btn sm g" data-a="zout">－ زوم</button>
   <button class="btn sm g" data-a="reset">⟲ بازنشانی</button>
   <button class="btn sm" data-a="hood">🔓 باز کردن کاپوت</button>
   ${opts.explore!==false?`<a href="vehicles.html?v=${vehicle.id}"><button class="btn sm ok">🔍 بررسی قطعات</button></a>`:''}
  </div>`;
 const car=el.querySelector('.car'),stage=el.querySelector('.stage');
 const apply=()=>car.style.transform=`rotateX(${o.rx}deg) rotateY(${o.ry}deg) scale(${o.z})`;
 apply();
 let d=false,px=0,py=0;
 stage.addEventListener('pointerdown',e=>{d=true;px=e.clientX;py=e.clientY;stage.classList.add('drag');stage.setPointerCapture(e.pointerId)});
 stage.addEventListener('pointermove',e=>{if(!d)return;o.ry+=(e.clientX-px)*.4;o.rx=Math.max(-28,Math.min(38,o.rx-(e.clientY-py)*.25));px=e.clientX;py=e.clientY;apply()});
 stage.addEventListener('pointerup',()=>{d=false;stage.classList.remove('drag')});
 stage.addEventListener('wheel',e=>{e.preventDefault();o.z=Math.max(.6,Math.min(2.1,o.z-e.deltaY*.0011));apply()},{passive:false});
 el.querySelector('.ctrl').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  if(a==='left')o.ry-=22;if(a==='right')o.ry+=22;
  if(a==='zin')o.z=Math.min(2.1,o.z+.16);if(a==='zout')o.z=Math.max(.6,o.z-.16);
  if(a==='reset'){o.ry=-18;o.rx=6;o.z=1}
  if(a==='hood'){o.open=!o.open;el.classList.toggle('open',o.open);
   b.textContent=o.open?'🔒 بستن کاپوت':'🔓 باز کردن کاپوت';
   if(o.open&&opts.onOpen)opts.onOpen()}
  apply()});
 return {el,open:()=>el.querySelector('[data-a=hood]').click(),state:o};
}

/* پنل موتورخانه با هات‌اسپات‌های قابل کلیک */
function BayPanel(el,vehicle,onPick){
 el.className='baypanel';
 el.innerHTML=`<img src="${vehicle.bay}" alt="موتورخانهٔ ${vehicle.modelFa}">`+
  vehicle.hotspots.map((h,i)=>{const p=DB.part(h.partId);if(!p)return '';
   return `<div class="hs" style="left:${h.x}%;top:${h.y}%" data-part="${h.partId}" title="${p.name}">
     ${i+1}<b>${p.name}</b></div>`}).join('');
 el.addEventListener('click',e=>{const h=e.target.closest('[data-part]');if(!h)return;
  el.querySelectorAll('.hs').forEach(x=>x.classList.remove('on'));h.classList.add('on');
  onPick&&onPick(h.dataset.part)});
}
window.Viewer=Viewer;window.BayPanel=BayPanel;
})();
