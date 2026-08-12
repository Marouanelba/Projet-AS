import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/tableaux
 * Liste des tableaux avec pagination (range query params: from, to)
 * ?include_hidden=true pour inclure les tableaux masqués (admin)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const idThematique = req.query.id_thematique;
    const includeHidden = req.query.include_hidden === 'true';
    const statutFilter = includeHidden ? '' : "AND COALESCE(statut, 'published') = 'published'";

    if (idThematique) {
      const result = await pool.query(
        `SELECT * FROM tableaux WHERE id_thematique = $1 ${statutFilter} ORDER BY id ASC LIMIT $2 OFFSET $3`,
        [idThematique, limit, from]
      );
      return res.json(result.rows);
    }

    const statutFilterWhere = includeHidden ? '' : "WHERE COALESCE(statut, 'published') = 'published'";
    const result = await pool.query(
      `SELECT * FROM tableaux ${statutFilterWhere} ORDER BY id ASC LIMIT $1 OFFSET $2`,
      [limit, from]
    );
    res.json(result.rows);
  } catch (error: any) {
    // Fallback: if 'statut' column doesn't exist yet (migration not run), retry without filter
    if (error?.code === '42703') {
      try {
        const from2 = parseInt(req.query.from as string) || 0;
        const to2 = parseInt(req.query.to as string) || 999;
        const limit2 = to2 - from2 + 1;
        const idThem = req.query.id_thematique;
        if (idThem) {
          const result = await pool.query(
            'SELECT * FROM tableaux WHERE id_thematique = $1 ORDER BY id ASC LIMIT $2 OFFSET $3',
            [idThem, limit2, from2]
          );
          return res.json(result.rows);
        }
        const result = await pool.query(
          'SELECT * FROM tableaux ORDER BY id ASC LIMIT $1 OFFSET $2',
          [limit2, from2]
        );
        res.json(result.rows);
        return;
      } catch (e) { /* fall through */ }
    }
    console.error('[TABLEAUX] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/tableaux/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tableaux WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tableau non trouvé' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[TABLEAUX] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * GET /api/tableaux/:id/statut
 * Endpoint léger pour le polling de statut de publication (auto-refresh front)
 */
router.get('/:id/statut', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT statut FROM tableaux WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ statut: 'not_found' });
      return;
    }
    res.json({ statut: result.rows[0].statut || 'published' });
  } catch (error) {
    // Fallback if column doesn't exist
    res.json({ statut: 'published' });
  }
});

/**
 * POST /api/tableaux
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      code, titre_fr, titre_ar, id_thematique,
      unite_fr, unite_ar, source_fr, source_ar,
      notes_fr, notes_ar, annee_reference, source_feuille,
      ligne_debut, ligne_fin
    } = req.body;

    if (!code || !titre_fr || !id_thematique) {
      res.status(400).json({ error: 'code, titre_fr et id_thematique requis' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tableaux (code, titre_fr, titre_ar, id_thematique, unite_fr, unite_ar, source_fr, source_ar, notes_fr, notes_ar, annee_reference, source_feuille, ligne_debut, ligne_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [code, titre_fr, titre_ar || null, id_thematique, unite_fr || null, unite_ar || null,
       source_fr || null, source_ar || null, notes_fr || null, notes_ar || null,
       annee_reference || null, source_feuille || null, ligne_debut || null, ligne_fin || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[TABLEAUX] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/tableaux/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux WHERE id = $1', [id]);
    res.json({ message: 'Supprimé' });
  } catch (error) {
    console.error('[TABLEAUX] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
