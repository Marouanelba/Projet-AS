import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, 'migrations', '003_add_roles_and_points.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    console.log('[MIGRATION] Exécution de la migration 003...');
    await pool.query(sql);
    console.log('[MIGRATION] Migration 003 exécutée avec succès !');
  } catch (error) {
    console.error('[MIGRATION] Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
