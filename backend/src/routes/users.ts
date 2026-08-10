import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

/** Rôles qu'un administrateur peut attribuer depuis l'onglet Utilisateurs. */
const ROLES_ATTRIBUABLES = ['correcteur', 'validateur'] as const;

/** Réserve la gestion des comptes à l'administrateur. */
function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
    return false;
  }
  return true;
}

/**
 * GET /api/users
 * Liste des comptes (admin uniquement). Le hash du mot de passe n'est jamais renvoyé.
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.role, u.points, u.created_at,
              (SELECT count(*) FROM tableaux_corrections tc WHERE tc.user_id = u.id) AS nb_corrections
       FROM users u
       ORDER BY u.role, u.email`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[USERS] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/users
 * Crée un compte correcteur ou validateur (admin uniquement).
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { email, password, display_name, role } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({ error: 'email, password et role sont requis' });
      return;
    }
    if (!ROLES_ATTRIBUABLES.includes(role)) {
      res.status(400).json({
        error: `Rôle invalide. Valeurs acceptées : ${ROLES_ATTRIBUABLES.join(', ')}`,
      });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    const existe = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existe.rows.length > 0) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, points, created_at`,
      [email, hash, display_name || email.split('@')[0], role]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    const err = error as { code?: string; constraint?: string };
    if (err.code === '23505') {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }
    if (err.code === '23514' && err.constraint === 'users_role_check') {
      res.status(400).json({ error: 'Rôle refusé par la base de données' });
      return;
    }
    console.error('[USERS] Erreur création:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * PATCH /api/users/:id
 * Change le rôle ou le mot de passe d'un compte (admin uniquement).
 */
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { role, password, display_name } = req.body;

    if (Number(id) === req.user?.id && role) {
      res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle' });
      return;
    }
    if (role && !ROLES_ATTRIBUABLES.includes(role)) {
      res.status(400).json({
        error: `Rôle invalide. Valeurs acceptées : ${ROLES_ATTRIBUABLES.join(', ')}`,
      });
      return;
    }

    const champs: string[] = [];
    const valeurs: unknown[] = [];
    if (role) { champs.push(`role = $${champs.length + 2}`); valeurs.push(role); }
    if (display_name) { champs.push(`display_name = $${champs.length + 2}`); valeurs.push(display_name); }
    if (password) {
      if (String(password).length < 6) {
        res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        return;
      }
      champs.push(`password_hash = $${champs.length + 2}`);
      valeurs.push(await bcrypt.hash(password, 12));
    }
    if (champs.length === 0) {
      res.status(400).json({ error: 'Aucun champ à mettre à jour' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET ${champs.join(', ')}, updated_at = NOW() WHERE id = $1
       RETURNING id, email, display_name, role, points, created_at`,
      [id, ...valeurs]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[USERS] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/users/:id
 * Supprime un compte (admin uniquement).
 * Deux garde-fous : ne pas se supprimer soi-même, ne pas retirer le dernier admin.
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;

    if (Number(id) === req.user?.id) {
      res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      return;
    }

    const cible = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (cible.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }
    if (cible.rows[0].role === 'admin') {
      const admins = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin'");
      if (admins.rows[0].n <= 1) {
        res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur' });
        return;
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Compte supprimé' });
  } catch (error) {
    console.error('[USERS] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
