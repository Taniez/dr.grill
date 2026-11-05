# ด็อกเตอร์กริล v3 — แอปหลายหน้า + ฐานข้อมูล TiDB

รุ่นนี้พร้อมติดตั้ง schema แบบ relational และเชื่อม TiDB ผ่าน mysql2/TLS หน้าร้านและหลังร้านเดิมครบ พร้อมโลโก้ รูปอาหาร และ 44 เมนูเริ่มต้นตามราคาเดิม

## เริ่มกับ TiDB

ใช้ Node.js 24 LTS เปิด Terminal ในโฟลเดอร์ doctor-grill:

```powershell
npm ci
Copy-Item .env.example .env
```

กรอก TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE และ ADMIN_PASSWORD ใน .env จากนั้น:

```powershell
npm run db:setup
npm run db:check
npm run build
npm start
```

เปิด http://127.0.0.1:3001/index.html
หลังร้าน http://127.0.0.1:3001/admin-login.html

**คู่มือตาราง SQL การตั้งค่าและย้ายข้อมูล:** [database/README.md](database/README.md)

**SQL รวมพร้อมนำไปรันใน TiDB:** [database/doctor_grill_tidb.sql](database/doctor_grill_tidb.sql)

เลือกติดตั้งด้วย db:setup หรือรัน SQL รวมเองได้ ไม่ต้องทำทั้งสองวิธี หลังติดตั้งให้ใช้ db:check ตรวจ schema และเชื่อมต่อจริงก่อนเปิดร้าน

ยังไม่ได้เชื่อมกับบัญชี TiDB ของผู้ใช้จริง เพราะยังไม่มี credentials ต้องกรอกค่าและตรวจในเครื่องของคุณก่อน รหัสผ่านอยู่ฝั่ง server เท่านั้น ห้ามใส่ในตัวแปร VITE_* หรืออัปโหลด .env

## ทดลองในเครื่องด้วย SQLite

```powershell
Copy-Item .env.sqlite.example .env
```

