import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/tableaux-data
 * Récupérer les données par id_tableau (query param) ou toutes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { id_tableau, ids } = req.query;

    if (id_tableau) {
      const result = await pool.query(
        'SELECT * FROM tableaux_data WHERE id_tableau = $1',
        [id_tableau]
      );
      // Retourner un seul objet (comme maybeSingle de Supabase)
      res.json(result.rows[0] || null);
      return;
    }

    if (ids) {
      // Permettre de récupérer plusieurs tableaux_data par liste d'ids de tableaux
      const idList = (ids as string).split(',').map(Number);
      const result = await pool.query(
        'SELECT * FROM tableaux_data WHERE id_tableau = ANY($1)',
        [idList]
      );
      res.json(result.rows);
      return;
    }

    // Pagination par défaut
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const result = await pool.query(
      'SELECT * FROM tableaux_data ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[TABLEAUX-DATA] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/tableaux-data
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id_tableau, entetes, donnees } = req.body;
    if (!id_tableau || !entetes || !donnees) {
      res.status(400).json({ error: 'id_tableau, entetes et donnees requis' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2, donnees = $3, updated_at = NOW()
       RETURNING *`,
      [id_tableau, JSON.stringify(entetes), JSON.stringify(donnees)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[TABLEAUX-DATA] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/tableaux-data/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux_data WHERE id = $1', [id]);
    res.json({ message: 'Supprimé' });
  } catch (error) {
    console.error('[TABLEAUX-DATA] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
