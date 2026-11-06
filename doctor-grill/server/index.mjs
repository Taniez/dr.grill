import http from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {openStore} from './store.mjs';
import {priceOrder,categories} from '../src/menu.js';
const store=await openStore().catch(e=>{console.error('Database startup failed:',e.code||e.name,e.safeMessage||'ตรวจการเชื่อมต่อฐานข้อมูล แล้วรัน npm run db:check');process.exit(1);}),limits=new Map();
const password=process.env.ADMIN_PASSWORD||'';
const fingerprint=createHash('sha256').update(password).digest('hex');
const transitions={new:['cooking','cancelled'],cooking:['ready','cancelled'],ready:['completed'],completed:[],cancelled:[]};
function secureEqual(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function allowed(ip,type,max){const key=`${ip}:${type}`,now=Date.now();let x=limits.get(key);if(!x||now>x.until){x={n:0,until:now+60000};limits.set(key,x);}return ++x.n<=max;}
setInterval(()=>{const now=Date.now();store.cleanupSessions().catch(()=>{});for(const [k,v]of limits)if(v.until<now)limits.delete(k);},60000).unref();
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>20000)throw Error('ข้อมูลยาวเกินไป');}try{return JSON.parse(raw);}catch{throw Error('รูปแบบข้อมูลไม่ถูกต้อง');}}
function validMenu(input,existing){
 const name=String(input.name||'').trim(),category=input.category;
 if(!name||name.length>120||!categories[category]||!Number.isInteger(input.price)||input.price<1||input.price>10000||typeof input.available!=='boolean')throw Error('ข้อมูลเมนูไม่ถูกต้อง');
 if(category==='rice'&&(!Number.isInteger(input.special)||input.special<input.price||input.special>10000))throw Error('ราคาพิเศษไม่ถูกต้อง');
 const image=String(input.image||'');if(image&&!/^\/images\/[a-z0-9-]+\.webp$/.test(image))throw Error('รูปภาพไม่ถูกต้อง');
 return {id:existing?.id||'custom-'+randomUUID(),name,category,price:input.price,special:category==='rice'?input.special:undefined,unit:category==='rice'?'จาน':category==='snack'?'ไม้':'ที่',image,available:input.available,archived:existing?.archived||false};
}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
const pages=new Set(['index','menu','product','cooking','checkout','queue','location','qr','admin-login','login','dashboard','orders','kitchen','manage-menu','sales','staff-order']);
const removed=new Set(['random','wheel','member','customer','register','community','comunity','reviews','review','ai']);
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const url=new URL(req.url,'http://localhost'),path=url.pathname,ip=req.socket.remoteAddress;
 try{
  if(path.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method)){
    if(!String(req.headers['content-type']).includes('application/json'))return send(415,{error:'ต้องใช้ application/json'});
    const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host&&origin!==process.env.APP_ORIGIN)return send(403,{error:'ไม่อนุญาตแหล่งที่มา'});
   }
   const token=req.headers.cookie?.match(/(?:^|;\s*)dg_session=([^;]+)/)?.[1];const auth=token?await store.isSession(token,fingerprint):false;
   if(path==='/api/health'){try{await store.ping();return send(200,{ok:true,database:store.driver});}catch{return send(503,{ok:false,error:'ฐานข้อมูลไม่พร้อมใช้งาน'});}}
   if(path==='/api/menu'&&req.method==='GET')return send(200,(await store.catalog()).filter(m=>!m.archived));
   if(path==='/api/session'&&req.method==='GET')return send(auth?200:401,auth?{ok:true}:{error:'กรุณาเข้าสู่ระบบหลังร้าน'});
   if(path==='/api/login'&&req.method==='POST'){
    if(!allowed(ip,'login',8))return send(429,{error:'ลองใหม่อีกครั้งใน 1 นาที'});
    if(password.length<12)return send(503,{error:'กรุณาตั้ง ADMIN_PASSWORD อย่างน้อย 12 ตัวอักษรใน .env'});
    const input=await body(req);if(typeof input.password!=='string'||!secureEqual(input.password,password))return send(401,{error:'รหัสผ่านไม่ถูกต้อง'});
    const t=randomBytes(32).toString('hex');await store.createSession(t,fingerprint);res.setHeader('Set-Cookie',`dg_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(200,{ok:true});
   }
   if(path==='/api/logout'&&req.method==='POST'){await store.deleteSession(token);res.setHeader('Set-Cookie','dg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
   if(path==='/api/orders'&&req.method==='POST'){
    if(!allowed(ip,'order',20))return send(429,{error:'ส่งรายการถี่เกินไป กรุณารอสักครู่'});
    const input=await body(req);if(!/^[0-9a-f-]{36}$/i.test(input.requestKey||''))return send(400,{error:'รหัสคำขอไม่ถูกต้อง'});
    const old=await store.byKey(input.requestKey);if(old)return send(200,old);
    const order=priceOrder(input,await store.catalog());if(input.expectedTotal!==undefined&&input.expectedTotal!==order.total)return send(409,{error:'ราคาเมนูเปลี่ยนแล้ว กรุณารีโหลดหน้าเพื่อตรวจยอดก่อนยืนยัน'});
    return send(201,await store.create(order,input.requestKey,randomBytes(24).toString('hex')));
   }
   if(path.startsWith('/api/orders/')&&req.method==='GET'){
    const order=await store.get(path.split('/').pop(),req.headers['x-order-token']||'');return send(order?200:404,order||{error:'ไม่พบใบสั่งอาหาร'});
   }
   if(path.startsWith('/api/admin/')){
    if(!auth)return send(401,{error:'กรุณาเข้าสู่ระบบหลังร้าน'});
    if(path==='/api/admin/orders'&&req.method==='POST'){
     const input=await body(req);if(!/^[0-9a-f-]{36}$/i.test(input.requestKey||''))return send(400,{error:'รหัสคำขอไม่ถูกต้อง'});
     const old=await store.byKey(input.requestKey);if(old)return send(200,old);
     const order=priceOrder(input,await store.catalog());if(input.expectedTotal!==undefined&&input.expectedTotal!==order.total)return send(409,{error:'ราคาเปลี่ยนแล้ว กรุณารีโหลดหน้าเพื่อตรวจยอด'});
     return send(201,await store.create(order,input.requestKey,randomBytes(24).toString('hex'),'staff'));
    }
    if(path==='/api/admin/orders'&&req.method==='GET'){
     const offset=Number(url.searchParams.get('offset')||0),status=url.searchParams.get('status')||'all',search=(url.searchParams.get('q')||'').trim().slice(0,80);
     if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||!['all','active',...Object.keys(transitions)].includes(status))return send(400,{error:'ตัวกรองไม่ถูกต้อง'});
     return send(200,await store.list({offset,status,search}));
    }
    if(path.startsWith('/api/admin/orders/')&&req.method==='PATCH'){
     const id=path.split('/').pop(),{status}=await body(req),order=await store.find(id);
     if(!order)return send(404,{error:'ไม่พบออเดอร์'});
     if(!transitions[order.status]?.includes(status))return send(409,{error:'สถานะเปลี่ยนแล้วหรือไม่สามารถเปลี่ยนสถานะนี้ได้ กรุณารีเฟรช'});
     const updated=await store.update(id,status,order.status);if(updated.status!==status)return send(409,{error:'มีผู้เปลี่ยนสถานะนี้แล้ว กรุณารีเฟรช'});return send(200,updated);
    }
    if(path==='/api/admin/menu'&&req.method==='GET')return send(200,await store.catalog());
    if(path==='/api/admin/menu'&&req.method==='POST')return send(201,await store.saveMenu(validMenu(await body(req))));
    if(path.startsWith('/api/admin/menu/')&&req.method==='PATCH'){
     const m=(await store.catalog()).find(x=>x.id===path.split('/').pop());if(!m)return send(404,{error:'ไม่พบเมนู'});const input=await body(req);
     if(Object.keys(input).length===1&&typeof input.archived==='boolean')return send(200,await store.saveMenu({...m,archived:input.archived}));
     return send(200,await store.saveMenu(validMenu(input,m)));
    }
    if(path==='/api/admin/report'&&req.method==='GET'){
     const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
     if(!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)return send(400,{error:'ช่วงวันที่ไม่ถูกต้อง (สูงสุด 366 วัน)'});
     return send(200,await store.report(from,to));
    }
   }
   return send(404,{error:'ไม่พบ API'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
  const slug=path.replace(/^\//,'').replace(/\.html$/,'');if(removed.has(slug)){res.writeHead(410,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>หน้านี้ถูกนำออกแล้ว</h1><a href="/">กลับหน้าร้าน</a>');}
  const base=resolve('dist');let file=resolve(base,'.'+decodeURIComponent(path));if(!file.startsWith(base+sep)&&file!==base)return send(403,{error:'Forbidden'});
  if(path==='/')file=resolve(base,'index.html');else if(pages.has(slug))file=resolve(base,slug+'.html');
  try{if(!(await stat(file)).isFile())return send(404,{error:'ไม่พบหน้าเว็บ'});}catch{return send(404,{error:'ไม่พบหน้าเว็บ'});}
  const content=await readFile(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){if(/กรุณา|ไม่ถูกต้อง|ยาวเกินไป|เลือกอาหาร/.test(e.message))return send(400,{error:e.message});console.error('Request failed:',e.code||e.name);send(500,{error:'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'});}
});
server.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`Doctor Grill API: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3001} (${store.driver})`));

let shuttingDown=false;function shutdown(){if(shuttingDown)return;shuttingDown=true;server.close(async()=>{await store.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
