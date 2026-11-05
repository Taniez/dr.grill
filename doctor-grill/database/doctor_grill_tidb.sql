-- Run in TiDB SQL Editor or MySQL client. Creates a NEW database if absent.
-- Existing tables/catalog from older releases are left untouched.
CREATE DATABASE IF NOT EXISTS doctor_grill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE doctor_grill;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS dg_schema_migrations (
 version INT NOT NULL PRIMARY KEY,
 applied_at DATETIME(3) NOT NULL,
 legacy_imported_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_menu_categories (
 id VARCHAR(20) NOT NULL PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 sort_order INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_menu_items (
 id VARCHAR(50) NOT NULL PRIMARY KEY,
 category_id VARCHAR(20) NOT NULL,
 name VARCHAR(120) NOT NULL,
 price_baht INT NOT NULL,
 special_price_baht INT NULL,
 unit VARCHAR(10) NOT NULL,
 meat VARCHAR(30) NULL,
 image_path VARCHAR(255) NULL,
 is_available INT NOT NULL DEFAULT 1,
 is_archived INT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 CONSTRAINT fk_dg_menu_category FOREIGN KEY (category_id) REFERENCES dg_menu_categories(id),
 KEY idx_dg_menu_category (category_id,is_archived,is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_orders (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 request_key VARCHAR(36) NOT NULL UNIQUE,
 tracking_token VARCHAR(64) NOT NULL,
 table_number VARCHAR(20) NOT NULL,
 customer_name VARCHAR(80) NOT NULL,
 customer_phone VARCHAR(10) NOT NULL,
 note VARCHAR(500) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'new',
 total_baht INT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 KEY idx_dg_orders_created (created_at,id),
 KEY idx_dg_orders_status_created (status,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_order_items (
 order_id VARCHAR(36) NOT NULL,
 line_number INT NOT NULL,
 menu_item_id VARCHAR(50) NULL,
 menu_id_snapshot VARCHAR(50) NOT NULL,
 name_snapshot VARCHAR(120) NOT NULL,
 unit_snapshot VARCHAR(10) NOT NULL,
 portion VARCHAR(10) NOT NULL,
 quantity INT NOT NULL,
 unit_price_baht INT NOT NULL,
 line_total_baht INT NOT NULL,
 PRIMARY KEY (order_id,line_number),
 CONSTRAINT fk_dg_item_order FOREIGN KEY (order_id) REFERENCES dg_orders(id),
 CONSTRAINT fk_dg_item_menu FOREIGN KEY (menu_item_id) REFERENCES dg_menu_items(id),
 KEY idx_dg_order_menu (menu_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_order_events (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 order_id VARCHAR(36) NOT NULL,
 from_status VARCHAR(20) NULL,
 to_status VARCHAR(20) NOT NULL,
 actor VARCHAR(20) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 CONSTRAINT fk_dg_event_order FOREIGN KEY (order_id) REFERENCES dg_orders(id),
 KEY idx_dg_events_order (order_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dg_admin_sessions (
 token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
 credential_fingerprint VARCHAR(64) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 KEY idx_dg_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;
INSERT IGNORE INTO dg_menu_categories (id,name,sort_order) VALUES
('rice','เมนูราดข้าว',0),
('side','เมนูกับข้าว',1),
('snack','ของทานเล่น',2),
('extra','เมนูเพิ่มเติม',3);

INSERT IGNORE INTO dg_menu_items (id,category_id,name,price_baht,special_price_baht,unit,meat,image_path,is_available,is_archived,created_at,updated_at) VALUES
('rice-0-0','rice','คอหมูย่างราดข้าว น้ำจิ้มแจ่ว',60,70,'จาน','คอหมู',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-0-1','rice','ยำคอหมูย่างราดข้าว',60,70,'จาน','คอหมู',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-0-2','rice','น้ำตกคอหมูย่างราดข้าว',60,70,'จาน','คอหมู',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-0-0','side','คอหมูย่างราดน้ำจิ้มแจ่ว',100,NULL,'ที่','คอหมู',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-0-1','side','ยำคอหมูย่าง',100,NULL,'ที่','คอหมู','/images/pork-neck-salad.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-0-2','side','น้ำตกคอหมูย่าง',100,NULL,'ที่','คอหมู','/images/pork-neck-waterfall.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-1-0','rice','สามชั้นย่างน้ำจิ้มแจ่วราดข้าว',60,70,'จาน','สามชั้น',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-1-1','rice','ยำสามชั้นย่างราดข้าว',60,70,'จาน','สามชั้น',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-1-2','rice','น้ำตกสามชั้นย่างราดข้าว',60,70,'จาน','สามชั้น',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-1-0','side','สามชั้นย่างราดน้ำจิ้มแจ่ว',100,NULL,'ที่','สามชั้น','/images/belly-grilled.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-1-1','side','ยำสามชั้นย่าง',100,NULL,'ที่','สามชั้น','/images/belly-salad.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-1-2','side','น้ำตกสามชั้นย่าง',100,NULL,'ที่','สามชั้น','/images/belly-waterfall.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-2-0','rice','สันคอย่างน้ำจิ้มแจ่วราดข้าว',60,70,'จาน','สันคอ',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-2-1','rice','ยำสันคอย่างราดข้าว',60,70,'จาน','สันคอ',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-2-2','rice','น้ำตกสันคอย่างราดข้าว',60,70,'จาน','สันคอ',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-2-0','side','สันคอย่างราดน้ำจิ้มแจ่ว',100,NULL,'ที่','สันคอ','/images/pork-collar-grilled.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-2-1','side','ยำสันคอย่าง',100,NULL,'ที่','สันคอ',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-2-2','side','น้ำตกสันคอย่าง',100,NULL,'ที่','สันคอ',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-3-0','rice','ไก่ย่างน้ำจิ้มแจ่วราดข้าว',60,70,'จาน','ไก่',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-3-1','rice','ยำไก่ย่างราดข้าว',60,70,'จาน','ไก่',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-3-2','rice','น้ำตกไก่ย่างราดข้าว',60,70,'จาน','ไก่',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-3-0','side','ไก่ย่างราดน้ำจิ้มแจ่ว',100,NULL,'ที่','ไก่','/images/chicken-grilled.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-3-1','side','ยำไก่ย่าง',100,NULL,'ที่','ไก่',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-3-2','side','น้ำตกไก่ย่าง',100,NULL,'ที่','ไก่',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-4-0','rice','โคขุนย่างน้ำจิ้มแจ่วราดข้าว',70,80,'จาน','โคขุน','/images/beef-grilled-rice.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-4-1','rice','ยำโคขุนย่างราดข้าว',70,80,'จาน','โคขุน','/images/beef-salad-rice.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('rice-4-2','rice','น้ำตกโคขุนย่างราดข้าว',70,80,'จาน','โคขุน','/images/beef-waterfall-rice.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-4-0','side','โคขุนย่างราดน้ำจิ้มแจ่ว',120,NULL,'ที่','โคขุน',NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-4-1','side','ยำโคขุนย่าง',120,NULL,'ที่','โคขุน','/images/beef-salad.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('side-4-2','side','น้ำตกโคขุนย่าง',120,NULL,'ที่','โคขุน','/images/beef-waterfall.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('extra-0','extra','ไข่เจียว',10,NULL,'ที่',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('extra-1','extra','ไข่ดาว',10,NULL,'ที่',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('extra-2','extra','เพิ่มกับข้าว',15,NULL,'ที่',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('extra-3','extra','เพิ่มข้าว',10,NULL,'ที่',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-0','snack','ลูกชิ้นหมู',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-1','snack','ลูกชิ้นไก่',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-2','snack','ลูกชิ้นกุ้ง',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-3','snack','ลูกชิ้นปลา',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-4','snack','ลูกชิ้นปลาหมึก',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-5','snack','ปูอัด',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-6','snack','เต้าหู้หมู',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-7','snack','ฮอทดอกแดง',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-8','snack','ฮอทดอกหนังกรอบ',10,NULL,'ไม้',NULL,NULL,1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000'),
('snack-9','snack','เนื้อโคขุน',20,NULL,'ไม้',NULL,'/images/beef-skewers.webp',1,0,'2026-11-05 00:00:00.000','2026-11-05 00:00:00.000');

INSERT IGNORE INTO dg_schema_migrations (version,applied_at) VALUES (1,UTC_TIMESTAMP(3));
COMMIT;
