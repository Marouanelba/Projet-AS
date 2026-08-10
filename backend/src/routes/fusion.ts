import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/fusion
 * Liste toutes les fusions avec pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { id_liaison } = req.query;

    if (id_liaison) {
      const result = await pool.query(
        'SELECT * FROM tableaux_fusion WHERE id_liaison = $1',
        [id_liaison]
      );
      res.json(result.rows[0] || null);
      return;
    }

    const from = parseInt(req.query.from as string) || 0;
    const to = parseInt(req.query.to as string) || 999;
    const limit = to - from + 1;
    const result = await pool.query(
      'SELECT * FROM tableaux_fusion ORDER BY id LIMIT $1 OFFSET $2',
      [limit, from]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[FUSION] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/fusion
 * Créer ou mettre à jour une fusion (upsert sur id_liaison)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id_liaison, strategie, colonne_selectionnee, entetes_fusionnees, donnees_fusionnees } = req.body;

    if (!id_liaison || !strategie || !entetes_fusionnees || !donnees_fusionnees) {
      res.status(400).json({ error: 'id_liaison, strategie, entetes_fusionnees et donnees_fusionnees requis' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tableaux_fusion (id_liaison, strategie, colonne_selectionnee, entetes_fusionnees, donnees_fusionnees)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id_liaison) DO UPDATE SET
         strategie = $2,
         colonne_selectionnee = $3,
         entetes_fusionnees = $4,
         donnees_fusionnees = $5,
         updated_at = NOW()
       RETURNING *`,
      [id_liaison, strategie, colonne_selectionnee || null,
       JSON.stringify(entetes_fusionnees), JSON.stringify(donnees_fusionnees)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    const err = error as { code?: string; column?: string; detail?: string; message?: string };
    console.error('[FUSION] Erreur upsert:', err.code, err.message, err.detail);

    // Erreurs de données : le client peut agir dessus, un 500 muet l'en empêche
    const messages: Record<string, string> = {
      '22001': 'Une valeur dépasse la taille autorisée par la colonne',
      '23503': "id_liaison ne correspond à aucune liaison existante",
      '23502': 'Un champ obligatoire est vide',
      '22P02': 'Format JSON invalide dans entetes_fusionnees ou donnees_fusionnees',
    };
    if (err.code && messages[err.code]) {
      res.status(400).json({ error: messages[err.code], code: err.code, detail: err.detail });
      return;
    }
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * DELETE /api/fusion/:id
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tableaux_fusion WHERE id = $1', [id]);
    res.json({ message: 'Fusion supprimée' });
  } catch (error) {
    console.error('[FUSION] Erreur:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

export default router;
