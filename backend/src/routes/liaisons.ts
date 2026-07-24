import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/liaisons
 * Liste toutes les liaisons avec pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const result = await pool.query(
      'SELECT * FROM tableaux_liaisons ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[LIAISONS] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/liaisons/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tableaux_liaisons WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Liaison non trouvée' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[LIAISONS] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/liaisons
 * Créer une nouvelle liaison (authentifié)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id_tableau_source, id_tableau_cible, type_liaison, confiance, methode_liaison, notes } = req.body;

    if (!id_tableau_source || !id_tableau_cible || !type_liaison) {
      res.status(400).json({ error: 'id_tableau_source, id_tableau_cible et type_liaison requis' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tableaux_liaisons (id_tableau_source, id_tableau_cible, type_liaison, confiance, methode_liaison, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id_tableau_source, id_tableau_cible, type_liaison,
       confiance || null, methode_liaison || null, notes || null,
       req.user!.email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[LIAISONS] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * PUT /api/liaisons/:id
 * Mettre à jour une liaison
 */
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type_liaison, confiance, methode_liaison, notes } = req.body;

    const result = await pool.query(
      `UPDATE tableaux_liaisons 
       SET type_liaison = COALESCE($1, type_liaison),
           confiance = COALESCE($2, confiance),
           methode_liaison = COALESCE($3, methode_liaison),
           notes = COALESCE($4, notes)
       WHERE id = $5 RETURNING *`,
      [type_liaison, confiance, methode_liaison, notes, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Liaison non trouvée' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[LIAISONS] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/liaisons/:id
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux_liaisons WHERE id = $1', [id]);
    res.json({ message: 'Liaison supprimée' });
  } catch (error) {
    console.error('[LIAISONS] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
