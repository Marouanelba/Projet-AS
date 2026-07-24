import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/AS',
});

// Test de connexion au démarrage (une seule fois)
pool.query('SELECT 1').then(() => {
  console.log('[DB] Connecté à PostgreSQL');
}).catch((err) => {
  console.error('[DB] Erreur de connexion initiale à PostgreSQL:', err.message);
});

pool.on('error', (err) => {
  console.error('[DB] Erreur inattendue sur le pool:', err);
});

export default pool;
