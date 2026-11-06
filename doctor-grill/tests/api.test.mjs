import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
test('API: persistence, authentication, duplicate submission, status transitions',async()=>{
 const port=39483,password='test-password-unique-123';const folder=mkdtempSync(join(tmpdir(),'doctor-grill-test-'));
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DB_DRIVER:'sqlite',SQLITE_PATH:join(folder,'test.sqlite'),ADMIN_PASSWORD:password,APP_ORIGIN:'http://127.0.0.1:5173'},stdio:['ignore','pipe','pipe']});
 const base=`http://127.0.0.1:${port}/api`;const req=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('Doctor Grill API')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error('server exited '+code));});});
  assert.equal((await req('/admin/orders')).status,401);
  assert.equal((await req('/admin/orders','POST',{})).status,401);
  assert.equal((await req('/orders','POST',{}, {Origin:'https://evil.example'})).status,403);
  const input={table:'7',name:'ทดสอบ',items:[{id:'rice-4-0',size:'special',qty:2,price:1}],requestKey:randomUUID()};
  const response=await req('/orders','POST',input,{Origin:'http://127.0.0.1:5173'});assert.equal(response.status,201);const order=await response.json();assert.equal(order.total,160);
  const duplicate=await (await req('/orders','POST',input)).json();assert.equal(duplicate.id,order.id);
  assert.equal((await req('/orders/'+order.id)).status,404);
  assert.equal((await req('/orders/'+order.id,'GET',null,{'X-Order-Token':order.token})).status,200);
  assert.equal((await req('/login','POST',{password:'wrong'})).status,401);
  const login=await req('/login','POST',{password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const auth={Cookie:cookie};assert.equal((await (await req('/admin/orders','GET',null,auth)).json()).length,1);
  assert.equal((await req('/admin/orders/'+order.id,'PATCH',{status:'completed'},auth)).status,409);
  for(const status of ['cooking','ready','completed'])assert.equal((await req('/admin/orders/'+order.id,'PATCH',{status},auth)).status,200);
  const saved=await(await req('/orders/'+order.id,'GET',null,{'X-Order-Token':order.token})).json();assert.equal(saved.status,'completed');
  const staffInput={table:'POS-1',items:[{id:'rice-4-0',size:'special',qty:1},{id:'extra-1',size:'normal',qty:1}],requestKey:randomUUID(),expectedTotal:90};
  assert.equal((await req('/admin/orders','POST',{...staffInput,expectedTotal:1},auth)).status,409);
  const staffResponse=await req('/admin/orders','POST',staffInput,auth);assert.equal(staffResponse.status,201);const staffOrder=await staffResponse.json();assert.equal(staffOrder.total,90);
  const staffRetry=await(await req('/admin/orders','POST',staffInput,auth)).json();assert.equal(staffRetry.id,staffOrder.id);
  assert((await(await req('/admin/orders?status=active','GET',null,auth)).json()).some(o=>o.id===staffOrder.id));
  await req('/logout','POST',{},auth);assert.equal((await req('/admin/orders','GET',null,auth)).status,401);
 }finally{child.kill();}
});


