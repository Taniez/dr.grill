import {renderStaffOrder} from './staff-order.js';
import './style.css';
import './pages.css';
import {$,esc,api,updateBadge,errorView,loadCatalog,draft,saveDraft} from './core.js';
import {renderHome,renderMenu,renderProduct,renderCooking,renderCheckout,renderQueue,renderLocation,renderQR} from './shop-pages.js';
import {renderLogin,renderDashboard,renderOrders,renderManageMenu,renderSales} from './admin-pages.js';
const params=new URLSearchParams(location.search);
if(params.has('table'))saveDraft({...draft(),table:params.get('table').slice(0,20)});
let page=location.pathname.split('/').pop().replace(/\.html$/,'')||'index';
if(params.get('view')==='kitchen')page='kitchen';
const names={index:'หน้าแรก',menu:'เมนูอาหาร',product:'รายละเอียดอาหาร',cooking:'จัดจานของคุณ',checkout:'ตะกร้าและใบสั่ง',queue:'ติดตามคิว',location:'ติดต่อร้าน',qr:'สั่งอาหาร / QR โต๊ะ','admin-login':'เข้าสู่ระบบพนักงาน',login:'เข้าสู่ระบบพนักงาน',dashboard:'ภาพรวมร้าน',orders:'ออเดอร์ทั้งหมด',kitchen:'หน้าครัว','manage-menu':'จัดการเมนู',sales:'รายงานยอดขาย','staff-order':'รับออเดอร์'};
const admin=['dashboard','orders','kitchen','manage-menu','sales','staff-order'].includes(page);
document.title=(names[page]||'ไม่พบหน้าเว็บ')+' | ด็อกเตอร์กริล';document.body.dataset.page=page;
const publicNav=[['index','หน้าแรก'],['menu','เมนูอาหาร'],['queue','ติดตามคิว'],['location','ติดต่อร้าน']];
const adminNav=[['staff-order','รับออเดอร์'],['dashboard','ภาพรวม'],['orders','ออเดอร์'],['kitchen','หน้าครัว'],['manage-menu','จัดการเมนู'],['sales','ยอดขาย'],['qr','QR โต๊ะ']];
const links=list=>list.map(([id,label])=>`<a href="/${id}.html" ${id===page?'aria-current="page"':''}>${label}</a>`).join('');
$('#app').innerHTML=`<header><a class="brand" href="/index.html"><img class="brand-logo" src="/images/logo.webp" alt="โลโก้ด็อกเตอร์กริล" width="68" height="68"><span>ด็อกเตอร์กริล<small>DOCTOR GRILL</small></span></a><nav aria-label="เมนูหลัก">${links(publicNav)}<a class="cart-link" href="/checkout.html">ตะกร้า <b data-cart-count>0</b></a><a href="/dashboard.html">หลังร้าน ↗</a></nav><details class="mobile-nav"><summary>เมนู ☰</summary><nav>${links(publicNav)}<a href="/checkout.html">ตะกร้า (<span data-cart-count>0</span>)</a><a href="/dashboard.html">หลังร้าน</a></nav></details></header>${admin?`<div class="admin-nav"><nav aria-label="เมนูหลังร้าน">${links(adminNav)}</nav><button id="logout">ออกจากระบบ</button></div>`:''}<main id="main"><div class="empty">กำลังโหลด…</div></main><footer><b>ด็อกเตอร์กริล</b><span>รับทำข้าวกล่อง · <a href="tel:0638462546">0638462546</a> / <a href="tel:0615988666">0615988666</a></span><a href="/qr.html">สั่งอาหารที่โต๊ะ</a><a href="/photo-credits.html">เครดิตภาพประกอบ</a></footer><div id="toast" role="status" aria-live="polite"></div>`;
updateBadge();
if($('#logout'))$('#logout').onclick=async()=>{await api('/logout',{method:'POST',body:'{}'});location.href='/admin-login.html';};
try{
 if(admin){try{await api('/session');}catch(e){if(e.status===401){location.replace('/admin-login.html?next='+encodeURIComponent(page));throw Error('กำลังเปิดหน้าเข้าสู่ระบบ');}throw e;}}
 const routes={'staff-order':renderStaffOrder,index:renderHome,menu:renderMenu,product:renderProduct,cooking:renderCooking,checkout:renderCheckout,queue:renderQueue,location:renderLocation,qr:renderQR,'admin-login':renderLogin,login:renderLogin,dashboard:renderDashboard,orders:()=>renderOrders(false),kitchen:()=>renderOrders(true),'manage-menu':renderManageMenu,sales:renderSales};
 if(['index','menu','product','cooking','checkout'].includes(page))await loadCatalog();
 if(routes[page])await routes[page]();else $('#main').innerHTML='<section class="page-section"><h1>ไม่พบหน้าเว็บนี้</h1><a class="primary" href="/index.html">กลับหน้าร้าน</a></section>';
}catch(e){errorView(e);}

import './refresh.css';
