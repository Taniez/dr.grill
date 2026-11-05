import {schemaStatements,schemaVersion,indexes} from './schema.mjs';
import {sqlTime,failure} from './connection.mjs';
import {menu,categories} from '../../src/menu.js';
export function menuValues(m,now=sqlTime()){return [m.id,m.category,m.name,m.price,m.special??null,m.unit,m.meat||null,m.image||null,m.available===false?0:1,m.archived?1:0,now,now];}
export const menuColumns='id,category_id,name,price_baht,special_price_baht,unit,meat,image_path,is_available,is_archived,created_at,updated_at';
export async function setupDatabase(db){
 for(const sql of schemaStatements(db.driver))await db.query(sql);
 for(const [table,name,columns] of indexes){
  if(db.driver==='sqlite')await db.query(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columns})`);
  else{const found=await db.query('SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?',[table,name]);if(!found.length)await db.query(`CREATE INDEX ${name} ON ${table} (${columns})`);}
 }
 const insert=db.driver==='tidb'?'INSERT IGNORE':'INSERT OR IGNORE';
 await db.transaction(async q=>{
  let i=0;for(const [id,name]of Object.entries(categories))await q(`${insert} INTO dg_menu_categories (id,name,sort_order) VALUES (?,?,?)`,[id,name,i++]);
  for(const m of menu)await q(`${insert} INTO dg_menu_items (${menuColumns}) VALUES (${Array(12).fill('?').join(',')})`,menuValues(m));
  await q(`${insert} INTO dg_schema_migrations (version,applied_at) VALUES (?,?)`,[schemaVersion,sqlTime()]);
 });
}
export async function checkDatabase(db){
 try{const rows=await db.query('SELECT MAX(version) AS version FROM dg_schema_migrations');if(Number(rows[0]?.version)!==schemaVersion)throw failure('DB_VERSION','เวอร์ชันฐานข้อมูลไม่ตรงกับแอป');
  for(const sql of ['SELECT id,name FROM dg_menu_categories LIMIT 1','SELECT id,price_baht,special_price_baht FROM dg_menu_items LIMIT 1','SELECT id,total_baht,tracking_token FROM dg_orders LIMIT 1','SELECT order_id,quantity,unit_price_baht FROM dg_order_items LIMIT 1','SELECT order_id,to_status FROM dg_order_events LIMIT 1','SELECT token_hash,expires_at FROM dg_admin_sessions LIMIT 1'])await db.query(sql);
 }catch(e){if(e.safeMessage)throw e;if(!['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR','ERR_SQLITE_ERROR'].includes(e.code))throw e;throw failure('DB_NOT_READY','ยังไม่ได้ติดตั้งโครงสร้างฐานข้อมูล กรุณารัน npm run db:setup');}
 const [menus,cats]=await Promise.all([db.query('SELECT COUNT(*) AS count FROM dg_menu_items'),db.query('SELECT COUNT(*) AS count FROM dg_menu_categories')]);
 const {hasTable}=await import('./legacy.mjs');
 const meta=(await db.query('SELECT legacy_imported_at FROM dg_schema_migrations WHERE version=1'))[0];
 if(!meta.legacy_imported_at){for(const name of ['orders','catalog']){if(await hasTable(db,name)){const old=(await db.query('SELECT COUNT(*) AS n FROM '+name))[0];if(Number(old.n)>0)throw failure('DB_LEGACY_DATA','พบข้อมูลจากรุ่นเก่า กรุณารัน npm run db:import-legacy ก่อนเริ่มแอป');}}}
 return {driver:db.driver,schemaVersion,menuCount:Number(menus[0].count),categoryCount:Number(cats[0].count)};
}
