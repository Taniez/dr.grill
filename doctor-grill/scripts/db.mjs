import {connectDatabase} from '../server/db/connection.mjs';
import {setupDatabase,checkDatabase} from '../server/db/bootstrap.mjs';
import {importLegacy} from '../server/db/legacy.mjs';
const action=process.argv[2]||'check';let db;
try{
 if(!['setup','check','import-legacy'].includes(action))throw Error('Unknown database command');
 db=await connectDatabase({createDatabase:action==='setup'&&process.env.DB_CREATE_DATABASE!=='false'});
 if(action==='setup')await setupDatabase(db);
 if(action==='import-legacy'){await setupDatabase(db);console.log(JSON.stringify(await importLegacy(db)));}
 const result=await checkDatabase(db);console.log(JSON.stringify({...result,ready:true},null,2));
 if(action==='setup')console.log('พร้อมใช้งาน: npm run build แล้ว npm start');
}catch(e){console.error('Database command failed:',e.code||e.name,e.safeMessage||'ตรวจค่าเชื่อมต่อ, สิทธิ์บัญชี, IP allowlist และ TLS ของ TiDB');process.exitCode=1;}finally{await db?.close();}
