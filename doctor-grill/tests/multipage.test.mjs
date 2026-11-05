import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
test('Multi-page APIs: menu edits, availability, history, reports, pagination, restart',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'dg-full-test-')),dbPath=join(folder,'test.sqlite'),port=39484;
 let child;const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DB_DRIVER:'sqlite',SQLITE_PATH:dbPath,ADMIN_PASSWORD:'testing-staff-password'};
 async function start(){child=spawn(process.execPath,['server/index.mjs'],{env,stdio:['ignore','pipe','pipe']});await new Promise((ok,bad)=>{const timer=setTimeout(()=>bad(Error('Startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('Doctor Grill API')){clearTimeout(timer);ok();}});child.once('exit',code=>{clearTimeout(timer);bad(Error('Exit '+code));});});}
 const req=(path,method='GET',data,auth={})=>fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{'Content-Type':'application/json',...auth},body:data?JSON.stringify(data):undefined});
 try{await start();
  assert.equal((await req('/admin/menu','POST',{})).status,401);assert.equal((await req('/admin/report?from=2026-01-01&to=2026-01-31')).status,401);
  let login=await req('/login','POST',{password:env.ADMIN_PASSWORD});let auth={Cookie:login.headers.get('set-cookie').split(';')[0]};
  let catalog=await(await req('/menu')).json();assert.equal(catalog.length,44);
  const item=catalog.find(m=>m.id==='rice-0-0'),input={table:'A',items:[{id:item.id,qty:1,size:'normal'}],requestKey:randomUUID(),expectedTotal:60};
  const order=await(await req('/orders','POST',input)).json();assert.equal(order.total,60);
  let edited=await req('/admin/menu/'+item.id,'PATCH',{...item,price:65,special:75},auth);assert.equal(edited.status,200);
  assert.equal((await req('/orders','POST',{...input,requestKey:randomUUID()})).status,409);
  const history=await(await req('/orders/'+order.id,'GET',null,{'X-Order-Token':order.token})).json();assert.equal(history.total,60);
  await req('/admin/menu/'+item.id,'PATCH',{...item,available:false},auth);
  assert.equal((await req('/orders','POST',{...input,requestKey:randomUUID()})).status,400);
  assert.equal((await(await req('/orders','POST',input)).json()).id,order.id);
  const added=await(await req('/admin/menu','POST',{name:'เมนูทดสอบ',category:'side',price:135,available:true,image:''},auth)).json();assert.match(added.id,/^custom-/);
  assert.equal((await req('/admin/menu/'+added.id,'PATCH',{archived:true},auth)).status,200);
  assert.equal((await(await req('/menu')).json()).some(m=>m.id===added.id),false);
  await req('/admin/menu/'+added.id,'PATCH',{archived:false},auth);
  assert.equal((await(await req('/menu')).json()).some(m=>m.id===added.id),true);
  assert.equal((await req('/admin/menu','POST',{name:'bad',category:'side',price:-1,available:true},auth)).status,400);
  assert.equal((await req('/orders','POST',{...input,items:[null],requestKey:randomUUID()})).status,400);
  const db=new DatabaseSync(dbPath),insert=db.prepare('INSERT INTO dg_orders (id,request_key,tracking_token,table_number,customer_name,customer_phone,note,status,total_baht,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),insertLine=db.prepare('INSERT INTO dg_order_items (order_id,line_number,menu_item_id,menu_id_snapshot,name_snapshot,unit_snapshot,portion,quantity,unit_price_baht,line_total_baht) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<205;i++){const id=randomUUID();insert.run(id,randomUUID(),'token','historical-fixture','','','','completed',10,'2026-01-15 12:00:00.000','2026-01-15 12:00:00.000');insertLine.run(id,1,'extra-0','extra-0','ไข่เจียว','ที่','normal',1,10,10);}
  db.close();
  const report=await(await req('/admin/report?from=2026-01-01&to=2026-01-31','GET',null,auth)).json();assert.equal(report.total,2050);assert.equal(report.completed,205);assert.equal(report.products[0].qty,205);
  assert.equal((await req('/admin/report?from=2026-02-30&to=2026-03-01','GET',null,auth)).status,400);
  assert.equal((await(await req('/admin/orders?q=historical-fixture&offset=100','GET',null,auth)).json()).length,100);
  assert.equal((await(await req('/admin/orders?q=historical-fixture&offset=200','GET',null,auth)).json()).length,5);
  const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;await start();
  assert.equal((await req('/session','GET',null,auth)).status,200);
  const persisted=await(await req('/menu')).json();assert.equal(persisted.find(m=>m.id===item.id).available,false);assert.ok(persisted.find(m=>m.id===added.id));
  assert.equal((await(await req('/orders/'+order.id,'GET',null,{'X-Order-Token':order.token})).json()).total,60);
 }finally{child?.kill();}
});
