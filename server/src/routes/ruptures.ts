import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/ruptures
 * Liste toutes les ruptures avec pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { id_tableau } = req.query;

    if (id_tableau) {
      const result = await pool.query(
        'SELECT * FROM tableaux_ruptures WHERE id_tableau = $1',
        [id_tableau]
      );
      res.json(result.rows);
      return;
    }

    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const result = await pool.query(
      'SELECT * FROM tableaux_ruptures ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[RUPTURES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/ruptures
 * Créer une nouvelle rupture (authentifié)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id_tableau, annee_rupture, direction, notes } = req.body;

    if (!id_tableau || !annee_rupture || !direction) {
      res.status(400).json({ error: 'id_tableau, annee_rupture et direction requis' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tableaux_ruptures (id_tableau, annee_rupture, direction, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id_tableau, annee_rupture, direction, notes || null, req.user!.email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[RUPTURES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/ruptures/:id
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux_ruptures WHERE id = $1', [id]);
    res.json({ message: 'Rupture supprimée' });
  } catch (error) {
    console.error('[RUPTURES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
