import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/tableaux-indices
 * Récupérer les indices par id_tableau (query param) ou tous
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { id_tableau } = req.query;

    if (id_tableau) {
      const result = await pool.query(
        'SELECT * FROM tableaux_indices WHERE id_tableau = $1',
        [id_tableau]
      );
      res.json(result.rows);
      return;
    }

    // Tous les indices (avec pagination optionnelle)
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const result = await pool.query(
      'SELECT * FROM tableaux_indices ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[TABLEAUX-INDICES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/tableaux-indices
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id_tableau, code_indice, signification_fr, signification_ar, rattache_type, rattache_valeurs } = req.body;
    if (!id_tableau || !code_indice) {
      res.status(400).json({ error: 'id_tableau et code_indice requis' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO tableaux_indices (id_tableau, code_indice, signification_fr, signification_ar, rattache_type, rattache_valeurs)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_tableau, code_indice, signification_fr || null, signification_ar || null,
       rattache_type || null, rattache_valeurs ? JSON.stringify(rattache_valeurs) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[TABLEAUX-INDICES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/tableaux-indices/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux_indices WHERE id = $1', [id]);
    res.json({ message: 'Supprimé' });
  } catch (error) {
    console.error('[TABLEAUX-INDICES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
