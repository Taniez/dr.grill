import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {connectDatabase,tidbConfig,sqlTime} from '../server/db/connection.mjs';
import {setupDatabase,checkDatabase} from '../server/db/bootstrap.mjs';
import {schemaStatements} from '../server/db/schema.mjs';
import {importLegacy} from '../server/db/legacy.mjs';
import {openStore} from '../server/store.mjs';
import {priceOrder} from '../src/menu.js';
function fresh(){process.env.DB_DRIVER='sqlite';process.env.SQLITE_PATH=join(mkdtempSync(join(tmpdir(),'dg-db-')),'test.sqlite');}
test('TiDB configuration requires verified TLS and decodes credentials without leaking them',()=>{
 const config=tidbConfig({DATABASE_URL:'mysql://user%40tenant:pass%23word@db.example:4000/doctor_grill'});assert.equal(config.user,'user@tenant');assert.equal(config.password,'pass#word');assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.verifyIdentity,true);assert.equal(config.ssl.minVersion,'TLSv1.2');assert.equal(config.multipleStatements,false);assert.equal(config.timezone,'Z');
 assert.throws(()=>tidbConfig({}),/กรุณาตั้งค่า/);assert.throws(()=>tidbConfig({DATABASE_URL:'http://u:p@host/db'}));assert.throws(()=>tidbConfig({DATABASE_URL:'mysql://u:p@host/bad-name'}));
});
test('Schema setup is repeatable and retains edits; generated TiDB SQL matches application DDL',async()=>{
 fresh();const db=await connectDatabase();try{await setupDatabase(db);assert.deepEqual(await checkDatabase(db),{driver:'sqlite',schemaVersion:1,menuCount:44,categoryCount:4});
  await db.query('UPDATE dg_menu_items SET price_baht=? WHERE id=?',[12,'extra-0']);await setupDatabase(db);assert.equal((await db.query('SELECT price_baht FROM dg_menu_items WHERE id=?',['extra-0']))[0].price_baht,12);
  const sql=readFileSync('database/01-schema.sql','utf8');for(const statement of schemaStatements('tidb'))assert.ok(sql.includes(statement));assert.doesNotMatch(sql,/DROP TABLE/i);
  await assert.rejects(()=>db.query('INSERT INTO dg_order_items (order_id,line_number,menu_item_id,menu_id_snapshot,name_snapshot,unit_snapshot,portion,quantity,unit_price_baht,line_total_baht) VALUES (?,?,?,?,?,?,?,?,?,?)',['missing',1,'extra-0','extra-0','ไข่เจียว','ที่','normal',1,10,10]));
 }finally{await db.close();}
});
test('Transactions roll back all order rows on item failure, duplicate keys create one order, events record CAS changes',async()=>{
 fresh();const store=await openStore(),inspect=await connectDatabase();try{
  const invalid={table:'1',name:'',phone:'',note:'',items:[{id:'missing',name:'bad',unit:'จาน',qty:1,price:10,size:'normal'}],total:10};await assert.rejects(()=>store.create(invalid,randomUUID(),'x'));
  assert.equal((await inspect.query('SELECT COUNT(*) AS n FROM dg_orders'))[0].n,0);assert.equal((await inspect.query('SELECT COUNT(*) AS n FROM dg_order_events'))[0].n,0);
  const input=priceOrder({table:'1',items:[{id:'rice-4-0',size:'special',qty:2}]}),key=randomUUID();const [a,b]=await Promise.all([store.create(input,key,'tokenA'),store.create(input,key,'tokenB')]);assert.equal(a.id,b.id);assert.equal(a.token,b.token);
  await store.update(a.id,'cooking','new');await store.update(a.id,'cancelled','new');assert.equal((await store.find(a.id)).status,'cooking');const events=await inspect.query('SELECT * FROM dg_order_events WHERE order_id=?',[a.id]);assert.equal(events.length,2);
  const token='a'.repeat(64);await store.createSession(token,'fingerprint');assert.equal(await store.isSession(token,'fingerprint'),true);assert.equal(await store.isSession(token,'changed-password'),false);const [session]=await inspect.query('SELECT * FROM dg_admin_sessions');assert.notEqual(session.token_hash,token);
  await inspect.query('UPDATE dg_admin_sessions SET expires_at=?',[sqlTime(Date.now()-1000)]);assert.equal(await store.isSession(token,'fingerprint'),false);await store.cleanupSessions();assert.equal((await inspect.query('SELECT COUNT(*) AS n FROM dg_admin_sessions'))[0].n,0);
 }finally{await inspect.close();await store.close();}
});
test('Legacy import preserves prices, tokens and orders and can be safely repeated',async()=>{
 fresh();const db=await connectDatabase();let store;try{await setupDatabase(db);
  await db.query('CREATE TABLE catalog (id TEXT PRIMARY KEY,payload TEXT)');await db.query('CREATE TABLE orders (id TEXT PRIMARY KEY,request_key TEXT,token TEXT,created_at TEXT,status TEXT,payload TEXT,total INT)');
  const m={id:'extra-0',name:'ไข่เจียว',category:'extra',unit:'ที่',price:15,available:false,archived:false};await db.query('INSERT INTO catalog VALUES (?,?)',[m.id,JSON.stringify(m)]);
  const id=randomUUID(),key=randomUUID();await db.query('INSERT INTO orders VALUES (?,?,?,?,?,?,?)',[id,key,'legacy-token','2026-11-01T00:00:00.000Z','completed',JSON.stringify({table:'3',name:'ลูกค้าเก่า',phone:'',note:'',items:[{id:m.id,name:m.name,qty:1,price:10,size:'normal',unit:'ที่'}]}),10]);
  await assert.rejects(()=>checkDatabase(db),e=>e.code==='DB_LEGACY_DATA');assert.deepEqual(await importLegacy(db),{orders:1,menus:1});await checkDatabase(db);assert.deepEqual(await importLegacy(db),{alreadyImported:true});
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM orders'))[0].n,1);store=await openStore();const o=await store.get(id,'legacy-token');assert.equal(o.total,10);assert.equal(o.items[0].price,10);assert.equal((await store.catalog()).find(m=>m.id==='extra-0').price,15);assert.equal((await store.byKey(key)).id,id);
 }finally{await store?.close();await db.close();}
});

