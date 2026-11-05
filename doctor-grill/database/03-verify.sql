-- Read-only verification after installing schema + seed.
-- Select the database first (doctor_grill by default).
SELECT VERSION() AS server_version;
SELECT version, applied_at, legacy_imported_at FROM dg_schema_migrations;
SELECT c.id,c.name,COUNT(m.id) AS menu_count
FROM dg_menu_categories c LEFT JOIN dg_menu_items m ON m.category_id=c.id
GROUP BY c.id,c.name,c.sort_order ORDER BY c.sort_order;
-- Fresh install: rice=15, side=15, snack=10, extra=4.
SELECT COUNT(*) AS menu_count FROM dg_menu_items;
-- Expected no rows: totals must agree with immutable order lines.
SELECT o.id,o.total_baht,COALESCE(SUM(i.line_total_baht),0) AS lines_total
FROM dg_orders o LEFT JOIN dg_order_items i ON i.order_id=o.id
GROUP BY o.id,o.total_baht HAVING o.total_baht<>COALESCE(SUM(i.line_total_baht),0);
-- Expected no rows: line arithmetic must be consistent.
SELECT order_id,line_number FROM dg_order_items WHERE line_total_baht<>quantity*unit_price_baht;
