# ฐานข้อมูลด็อกเตอร์กริล — TiDB พร้อมเชื่อมกับแอป

เวอร์ชันนี้ใช้ TiDB แบบ MySQL-compatible ผ่าน mysql2 และ TLS พร้อมตรวจใบรับรองและชื่อเซิร์ฟเวอร์ รองรับโฮสต์ Node.js เช่น Render/VPS ไม่ใช้ TiDB PostgreSQL-compatible endpoint และไม่ต้องใช้ serverless HTTP driver รุ่นก่อน

## วิธีแนะนำ: ตั้งค่าครั้งเดียวจากแอป

1. สร้าง TiDB Cloud cluster แบบ MySQL-compatible แล้วเปิดหน้า Connect เลือก Node.js / MySQL เพื่อดู host, port, user และ password
2. ใช้ Node.js 24 LTS เปิด Terminal ในโฟลเดอร์ doctor-grill แล้วรัน:

```powershell
npm ci
Copy-Item .env.example .env
```

3. กรอก `.env` ในเครื่อง (ไม่ต้องส่งรหัสผ่านมาทางแชท):

```dotenv
DB_DRIVER=tidb
TIDB_HOST=ใส่ hostname จากหน้า Connect
TIDB_PORT=4000
TIDB_USER=ใส่ username จากหน้า Connect
TIDB_PASSWORD="ใส่ password จากหน้า Connect"
TIDB_DATABASE=doctor_grill
ADMIN_PASSWORD="ตั้งรหัสหลังร้านอย่างน้อย12ตัวอักษร"
HOST=127.0.0.1
PORT=3001
COOKIE_SECURE=false
```

ใช้ port ตามหน้า Connect ถ้าต่างจาก 4000 ใส่ password ในเครื่องหมายคำพูดเมื่อมี # หรือช่องว่าง หากตั้ง DATABASE_URL อยู่ ระบบจะใช้ค่านั้นแทน TIDB_HOST/USER/PASSWORD จึงควรเลือกตั้งค่าแบบเดียว

4. สร้างตารางและเติมเมนู:

```powershell
npm run db:setup
npm run db:check
npm run build
npm start
```

เปิด http://127.0.0.1:3001/index.html
หลังร้าน http://127.0.0.1:3001/admin-login.html
หากพัฒนาต่อใช้ `npm run dev` แล้วเปิด URL ที่ Vite แสดง

ผล db:check สำหรับฐานข้อมูลใหม่ควรแสดง driver=tidb, schemaVersion=1, menuCount=44, categoryCount=4, ready=true

`db:setup` สร้าง database ถ้ายังไม่มี หากบัญชีมีสิทธิ์เฉพาะ database ที่สร้างไว้แล้ว ให้ตั้ง `DB_CREATE_DATABASE=false` ก่อนรัน ตารางและ seed ยังถูกสร้างตามปกติ

## ทางเลือก: รัน SQL เองใน TiDB

รันไฟล์ `database/doctor_grill_tidb.sql` ใน TiDB SQL Editor หรือ MySQL client ไฟล์นี้รวม CREATE DATABASE, 7 ตาราง, ดัชนี และข้อมูลเริ่มต้นแล้ว จากนั้นตั้ง .env ของแอปให้ชี้ไปที่ doctor_grill แล้วใช้ `npm run db:check` และ `npm start` (build ก่อนครั้งแรก)

หากใช้ชื่อ database อื่น ให้เลือก database นั้นใน SQL Editor แล้วรัน:

1. `database/01-schema.sql`
2. `database/02-seed.sql`
3. `database/03-verify.sql` เพื่อตรวจผล

หลังรัน SQL เอง ไม่จำเป็นต้องรัน db:setup ซ้ำ ทั้งสองวิธีใช้โครงสร้างเดียวกันจาก `server/db/schema.mjs` และชุดเมนูเดียวกันจาก `src/menu.js`

ไฟล์ seed ใช้ INSERT IGNORE เพื่อไม่เขียนทับเมนูที่ร้านแก้แล้ว การรันซ้ำไม่ล้างออเดอร์ ไม่รีเซ็ตราคา และไม่ลบตารางรุ่นก่อน

## ตารางและความสัมพันธ์

