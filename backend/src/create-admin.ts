import bcrypt from 'bcryptjs';
import pool from './db.js';

async function createUser() {
  // Récupérer les arguments du CLI ou utiliser les valeurs par défaut pour l'admin
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@hcp.ma';
  const password = args[1] || '12345678';
  const displayName = args[2] || 'Administrateur';
  const role = args[3] || (email === 'admin@hcp.ma' ? 'admin' : 'correcteur');

  if (!email || !password) {
    console.error('Usage: npx tsx src/create-admin.ts <email> <password> [displayName] [role]');
    process.exit(1);
  }
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`L'utilisateur ${email} existe déjà.`);
      process.exit(0);
    }
    
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4)',
      [email, hash, displayName, role]
    );
    console.log(`Utilisateur ${email} (${displayName}) créé avec le rôle ${role} avec succès !`);
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
  } finally {
    await pool.end();
  }
}

createUser();
