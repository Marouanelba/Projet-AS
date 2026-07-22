import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    console.log('[DB-INIT] Exécution de la migration 001_init.sql...');
    await pool.query(sql);
    console.log('[DB-INIT] Migration exécutée avec succès !');
    console.log('[DB-INIT] Tables, vues et fonctions créées.');
  } catch (error) {
    console.error('[DB-INIT] Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