| ตาราง | คีย์หลัก | เก็บอะไร / ความสัมพันธ์ |
|---|---|---|
| dg_schema_migrations | version | เวอร์ชัน schema วันที่ติดตั้ง และวันที่ย้ายข้อมูลรุ่นเก่า |
| dg_menu_categories | id | หมวดอาหาร 4 หมวด พร้อมลำดับแสดงผล |
| dg_menu_items | id | เมนู ชื่อ ราคา ราคาพิเศษ รูป หน่วย สถานะเปิดขาย/เก็บเข้าคลัง; category_id → หมวดอาหาร |
| dg_orders | id | หัวใบสั่ง โต๊ะ ชื่อ โทร หมายเหตุ สถานะ ยอดรวม วันสร้าง/แก้ไข; request_key ไม่ซ้ำ |
| dg_order_items | order_id + line_number | อาหารแต่ละบรรทัด จำนวน ขนาด ราคา ณ เวลาสั่ง; order_id → ใบสั่ง, menu_item_id → เมนู |
| dg_order_events | id | ประวัติเปลี่ยนสถานะ จาก/เป็น เวลา และ actor; order_id → ใบสั่ง |
| dg_admin_sessions | token_hash | เซสชันพนักงาน อายุ 8 ชั่วโมง เก็บ hash ของ token และ fingerprint ของรหัสหลังร้าน |

ความสัมพันธ์หลัก: หมวด 1:N เมนู, ใบสั่ง 1:N รายการอาหาร, เมนู 1:N รายการอาหาร, ใบสั่ง 1:N ประวัติสถานะ

### dg_menu_items

- price_baht: ราคาธรรมดาหรือราคาต่อหน่วย เป็นจำนวนเต็มบาท
- special_price_baht: ราคาพิเศษ เฉพาะเมนูราดข้าว; หมวดอื่นเป็น NULL
- is_available: 1=เปิดขาย, 0=หมดชั่วคราว
- is_archived: 1=เก็บเข้าคลัง, 0=แสดงในหน้าร้าน
- image_path: path ไฟล์ WebP บนเว็บ ไม่เก็บไฟล์ภาพใน DB
- เมนูใหม่ใช้ UUID ส่วนเมนูเริ่มต้นใช้ id คงที่ เช่น rice-4-0 เพื่อให้ลิงก์และตะกร้าเข้ากันได้

### dg_orders / dg_order_items

- status: new → cooking → ready → completed; ยกเลิกเป็น cancelled ได้จาก new/cooking
- request_key เป็น unique key สำหรับกันส่งออเดอร์ซ้ำ
- tracking_token เป็น secret สำหรับลูกค้าติดตามใบสั่ง ไม่ส่งออกในรายงานและไม่แสดงใน URL
- ชื่อเมนู ราคา หน่วย และ id ตอนสั่งถูกสำรองใน *_snapshot และ unit_price_baht
- line_total_baht = quantity × unit_price_baht และ total_baht = ผลรวมทุกบรรทัด
- การสร้างหัวใบสั่ง บรรทัดอาหาร และ event แรก อยู่ใน transaction เดียวกัน ถ้าขั้นใดล้มเหลวจะ rollback ทั้งชุด
- การแก้สถานะใช้ compare-and-set และบันทึก event ใน transaction เดียวกัน
- ราคาและจำนวนตรวจจากเซิร์ฟเวอร์ก่อนบันทึก ค่าราคาเป็นจำนวนเต็มบาทตามรายการร้านนี้ (ยังไม่รองรับสตางค์)
- ไม่ลบเมนูที่ถูกอ้างอิง ให้เก็บเข้าคลังแทน menu_item_id อนุญาต NULL สำหรับย้ายประวัติเก่าที่ไม่มีเมนูต้นทางแล้ว แต่ snapshot ยังคงครบ

### วันเวลาและรายงาน

DATETIME(3) ทุกช่องเก็บ UTC แบบ YYYY-MM-DD HH:mm:ss.SSS แอปแสดงเวลาไทย รายงานเปลี่ยนเป็น UTC+7 ก่อนจัดกลุ่มวัน ใช้ created_at เป็นวันที่สั่ง และนับยอดเฉพาะสถานะ completed ไม่ใช่รายงานวันรับชำระเงินจริง

ดัชนีครอบคลุมหมวดเมนู วันสร้างออเดอร์ สถานะ+วันสร้าง เมนูที่อ้างอิง ประวัติใบสั่ง และวันหมดอายุเซสชัน

### เซสชันพนักงาน

หลัง restart เซสชันที่ยังไม่หมดอายุยังใช้ต่อได้ เมื่อเปลี่ยน ADMIN_PASSWORD เซสชันเดิมใช้ไม่ได้เพราะ fingerprint เปลี่ยน ไม่เก็บรหัสผ่านหลังร้านในตาราง ไม่สร้างบัญชีสมาชิกตามขอบเขตที่ตัดออก

## ย้ายจากรุ่น v1/v2

