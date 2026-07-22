import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/thematiques
 * Liste toutes les thématiques avec possibilité d'inclure le count des tableaux
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { include_count, order } = req.query;
    const orderCol = order === 'code' ? 'code' : 'nom_fr';

    if (include_count === 'true') {
      const result = await pool.query(`
        SELECT t.*, COUNT(tab.id)::int AS tableaux_count
        FROM thematiques t
        LEFT JOIN tableaux tab ON tab.id_thematique = t.id
        GROUP BY t.id
        ORDER BY t.${orderCol}
      `);
      res.json(result.rows);
    } else {
      const result = await pool.query(`SELECT * FROM thematiques ORDER BY ${orderCol}`);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('[THEMATIQUES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/thematiques/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM thematiques WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Thématique non trouvée' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[THEMATIQUES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/thematiques
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { code, nom_fr, nom_ar, id_annuaire, nb_indicateurs, fichier_source } = req.body;
    if (!code || !nom_fr || !id_annuaire) {
      res.status(400).json({ error: 'code, nom_fr et id_annuaire requis' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO thematiques (code, nom_fr, nom_ar, id_annuaire, nb_indicateurs, fichier_source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, nom_fr, nom_ar || null, id_annuaire, nb_indicateurs || null, fichier_source || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[THEMATIQUES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/thematiques/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM thematiques WHERE id = $1', [id]);
    res.json({ message: 'Supprimé' });
  } catch (error) {
    console.error('[THEMATIQUES] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
