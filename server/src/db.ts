import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/AS',
});

// Test de connexion au démarrage
pool.on('connect', () => {
  console.log('[DB] Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Erreur inattendue sur le pool:', err);
  process.exit(-1);
});

export default pool;
