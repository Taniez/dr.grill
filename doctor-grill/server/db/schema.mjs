export const schemaVersion=1;
export function schemaStatements(driver='tidb'){
 const time=driver==='tidb'?'DATETIME(3)':'TEXT',engine=driver==='tidb'?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':'';
 const table=(name,body)=>{const keys=driver==='tidb'?indexes.filter(x=>x[0]===name).map(x=>`KEY ${x[1]} (${x[2]})`):[];return `CREATE TABLE IF NOT EXISTS ${name} (\n${body}${keys.length?',\n '+keys.join(',\n '):''}\n)${engine}`;};
 return [
 table('dg_schema_migrations',` version INT NOT NULL PRIMARY KEY,\n applied_at ${time} NOT NULL,\n legacy_imported_at ${time} NULL`),
 table('dg_menu_categories',` id VARCHAR(20) NOT NULL PRIMARY KEY,\n name VARCHAR(80) NOT NULL,\n sort_order INT NOT NULL`),
 table('dg_menu_items',` id VARCHAR(50) NOT NULL PRIMARY KEY,\n category_id VARCHAR(20) NOT NULL,\n name VARCHAR(120) NOT NULL,\n price_baht INT NOT NULL,\n special_price_baht INT NULL,\n unit VARCHAR(10) NOT NULL,\n meat VARCHAR(30) NULL,\n image_path VARCHAR(255) NULL,\n is_available INT NOT NULL DEFAULT 1,\n is_archived INT NOT NULL DEFAULT 0,\n created_at ${time} NOT NULL,\n updated_at ${time} NOT NULL,\n CONSTRAINT fk_dg_menu_category FOREIGN KEY (category_id) REFERENCES dg_menu_categories(id)`),
 table('dg_orders',` id VARCHAR(36) NOT NULL PRIMARY KEY,\n request_key VARCHAR(36) NOT NULL UNIQUE,\n tracking_token VARCHAR(64) NOT NULL,\n table_number VARCHAR(20) NOT NULL,\n customer_name VARCHAR(80) NOT NULL,\n customer_phone VARCHAR(10) NOT NULL,\n note VARCHAR(500) NOT NULL,\n status VARCHAR(20) NOT NULL DEFAULT 'new',\n total_baht INT NOT NULL,\n created_at ${time} NOT NULL,\n updated_at ${time} NOT NULL`),
 table('dg_order_items',` order_id VARCHAR(36) NOT NULL,\n line_number INT NOT NULL,\n menu_item_id VARCHAR(50) NULL,\n menu_id_snapshot VARCHAR(50) NOT NULL,\n name_snapshot VARCHAR(120) NOT NULL,\n unit_snapshot VARCHAR(10) NOT NULL,\n portion VARCHAR(10) NOT NULL,\n quantity INT NOT NULL,\n unit_price_baht INT NOT NULL,\n line_total_baht INT NOT NULL,\n PRIMARY KEY (order_id,line_number),\n CONSTRAINT fk_dg_item_order FOREIGN KEY (order_id) REFERENCES dg_orders(id),\n CONSTRAINT fk_dg_item_menu FOREIGN KEY (menu_item_id) REFERENCES dg_menu_items(id)`),
 table('dg_order_events',` id VARCHAR(36) NOT NULL PRIMARY KEY,\n order_id VARCHAR(36) NOT NULL,\n from_status VARCHAR(20) NULL,\n to_status VARCHAR(20) NOT NULL,\n actor VARCHAR(20) NOT NULL,\n created_at ${time} NOT NULL,\n CONSTRAINT fk_dg_event_order FOREIGN KEY (order_id) REFERENCES dg_orders(id)`),
 table('dg_admin_sessions',` token_hash VARCHAR(64) NOT NULL PRIMARY KEY,\n credential_fingerprint VARCHAR(64) NOT NULL,\n created_at ${time} NOT NULL,\n expires_at ${time} NOT NULL`)
 ];
}
export const indexes=[
 ['dg_menu_items','idx_dg_menu_category','category_id,is_archived,is_available'],
 ['dg_orders','idx_dg_orders_created','created_at,id'],
 ['dg_orders','idx_dg_orders_status_created','status,created_at,id'],
 ['dg_order_items','idx_dg_order_menu','menu_item_id'],
 ['dg_order_events','idx_dg_events_order','order_id,created_at'],
 ['dg_admin_sessions','idx_dg_sessions_expiry','expires_at']
];