รุ่นเดิมมีตาราง `orders` และ `catalog` ที่เก็บ JSON รุ่นใหม่ใช้ `dg_*` จึงไม่เขียนทับตารางเดิม

ถ้าเชื่อม database เดิมที่มีข้อมูล แอปจะให้ย้ายข้อมูลก่อนเริ่มใช้งาน:

```powershell
npm run db:import-legacy
npm run db:check
```

คำสั่งนี้สร้างตารางใหม่ เติมเมนูเริ่มต้น แล้วคัดลอกการแก้เมนู ออเดอร์เก่า ราคา snapshot, request key และ tracking token ลง schema ใหม่ใน transaction เดียว ตารางเก่ายังคงอยู่ รันซ้ำหลังย้ายสำเร็จแล้วจะไม่ทำซ้ำหรือทับการแก้ไขใหม่

ให้ย้ายก่อนเริ่มรับออเดอร์หรือแก้เมนูใน schema ใหม่ หากมีข้อมูลใหม่อยู่แล้ว ระบบจะหยุดแทนการรวมทับโดยเดาเอง หยุดแอปรุ่นเก่าระหว่างย้ายและเก็บ backup ตามปกติก่อนย้ายข้อมูลจริง

คำสั่งนี้ย้ายตารางรุ่นเก่าภายใน database เดียวกัน ไม่ใช่เครื่องมือย้าย SQLite คนละเครื่องไป TiDB

## ใช้ SQLite สำหรับทดสอบในเครื่อง

```powershell
Copy-Item .env.sqlite.example .env
```

ตั้ง ADMIN_PASSWORD แล้วรัน `npm run dev` schema และเมนูจะถูกสร้างใน SQLite อัตโนมัติ ใช้โครงสร้างเชิงสัมพันธ์เดียวกัน หากเป็นไฟล์รุ่นเก่าที่มีข้อมูลให้รัน db:import-legacy ก่อน

## ขึ้นโฮสต์ Node.js

- Build: `npm ci --include=dev && npm run build`
- ติดตั้ง database ครั้งแรก: `npm run db:setup` (ใช้บัญชีติดตั้งที่มีสิทธิ์ CREATE/INDEX และ DML)
- Start: `npm start`
- ตั้ง DB_DRIVER=tidb, TIDB_* หรือ DATABASE_URL, ADMIN_PASSWORD, HOST=0.0.0.0, COOKIE_SECURE=true เมื่อใช้ HTTPS
- ให้โฮสต์กำหนด PORT และตั้ง Health Check `/api/health`
- ค่า DB_AUTO_SETUP=false เป็นค่าเริ่มต้น แอป production ตรวจ schema แต่ไม่สร้างตารางระหว่างเปิดเซิร์ฟเวอร์
- บัญชี runtime ใช้ SELECT/INSERT/UPDATE/DELETE บนตาราง dg_*; DELETE ใช้ลบเซสชันหมดอายุ บัญชี runtime ไม่จำเป็นต้องมี CREATE database
- หากมี IP allowlist ใน TiDB ให้เพิ่ม outbound IP ของเครื่องที่รัน Node.js และใช้ CA จากหน้า Connect ผ่าน TIDB_CA_PATH หากคลัสเตอร์กำหนด ห้ามปิดการตรวจ TLS
- รูปอาหารยังเสิร์ฟจาก public/images ไม่ต้องอัปโหลดเข้าฐานข้อมูล

## การตรวจสอบที่ทำแล้วและขอบเขต

ผ่าน automated tests กับ relational schema บน SQLite: seed 44 เมนู, setup ซ้ำไม่ทับราคา, foreign key, rollback ไม่ทิ้งหัวใบสั่งค้าง, ส่งซ้ำไม่เกิดออเดอร์ใหม่, ประวัติสถานะ, session หมดอายุ/เปลี่ยนรหัส/หลัง restart, รายงานมากกว่า 200 ออเดอร์, และ migration ข้อมูลเก่า

ตรวจ SQL ที่ส่งมอบว่า generated จาก DDL เดียวกับแอป และทดสอบค่าการเชื่อมต่อ TLS ของ MySQL driver แล้ว แต่ยังไม่ได้รัน SQL หรือเชื่อมต่อกับ TiDB Cloud ของผู้ใช้จริง เพราะยังไม่มี credentials ผล `npm run db:check` บน TiDB ของคุณคือขั้นตรวจยืนยันก่อนเปิดใช้จริง

อ้างอิง: https://docs.pingcap.com/tidb/stable/foreign-key/ และ https://github.com/tidb-samples/tidb-nodejs-mysql2-quickstart
