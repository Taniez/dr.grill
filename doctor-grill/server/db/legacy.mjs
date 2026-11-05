import {randomUUID} from 'node:crypto';
import {sqlTime,failure} from './connection.mjs';
import {menuColumns,menuValues} from './bootstrap.mjs';
import {menu as seed} from '../../src/menu.js';
export async function hasTable(db,name){const rows=db.driver==='sqlite'?await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[name]):await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[name]);return rows.length>0;}
export async function importLegacy(db){
 const meta=(await db.query('SELECT legacy_imported_at FROM dg_schema_migrations WHERE version=1'))[0];if(meta?.legacy_imported_at)return {alreadyImported:true};
 const legacyOrders=await hasTable(db,'orders'),legacyMenu=await hasTable(db,'catalog');if(!legacyOrders&&!legacyMenu)return {orders:0,menus:0,message:'ไม่พบตารางรุ่นเก่าในฐานข้อมูลนี้'};
 if(Number((await db.query('SELECT COUNT(*) AS n FROM dg_orders'))[0].n)>0)throw failure('DB_IMPORT_CONFLICT','ฐานข้อมูลใหม่มีออเดอร์แล้ว จึงไม่รวมข้อมูลเก่าอัตโนมัติ');
 const targets=await db.query('SELECT * FROM dg_menu_items');if(targets.some(x=>{const m=seed.find(m=>m.id===x.id);return !m||String(x.created_at)!==String(x.updated_at)||x.name!==m.name||Number(x.price_baht)!==m.price||(x.special_price_baht===null?null:Number(x.special_price_baht))!==(m.special??null)||Number(x.is_available)!==1||Number(x.is_archived)!==0;}))throw failure('DB_IMPORT_CONFLICT','มีการแก้เมนูในโครงสร้างใหม่แล้ว กรุณาย้ายข้อมูลก่อนเริ่มใช้งานฐานข้อมูลใหม่');
 const oldMenus=legacyMenu?await db.query('SELECT * FROM catalog'):[],oldOrders=legacyOrders?await db.query('SELECT * FROM orders ORDER BY created_at'):[];
 return db.transaction(async tx=>{
  for(const row of oldMenus){const m=JSON.parse(row.payload);if(m.id!==row.id||!m.name||!Number.isInteger(m.price))throw failure('DB_IMPORT_INVALID','ข้อมูลเมนูเก่าไม่ถูกต้อง');const exists=await tx('SELECT id FROM dg_menu_items WHERE id=?',[m.id]);const now=sqlTime();if(exists.length){const v=menuValues(m,now);await tx('UPDATE dg_menu_items SET category_id=?,name=?,price_baht=?,special_price_baht=?,unit=?,meat=?,image_path=?,is_available=?,is_archived=?,updated_at=? WHERE id=?',[...v.slice(1,10),now,m.id]);}else await tx(`INSERT INTO dg_menu_items (${menuColumns}) VALUES (${Array(12).fill('?').join(',')})`,menuValues(m,now));}
  const ids=new Set((await tx('SELECT id FROM dg_menu_items')).map(x=>x.id));
  for(const r of oldOrders){const o=JSON.parse(r.payload);if(!Array.isArray(o.items)||!o.items.length||o.items.some(x=>!x||!Number.isInteger(x.qty)||x.qty<1||!Number.isInteger(x.price)||x.price<0)||o.items.reduce((s,x)=>s+x.qty*x.price,0)!==Number(r.total))throw failure('DB_IMPORT_INVALID','ยอดรวมออเดอร์เก่าไม่ตรงกับรายการอาหาร');const now=sqlTime(r.created_at);
   await tx('INSERT INTO dg_orders (id,request_key,tracking_token,table_number,customer_name,customer_phone,note,status,total_baht,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[r.id,r.request_key,r.token,o.table||'',o.name||'',o.phone||'',o.note||'',r.status,Number(r.total),now,now]);
   for(const [i,x]of o.items.entries())await tx('INSERT INTO dg_order_items (order_id,line_number,menu_item_id,menu_id_snapshot,name_snapshot,unit_snapshot,portion,quantity,unit_price_baht,line_total_baht) VALUES (?,?,?,?,?,?,?,?,?,?)',[r.id,i+1,ids.has(x.id)?x.id:null,x.id,x.name,x.unit||'ที่',x.size||'normal',x.qty,x.price,x.qty*x.price]);
   await tx('INSERT INTO dg_order_events (id,order_id,from_status,to_status,actor,created_at) VALUES (?,?,?,?,?,?)',[randomUUID(),r.id,null,r.status,'migration',now]);
  }
  await tx('UPDATE dg_schema_migrations SET legacy_imported_at=? WHERE version=1',[sqlTime()]);return {orders:oldOrders.length,menus:oldMenus.length};
 });
}