ตั้ง ADMIN_PASSWORD อย่างน้อย 12 ตัวอักษร แล้ว `npm run dev` เปิด URL ที่ Vite แสดง (ปกติ http://127.0.0.1:5173) SQLite จะใช้ relational schema เดียวกันและติดตั้งให้อัตโนมัติ เก็บข้อมูลใน .data/orders.sqlite

หากใช้ไฟล์ SQLite หรือ TiDB ของรุ่นเก่า ให้รัน `npm run db:import-legacy` ก่อนเริ่มรุ่นใหม่ คำสั่งนี้ย้ายตารางเก่าภายใน database เดียวกัน ไม่ได้ย้าย SQLite ต่างเครื่องไป TiDB

## หน้าที่มี

| หน้า | URL |
|---|---|
| หน้าแรก | /index.html |
| เมนู ค้นหา และเพิ่มตะกร้า | /menu.html |
| รายละเอียดเมนู | /product.html?id=rice-4-0 |
| จัดจานและของเพิ่ม | /cooking.html |
| ตะกร้าและยืนยันใบสั่ง | /checkout.html |
| ติดตามคิวและพิมพ์ใบสั่ง | /queue.html |
| ติดต่อร้าน / ข้าวกล่อง | /location.html |
| ระบุโต๊ะ / สร้าง QR | /qr.html |
| ล็อกอินพนักงาน | /admin-login.html |
| ภาพรวมร้าน | /dashboard.html |
| จัดการออเดอร์ | /orders.html |
| หน้าครัว | /kitchen.html |
| เพิ่ม/แก้เมนู เปิด–ปิดขาย เก็บเข้าคลัง | /manage-menu.html |
| ยอดขายรายวัน/รายเมนู และ CSV | /sales.html |

รวม 14 หน้าหลัก + login.html ที่เป็น URL เข้าสู่ระบบพนักงานอีกทาง ลิงก์เก่า /?view=kitchen ยังใช้ได้

ตัด random, wheel, member, customer (สมาชิกเดิม), register, community, reviews และ AI ออกแล้ว ไม่มีลิงก์พาไปหน้าเหล่านี้

## สิ่งที่เปลี่ยนใน v3

- แยกข้อมูลเป็น 7 ตาราง dg_* พร้อม primary key, unique request key, foreign keys และดัชนีค้นหา
- เมนูในฐานข้อมูลแก้ผ่านหลังร้านได้ ราคาเก่าในใบสั่งไม่เปลี่ยนตามเมนูใหม่
- ออเดอร์ รายการอาหาร และประวัติสถานะบันทึกด้วย transaction
- รายงานคำนวณจาก SQL aggregate ตามช่วงวันที่ ไม่มีการจำกัดเฉพาะ 200 ออเดอร์ล่าสุด
- เซสชันพนักงานเก็บ token hash ใน database ใช้ต่อหลัง restart ได้จนหมดอายุ 8 ชั่วโมง เปลี่ยน ADMIN_PASSWORD แล้วเซสชันเก่าใช้ไม่ได้
- db:setup ติดตั้ง schema+seed แบบรันซ้ำได้, db:check ตรวจความพร้อม, db:import-legacy ย้ายรุ่นเก่าโดยเก็บตารางต้นทางไว้
- ไม่สร้างหรือแก้ schema ตอน production start โดยอัตโนมัติ (DB_AUTO_SETUP=false)

## โฮสต์ production

- Runtime: Node.js 24
- Build: `npm ci --include=dev && npm run build`
- ติดตั้งฐานข้อมูลครั้งแรก: `npm run db:setup`
- Start: `npm start`
- ตั้ง DB_DRIVER=tidb, TIDB_* หรือ DATABASE_URL, ADMIN_PASSWORD, HOST=0.0.0.0 และ COOKIE_SECURE=true เมื่อใช้ HTTPS
- ให้โฮสต์กำหนด PORT; Health Check /api/health
- ใช้ URL ออนไลน์ของร้านสร้าง QR เมื่อต้องการให้มือถือเครื่องอื่นเปิดได้

การรับชำระเงินยังเป็นที่ร้าน ไม่มี payment gateway หรือบัญชีเต็มรูปแบบ ยอดขายเป็นมูลค่าออเดอร์สถานะ completed ตามวันที่สั่งในเวลาไทย ออเดอร์ของลูกค้าเก็บบน server ส่วน token สำหรับติดตามคิวอยู่ในเบราว์เซอร์ที่สั่ง

## โครงสร้างไฟล์

- database/: SQL รวม, SQL แยก schema/seed/verify, คู่มือฐานข้อมูล
- server/db/: การเชื่อมต่อ schema seed readiness และ migration
- server/store.mjs: query relational tables และ transactions
- server/index.mjs: API, authentication และ production server
- scripts/db.mjs: คำสั่งติดตั้ง/ตรวจ/ย้ายฐานข้อมูล
- scripts/generate-sql.mjs: สร้าง SQL จาก schema และ seed เดียวกับแอป
- src/: หน้าลูกค้า/หลังร้าน ตะกร้า และธีม
- public/images/: โลโก้และภาพอาหาร WebP
- tests/: ทดสอบฐานข้อมูล API ราคา และ migration

## ตรวจงาน

ใช้ `npm test` และ `npm run build` การทดสอบเชิงพฤติกรรมทำบน SQLite schema เดียวกัน ส่วน SQL สำหรับ TiDB generated จาก definition เดียวกัน และตรวจ configuration ของ mysql2/TLS แล้ว การยืนยันกับ TiDB จริงต้องรัน db:check ด้วย credentials ของคุณ

ไม่รวม .env, ฐานข้อมูลจริง/ทดสอบ หรือ node_modules ใน ZIP รูปโลโก้คงต้นฉบับซึ่งมีเบอร์ 0811383725 ส่วนเบอร์ติดต่อบนเว็บใช้ 0638462546 / 0615988666 ตามข้อมูลที่ระบุ
