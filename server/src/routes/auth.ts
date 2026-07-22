import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { AuthRequest, generateToken, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    // Vérifier si l'email existe déjà
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }

    // Hasher le mot de passe
    const password_hash = await bcrypt.hash(password, 12);

    // Insérer l'utilisateur
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, display_name, created_at',
      [email, password_hash]
    );

    const user = result.rows[0];
    const token = generateToken({ id: user.id, email: user.email, display_name: user.display_name });

    res.status(201).json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      token,
    });
  } catch (error) {
    console.error('[AUTH] Erreur register:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur existant
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }

    // Trouver l'utilisateur
    const result = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, display_name: user.display_name });

    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      token,
    });
  } catch (error) {
    console.error('[AUTH] Erreur login:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * GET /api/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('[AUTH] Erreur me:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * PUT /api/auth/profile
 * Mise à jour du nom d'affichage
 */
router.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { display_name } = req.body;

    if (!display_name || !display_name.trim()) {
      res.status(400).json({ error: 'Le nom ne peut pas être vide' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name',
      [display_name.trim(), req.user!.id]
    );

    const user = result.rows[0];
    // Générer un nouveau token avec le display_name mis à jour
    const token = generateToken({ id: user.id, email: user.email, display_name: user.display_name });

    res.json({ user, token });
  } catch (error) {
    console.error('[AUTH] Erreur profile:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * PUT /api/auth/password
 * Changement de mot de passe
 */
router.put('/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
      return;
    }

    if (new_password.length < 6) {
      res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    // Vérifier l'ancien mot de passe
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Ancien mot de passe incorrect' });
      return;
    }

    // Mettre à jour le mot de passe
    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user!.id]
    );

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    console.error('[AUTH] Erreur password:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
