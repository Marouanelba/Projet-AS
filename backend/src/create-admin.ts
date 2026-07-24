import bcrypt from 'bcryptjs';
import pool from './db.js';

async function createAdmin() {
  const email = 'admin@hcp.ma';
  const password = '12345678';
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('L\'utilisateur admin existe déjà.');
      process.exit(0);
    }
    
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)',
      [email, hash, 'Administrateur']
    );
    console.log('Utilisateur admin créé avec succès !');
  } catch (error) {
    console.error('Erreur lors de la création de l\'admin:', error);
  } finally {
    await pool.end();
  }
}

createAdmin();
