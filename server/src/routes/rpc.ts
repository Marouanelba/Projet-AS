import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * POST /api/rpc/find-similar-tableaux
 * Appelle la fonction PostgreSQL find_similar_tableaux
 * Body: { p_tableau_id: number, p_seuil?: number }
 */
router.post('/find-similar-tableaux', async (req: Request, res: Response) => {
  try {
    const { p_tableau_id, p_seuil } = req.body;

    if (!p_tableau_id) {
      res.status(400).json({ error: 'p_tableau_id requis' });
      return;
    }

    const seuil = p_seuil || 0.4;

    const result = await pool.query(
      'SELECT * FROM find_similar_tableaux($1, $2)',
      [p_tableau_id, seuil]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[RPC] Erreur find-similar-tableaux:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/rpc/get-serie-temporelle
 * Appelle la fonction PostgreSQL get_serie_temporelle
 * Body: { p_tableau_id: number }
 */
router.post('/get-serie-temporelle', async (req: Request, res: Response) => {
  try {
    const { p_tableau_id } = req.body;

    if (!p_tableau_id) {
      res.status(400).json({ error: 'p_tableau_id requis' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM get_serie_temporelle($1)',
      [p_tableau_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[RPC] Erreur get-serie-temporelle:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
