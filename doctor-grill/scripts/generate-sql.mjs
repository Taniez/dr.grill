import {writeFile,mkdir} from 'node:fs/promises';
import {schemaStatements,schemaVersion} from '../server/db/schema.mjs';
import {menuValues,menuColumns} from '../server/db/bootstrap.mjs';
import {menu,categories} from '../src/menu.js';
// Quotes for generated, trusted seed data. Runtime queries use bound parameters.
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll('\\','\\\\').replaceAll("'","''")+"'";
const stamp='2026-11-05 00:00:00.000';
const ddl=schemaStatements('tidb').join(';\n\n')+';\n';
const categoryRows=Object.entries(categories).map(([id,name],i)=>`(${[id,name,i].map(quote).join(',')})`).join(',\n');
const seed=`START TRANSACTION;\nINSERT IGNORE INTO dg_menu_categories (id,name,sort_order) VALUES\n${categoryRows};\n\nINSERT IGNORE INTO dg_menu_items (${menuColumns}) VALUES\n${menu.map(m=>'('+menuValues(m,stamp).map(quote).join(',')+')').join(',\n')};\n\nINSERT IGNORE INTO dg_schema_migrations (version,applied_at) VALUES (${schemaVersion},UTC_TIMESTAMP(3));\nCOMMIT;\n`;
await mkdir('database',{recursive:true});
await writeFile('database/01-schema.sql','-- TiDB / MySQL-compatible. Select your database before running.\n-- UTC timestamps; integer amounts in Thai baht. Does not DROP old tables.\n'+ddl);
await writeFile('database/02-seed.sql','-- Four categories and 44 dishes. Re-running does not overwrite menu edits.\n'+seed);
await writeFile('database/doctor_grill_tidb.sql',"-- Run in TiDB SQL Editor or MySQL client. Creates a NEW database if absent.\n-- Existing tables/catalog from older releases are left untouched.\nCREATE DATABASE IF NOT EXISTS doctor_grill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE doctor_grill;\nSET NAMES utf8mb4;\n\n"+ddl+'\n'+seed);
console.log('Generated TiDB SQL: 7 tables, 6 indexes, 4 categories, 44 menu items.');
