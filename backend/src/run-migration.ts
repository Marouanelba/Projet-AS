import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  try {
    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      console.log(`[MIGRATION] Execution de ${file}...`);
      await pool.query(sql);
      console.log(`[MIGRATION] ${file} executee avec succes !`);
    }
  } catch (error) {
    console.error('[MIGRATION] Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();