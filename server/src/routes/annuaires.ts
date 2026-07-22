import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/annuaires
 * Liste tous les annuaires, triés par année décroissante
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { order } = req.query;
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';
    const result = await pool.query(`SELECT * FROM annuaires ORDER BY annee ${orderDir}`);
    res.json(result.rows);
  } catch (error) {
    console.error('[ANNUAIRES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/annuaires/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM annuaires WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Annuaire non trouvé' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[ANNUAIRES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/annuaires
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { annee, titre_fr, titre_ar } = req.body;
    if (!annee) {
      res.status(400).json({ error: 'Année requise' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO annuaires (annee, titre_fr, titre_ar) VALUES ($1, $2, $3) RETURNING *',
      [annee, titre_fr || null, titre_ar || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[ANNUAIRES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/annuaires/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM annuaires WHERE id = $1', [id]);
    res.json({ message: 'Supprimé' });
  } catch (error) {
    console.error('[ANNUAIRES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
