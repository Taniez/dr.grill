-- TiDB / MySQL-compatible. Select your database before running.
-- UTC timestamps; integer amounts in Thai baht. Does not DROP old tables.
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
