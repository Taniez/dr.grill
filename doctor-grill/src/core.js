import {categories} from './menu.js';
export {categories};
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>Number(n).toLocaleString('th-TH')+' ฿';
export const statuses={new:'รับออเดอร์แล้ว',cooking:'กำลังปรุง',ready:'พร้อมเสิร์ฟ',completed:'เสร็จสิ้น',cancelled:'ยกเลิก'};
export const transitions={new:['cooking','cancelled'],cooking:['ready','cancelled'],ready:['completed'],completed:[],cancelled:[]};
export const actionNames={cooking:'เริ่มปรุง',ready:'พร้อมเสิร์ฟ',completed:'เสิร์ฟแล้ว / เสร็จสิ้น',cancelled:'ยกเลิก'};
export const dateTH=value=>new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
export const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export const getSaved=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export let catalog=[];
export let cart=getSaved('dg-cart',[]);if(!Array.isArray(cart))cart=[];
cart=cart.filter(x=>x&&typeof x.id==='string'&&['normal','special'].includes(x.size)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=99);
let requestKey=localStorage.getItem('dg-request')||crypto.randomUUID();localStorage.setItem('dg-request',requestKey);
export async function api(path,options={}){let r;try{r=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});}catch{throw Error('เชื่อมต่อร้านไม่ได้ กรุณาลองใหม่');}let data;try{data=await r.json();}catch{throw Error('เซิร์ฟเวอร์ไม่พร้อมใช้งาน');}if(!r.ok){const e=Error(data.error||'เกิดข้อผิดพลาด');e.status=r.status;throw e;}return data;}
export async function loadCatalog(){catalog=await api('/menu');const order=Object.keys(categories);catalog.sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category)||a.id.localeCompare(b.id));return catalog;}
export function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');setTimeout(()=>$('#toast')?.classList.remove('show'),4500);}
export function newKey(){requestKey=crypto.randomUUID();localStorage.setItem('dg-request',requestKey);}
export function saveCart(){localStorage.setItem('dg-cart',JSON.stringify(cart));newKey();updateBadge();}
export function updateBadge(){const count=cart.reduce((s,x)=>s+x.qty,0);document.querySelectorAll('[data-cart-count]').forEach(e=>e.textContent=count);}
export function addItem(id,size='normal',qty=1){const m=catalog.find(x=>x.id===id);if(!m||!m.available||size==='special'&&!m.special)throw Error('เมนูนี้ยังไม่พร้อมจำหน่าย');if(!Number.isInteger(qty)||qty<1||qty>99)throw Error('จำนวนต้องอยู่ระหว่าง 1–99');const old=cart.find(x=>x.id===id&&x.size===size);if(old){if(old.qty+qty>99)throw Error('สูงสุด 99 ต่อรายการ');old.qty+=qty;}else cart.push({id,size,qty});saveCart();}
export function setQuantity(index,qty){if(qty<=0)cart.splice(index,1);else cart[index].qty=Math.min(99,qty);saveCart();}
export function cartLines(){return cart.map(x=>{const m=catalog.find(m=>m.id===x.id);const price=m?(x.size==='special'?m.special:m.price):0;return {...x,m,price,valid:!!m&&m.available&&Number.isFinite(price)};});}
export function cartTotal(){return cartLines().reduce((s,x)=>s+x.qty*(x.price||0),0);}
export function draft(){try{return JSON.parse(sessionStorage.getItem('dg-draft')||'{}');}catch{return {};}}
export function saveDraft(data){sessionStorage.setItem('dg-draft',JSON.stringify(data));newKey();}
export async function submitCart(data){const result=await api('/orders',{method:'POST',body:JSON.stringify({...data,items:cart,requestKey,expectedTotal:cartTotal()})});
 const record={id:result.id,token:result.token};const history=getSaved('dg-history',[]);localStorage.setItem('dg-history',JSON.stringify([record,...history.filter(x=>x.id!==record.id)].slice(0,30)));localStorage.setItem('dg-last-order',JSON.stringify(record));cart=[];saveCart();return result;}
export function errorView(error){$('#main').innerHTML=`<section class="page-section"><h1>ยังเปิดหน้านี้ไม่ได้</h1><p role="alert">${esc(error.message)}</p><button id="retry">ลองใหม่</button> <a href="/index.html">กลับหน้าแรก</a></section>`;$('#retry').onclick=()=>location.reload();}
export function heading(label,title,description=''){return `<div class="section-heading"><div class="eyebrow">${label}</div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>`;}
export function receipt(o){return `<section class="receipt"><div class="eyebrow">รายการใบสั่งอาหาร</div><h2>ด็อกเตอร์กริล</h2><p>#${o.id.slice(0,8)} · ${dateTH(o.createdAt)}</p><span class="status ${o.status}">${statuses[o.status]}</span><p>โต๊ะ ${esc(o.table||'—')} · ${esc(o.name||'—')}<br>โทร ${esc(o.phone||'—')}</p>${o.items.map(x=>`<div class="receipt-row"><span>${esc(x.name)} ${x.size==='special'?'(พิเศษ)':''} × ${x.qty} ${esc(x.unit||'')}</span><b>${money(x.price*x.qty)}</b></div>`).join('')}${o.note?`<p>หมายเหตุ: ${esc(o.note)}</p>`:''}<div class="total"><span>รวม</span><b>${money(o.total)}</b></div><p>ชำระเงินที่ร้าน · 0638462546 / 0615988666</p></section>`;}

