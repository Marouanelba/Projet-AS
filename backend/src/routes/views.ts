import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/views/series-temporelles
 * Retourne la vue v_series_temporelles avec pagination
 */
router.get('/series-temporelles', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;

    const result = await pool.query(
      'SELECT * FROM v_series_temporelles ORDER BY liaison_id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[VIEWS] Erreur series-temporelles:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/views/tableaux-complets
 * Retourne la vue v_tableaux_complets avec pagination
 * Supporte: select (colonnes), order, from/to
 * ?include_hidden=true pour inclure les tableaux masqués (admin)
 */
router.get('/tableaux-complets', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const includeHidden = req.query.include_hidden === 'true';

    // Colonnes à sélectionner (par défaut toutes)
    const select = req.query.select as string;
    const columns = select || '*';

    // Ordre
    const orderBy = req.query.order_by as string || 'id';
    const orderDir = (req.query.order_dir as string || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Filtre statut: exclure les tableaux masqués sauf demande explicite
    const statutFilter = includeHidden ? '' : "WHERE COALESCE(statut, 'published') = 'published'";

    const result = await pool.query(
      `SELECT ${columns} FROM v_tableaux_complets ${statutFilter} ORDER BY ${orderBy} ${orderDir} LIMIT $1 OFFSET $2`,
      [limit, from]
    );
    res.json(result.rows);
  } catch (error: any) {
    // Fallback if statut column not in the view
    if (error?.code === '42703') {
      try {
        const from2 = parseInt(req.query.from as string) || 0;
        const to2 = parseInt(req.query.to as string) || 999;
        const limit2 = to2 - from2 + 1;
        const select2 = req.query.select as string;
        const columns2 = select2 || '*';
        const orderBy2 = req.query.order_by as string || 'id';
        const orderDir2 = (req.query.order_dir as string || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const result = await pool.query(
          `SELECT ${columns2} FROM v_tableaux_complets ORDER BY ${orderBy2} ${orderDir2} LIMIT $1 OFFSET $2`,
          [limit2, from2]
        );
        res.json(result.rows);
        return;
      } catch (e) { /* fall through */ }
    }
    console.error('[VIEWS] Erreur tableaux-complets:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/views/tableaux-sans-liaison
 * Retourne la vue v_tableaux_sans_liaison avec pagination
 */
router.get('/tableaux-sans-liaison', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;

    const result = await pool.query(
      'SELECT * FROM v_tableaux_sans_liaison ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[VIEWS] Erreur tableaux-sans-liaison:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
