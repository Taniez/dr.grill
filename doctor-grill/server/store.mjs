import {withMenuImage} from '../src/menu-images.js';
import {randomUUID,createHash} from 'node:crypto';
import {connectDatabase,sqlTime,isoTime} from './db/connection.mjs';
import {setupDatabase,checkDatabase,menuColumns,menuValues} from './db/bootstrap.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const menuRow=r=>({id:r.id,category:r.category_id,name:r.name,price:Number(r.price_baht),...(r.special_price_baht===null?{}:{special:Number(r.special_price_baht)}),unit:r.unit,meat:r.meat||undefined,image:r.image_path||undefined,available:!!Number(r.is_available),archived:!!Number(r.is_archived)});
const headerRow=r=>({id:r.id,table:r.table_number,name:r.customer_name,phone:r.customer_phone,note:r.note,status:r.status,total:Number(r.total_baht),createdAt:isoTime(r.created_at)});
export async function openStore(){
 const db=await connectDatabase();try{if(db.driver==='sqlite'||process.env.DB_AUTO_SETUP==='true')await setupDatabase(db);await checkDatabase(db);}catch(e){await db.close();throw e;}
 const q=db.query;
 async function hydrate(rows,query=q){if(!rows.length)return [];const ids=rows.map(r=>r.id);const items=await query(`SELECT * FROM dg_order_items WHERE order_id IN (${ids.map(()=>'?').join(',')}) ORDER BY line_number`,ids);const groups=new Map();for(const x of items){if(!groups.has(x.order_id))groups.set(x.order_id,[]);groups.get(x.order_id).push({id:x.menu_id_snapshot,name:x.name_snapshot,unit:x.unit_snapshot,size:x.portion,qty:Number(x.quantity),price:Number(x.unit_price_baht)});}return rows.map(r=>({...headerRow(r),items:groups.get(r.id)||[]}));}
 async function byKey(key,query=q){const rows=await query('SELECT * FROM dg_orders WHERE request_key=?',[key]);if(!rows.length)return null;return {...(await hydrate(rows,query))[0],token:rows[0].tracking_token};}
 const store={driver:db.driver,close:db.close,
  async ping(){await q('SELECT 1 AS ok');return true;},
  async catalog(){return (await q('SELECT * FROM dg_menu_items ORDER BY id')).map(menuRow).map(withMenuImage);},
  async saveMenu(m){const now=sqlTime();return db.transaction(async tx=>{const old=await tx('SELECT id FROM dg_menu_items WHERE id=?',[m.id]);if(old.length)await tx('UPDATE dg_menu_items SET category_id=?,name=?,price_baht=?,special_price_baht=?,unit=?,meat=?,image_path=?,is_available=?,is_archived=?,updated_at=? WHERE id=?',[m.category,m.name,m.price,m.special??null,m.unit,m.meat||null,m.image||null,m.available?1:0,m.archived?1:0,now,m.id]);else await tx(`INSERT INTO dg_menu_items (${menuColumns}) VALUES (${Array(12).fill('?').join(',')})`,menuValues(m,now));return m;});},
  byKey,
  async create(order,key,token,actor='customer'){try{return await db.transaction(async tx=>{
   const old=await byKey(key,tx);if(old)return old;const id=randomUUID(),now=sqlTime();
   await tx('INSERT INTO dg_orders (id,request_key,tracking_token,table_number,customer_name,customer_phone,note,status,total_baht,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,key,token,order.table,order.name,order.phone,order.note,'new',order.total,now,now]);
   for(const [i,x]of order.items.entries())await tx('INSERT INTO dg_order_items (order_id,line_number,menu_item_id,menu_id_snapshot,name_snapshot,unit_snapshot,portion,quantity,unit_price_baht,line_total_baht) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,i+1,x.id,x.id,x.name,x.unit,x.size,x.qty,x.price,x.qty*x.price]);
   await tx('INSERT INTO dg_order_events (id,order_id,from_status,to_status,actor,created_at) VALUES (?,?,?,?,?,?)',[randomUUID(),id,null,'new',actor,now]);
   return {...order,id,createdAt:isoTime(now),status:'new',token};
  });}catch(e){const old=await byKey(key);if(old)return old;throw e;}},
  async get(id,token){return (await hydrate(await q('SELECT * FROM dg_orders WHERE id=? AND tracking_token=?',[id,token])))[0]||null;},
  async find(id){return (await hydrate(await q('SELECT * FROM dg_orders WHERE id=?',[id])))[0]||null;},
  async list({offset=0,status='all',search=''}={}){
   if(!Number.isSafeInteger(offset)||offset<0)throw Error('offset ไม่ถูกต้อง');const where=[],args=[];
   if(status==='active')where.push("o.status IN ('new','cooking','ready')");else if(status!=='all'){where.push('o.status=?');args.push(status);}
   if(search){where.push('(o.id LIKE ? OR o.table_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR EXISTS (SELECT 1 FROM dg_order_items i WHERE i.order_id=o.id AND i.name_snapshot LIKE ?))');args.push(...Array(5).fill('%'+search+'%'));}
   return hydrate(await q(`SELECT o.* FROM dg_orders o ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY o.created_at ${status==='active'?'ASC':'DESC'},o.id DESC LIMIT 100 OFFSET ${offset}`,args));
  },
  async update(id,status,previous){return db.transaction(async tx=>{const now=sqlTime();const result=await tx('UPDATE dg_orders SET status=?,updated_at=? WHERE id=? AND status=?',[status,now,id,previous]);if(Number(result.affectedRows)===1)await tx('INSERT INTO dg_order_events (id,order_id,from_status,to_status,actor,created_at) VALUES (?,?,?,?,?,?)',[randomUUID(),id,previous,status,'staff',now]);return (await hydrate(await tx('SELECT * FROM dg_orders WHERE id=?',[id]),tx))[0]||null;});},
  async report(from,to){const args=[sqlTime(from+'T00:00:00+07:00'),sqlTime(to+'T23:59:59.999+07:00')];
   const range='o.created_at>=? AND o.created_at<=?';const day=db.driver==='tidb'?"DATE_FORMAT(DATE_ADD(o.created_at, INTERVAL 7 HOUR), '%Y-%m-%d')":"strftime('%Y-%m-%d',o.created_at,'+7 hours')";
   // One transaction gives a consistent report while staff change statuses.
   return db.transaction(async tx=>{
    const [r]=await tx(`SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN status='completed' THEN total_baht ELSE 0 END),0) AS total,COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) AS completed,COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled,COALESCE(SUM(CASE WHEN status IN ('new','cooking','ready') THEN 1 ELSE 0 END),0) AS active FROM dg_orders o WHERE ${range}`,args);
    const days=await tx(`SELECT ${day} AS date,SUM(o.total_baht) AS total FROM dg_orders o WHERE ${range} AND o.status='completed' GROUP BY ${day} ORDER BY date`,args);
    const products=await tx(`SELECT i.menu_id_snapshot AS id,MAX(i.name_snapshot) AS name,SUM(i.quantity) AS qty,SUM(i.line_total_baht) AS total FROM dg_order_items i JOIN dg_orders o ON o.id=i.order_id WHERE ${range} AND o.status='completed' GROUP BY i.menu_id_snapshot ORDER BY total DESC`,args);
    return {from,to,...Object.fromEntries(['count','total','completed','cancelled','active'].map(k=>[k,Number(r[k])])),days:days.map(x=>({date:x.date,total:Number(x.total)})),products:products.map(x=>({...x,qty:Number(x.qty),total:Number(x.total)}))};
   });
  },
  async createSession(token,fingerprint){const now=sqlTime(),expiry=sqlTime(Date.now()+8*3600000);await q('INSERT INTO dg_admin_sessions (token_hash,credential_fingerprint,created_at,expires_at) VALUES (?,?,?,?)',[hash(token),fingerprint,now,expiry]);},
  async isSession(token,fingerprint){if(!token||!/^[a-f0-9]{64}$/.test(token))return false;return (await q('SELECT token_hash FROM dg_admin_sessions WHERE token_hash=? AND credential_fingerprint=? AND expires_at>?',[hash(token),fingerprint,sqlTime()])).length>0;},
  async deleteSession(token){if(token)await q('DELETE FROM dg_admin_sessions WHERE token_hash=?',[hash(token)]);},
  async cleanupSessions(){await q('DELETE FROM dg_admin_sessions WHERE expires_at<=?',[sqlTime()]);}
 };
 return store;
}
