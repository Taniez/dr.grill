import {mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
export function failure(code,message){return Object.assign(new Error(message),{code,safeMessage:message});}
export function tidbConfig(env=process.env){
 let fields={};if(env.DATABASE_URL){let u;try{u=new URL(env.DATABASE_URL);}catch{throw failure('DB_CONFIG','DATABASE_URL ไม่ถูกต้อง');}if(u.protocol!=='mysql:')throw failure('DB_CONFIG','DATABASE_URL ต้องขึ้นต้น mysql://');fields={host:u.hostname,port:u.port||4000,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1))};}
 else fields={host:env.TIDB_HOST,port:env.TIDB_PORT||4000,user:env.TIDB_USER,password:env.TIDB_PASSWORD,database:env.TIDB_DATABASE||'doctor_grill'};
 if(!fields.host||!fields.user||!fields.password||!fields.database)throw failure('DB_CONFIG','กรุณาตั้งค่า TIDB_HOST / TIDB_USER / TIDB_PASSWORD หรือ DATABASE_URL ใน .env');
 if(!/^[A-Za-z0-9_]+$/.test(fields.database)||fields.database.length>64)throw failure('DB_CONFIG','ชื่อฐานข้อมูลต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ _');
 const port=Number(fields.port);if(!Number.isInteger(port)||port<1||port>65535)throw failure('DB_CONFIG','TIDB_PORT ไม่ถูกต้อง');
 const ssl={rejectUnauthorized:true,verifyIdentity:true,minVersion:'TLSv1.2'};if(env.TIDB_CA_PATH)ssl.ca=readFileSync(env.TIDB_CA_PATH,'utf8');
 return {...fields,port,ssl,timezone:'Z',dateStrings:true,charset:'utf8mb4',waitForConnections:true,connectionLimit:5,queueLimit:100,connectTimeout:10000,multipleStatements:false};
}
export async function connectDatabase({createDatabase=false}={}){
 const driver=process.env.DB_DRIVER||'tidb';
 if(driver==='tidb'){
  const {createPool}=await import('mysql2/promise');const config=tidbConfig();
  if(createDatabase){const setup=createPool({...config,database:undefined});try{await setup.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);}finally{await setup.end();}}
  const pool=createPool(config);const execute=async(client,sql,args=[])=>{const [result]=await (/^\s*(CREATE|ALTER)/i.test(sql)?client.query(sql,args):client.execute(sql,args));return result;};
  return {driver,name:config.database,query:(sql,args)=>execute(pool,sql,args),async transaction(fn){const c=await pool.getConnection();try{await c.beginTransaction();const result=await fn((s,a)=>execute(c,s,a));await c.commit();return result;}catch(e){await c.rollback().catch(()=>{});throw e;}finally{c.release();}},close:()=>pool.end()};
 }
 if(driver!=='sqlite')throw failure('DB_CONFIG','DB_DRIVER ต้องเป็น tidb หรือ sqlite');
 const {DatabaseSync}=await import('node:sqlite');const file=process.env.SQLITE_PATH||'.data/orders.sqlite';mkdirSync(dirname(file),{recursive:true});const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 const execute=async(sql,args=[])=>{const s=sqlite.prepare(sql);return s.columns().length?s.all(...args):{affectedRows:Number(s.run(...args).changes)};};
 let tail=Promise.resolve();const serial=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
 return {driver,name:file,query:(s,a)=>serial(()=>execute(s,a)),transaction:fn=>serial(async()=>{sqlite.exec('BEGIN IMMEDIATE');try{const result=await fn(execute);sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}),close:async()=>{await tail;sqlite.close();}};
}
export const sqlTime=(value=new Date())=>new Date(value).toISOString().replace('T',' ').replace('Z','');
export const isoTime=value=>value instanceof Date?value.toISOString():String(value).replace(' ','T').replace(/Z$/,'')+'Z';

