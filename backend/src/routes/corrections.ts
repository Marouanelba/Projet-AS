import { Router, Request, Response } from 'express';
import pool from '../db.js';
import https from 'https';
import http from 'http';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Fonction d'aide pour appliquer les corrections "pending" sur un tableau retourné
function applyPendingCorrections(tableau: any, pendingCorrections: any[]) {
  if (!tableau || pendingCorrections.length === 0) return;

  let donnees = tableau.donnees;
  if (typeof donnees === 'string') {
    try { donnees = JSON.parse(donnees); } catch (e) { donnees = []; }
  }
  if (!Array.isArray(donnees)) donnees = [];

  let entetes = tableau.entetes;
  if (typeof entetes === 'string') {
    try { entetes = JSON.parse(entetes); } catch (e) { entetes = []; }
  }
  if (!Array.isArray(entetes)) entetes = [];

  for (const corr of pendingCorrections) {
    const val = corr.valeur_corrigee;
    if (corr.type_element === 'cellule' && corr.row_index !== null && corr.col_index !== null) {
      if (donnees[corr.row_index]) {
        donnees[corr.row_index][corr.col_index] = val;
      }
    } else if (corr.type_element === 'entete' && corr.row_index !== null && corr.col_index !== null) {
      if (entetes[corr.row_index]) {
        entetes[corr.row_index][corr.col_index] = val;
      }
    } else if (corr.type_element === 'titre_fr') {
      tableau.titre_fr = val;
    } else if (corr.type_element === 'titre_ar') {
      tableau.titre_ar = val;
    } else if (corr.type_element === 'unite_fr') {
      tableau.unite_fr = val;
    } else if (corr.type_element === 'unite_ar') {
      tableau.unite_ar = val;
    } else if (corr.type_element === 'notes_fr') {
      tableau.notes_fr = val;
    } else if (corr.type_element === 'notes_ar') {
      tableau.notes_ar = val;
    }
  }

  tableau.donnees = donnees;
  tableau.entetes = entetes;
}

function parseJsonArray(value: any): any[] {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

function buildTableauSnapshot(tableau: any, entetesOverride?: any[], donneesOverride?: any[], mergedCellsOverride?: any[]) {
  return {
    id: tableau.id,
    code: tableau.code,
    titre_fr: tableau.titre_fr,
    titre_ar: tableau.titre_ar,
    unite_fr: tableau.unite_fr,
    unite_ar: tableau.unite_ar,
    notes_fr: tableau.notes_fr,
    notes_ar: tableau.notes_ar,
    entetes: entetesOverride ?? parseJsonArray(tableau.entetes),
    donnees: donneesOverride ?? parseJsonArray(tableau.donnees),
    merged_cells: mergedCellsOverride ?? parseJsonArray(tableau.merged_cells),
    thematique_nom: tableau.thematique_nom,
    thematique_code: tableau.thematique_code,
    annuaire_annee: tableau.annuaire_annee,
    pdf_url: tableau.pdf_url,
    pdf_path: tableau.pdf_path
  };
}

/**
 * GET /api/corrections/pending
 * Retrieve all pending corrections across all tables (Validateur uniquement)
 */
router.get('/pending', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'validateur') {
    res.status(403).json({ error: 'Accès interdit. Rôle validateur requis.' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT tc.*, t.code AS tableau_code, t.titre_fr AS tableau_titre, u.email AS user_email, a.pdf_url, a.pdf_path, a.annee AS annuaire_annee
       FROM tableaux_corrections tc
       JOIN tableaux t ON tc.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.status = 'pending'
       ORDER BY tc.created_at ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Erreur GET /api/corrections/pending', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/corrections/history
 * Retrieve all resolved (approved/rejected) corrections across all tables (Validateur uniquement)
 */
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'validateur') {
    res.status(403).json({ error: 'Accès interdit. Rôle validateur requis.' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT tc.*, t.code AS tableau_code, t.titre_fr AS tableau_titre, u.email AS user_email, a.pdf_url, a.pdf_path, a.annee AS annuaire_annee
       FROM tableaux_corrections tc
       JOIN tableaux t ON tc.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.status IN ('approved', 'rejected')
       ORDER BY tc.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Erreur GET /api/corrections/history', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/corrections/tableaux/:id
 * Retrieve a table with its entetes/donnees from tableaux_data, pdf info, and correction history
 * If requested by a corrector, overlays their pending changes dynamically
 */
router.get('/tableaux/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const tableRes = await pool.query(
      `SELECT t.*, td.entetes, td.donnees, td.merged_cells, th.nom_fr AS thematique_nom, th.code AS thematique_code, a.annee AS annuaire_annee, a.pdf_url, a.pdf_path
       FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       WHERE t.id = $1`,
      [id]
    );

    if (tableRes.rows.length === 0) {
      res.status(404).json({ error: 'Tableau non trouvé' });
      return;
    }

    const tableau = tableRes.rows[0];

    // Fetch correction history
    const historyRes = await pool.query(
      `SELECT * FROM tableaux_corrections
       WHERE id_tableau = $1
       ORDER BY created_at DESC`,
      [id]
    );

    // Appliquer dynamiquement les corrections "pending" selon le rôle
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;

    // tableau_original = état du tableau AU MOMENT de la correction demandée
    // tableau          = état du tableau APRÈS application de cette correction (pour visualisation)
    let tableau_original: any = null;

    if (userRole === 'correcteur' && userId) {
      // Correcteur : overlay de toutes ses propres corrections pending
      const pendingRes = await pool.query(
        `SELECT * FROM tableaux_corrections
         WHERE id_tableau = $1 AND user_id = $2 AND status = 'pending'`,
        [id, userId]
      );
      applyPendingCorrections(tableau, pendingRes.rows);

    } else if (userRole === 'admin') {
      const correctionId = req.query.correctionId;
      if (correctionId) {
        // Fetch the specific correction we want to visualise
        const corrRes = await pool.query(
          `SELECT * FROM tableaux_corrections
           WHERE id = $1 AND id_tableau = $2`,
          [correctionId, id]
        );
        if (corrRes.rows.length > 0) {
          const targetCorrection = corrRes.rows[0];

          if (targetCorrection.snapshot_before) {
            const snapshot = typeof targetCorrection.snapshot_before === 'string'
              ? JSON.parse(targetCorrection.snapshot_before)
              : targetCorrection.snapshot_before;
            tableau_original = JSON.parse(JSON.stringify(snapshot));

            const tableauAtT = JSON.parse(JSON.stringify(snapshot));
            applyPendingCorrections(tableauAtT, [targetCorrection]);
            Object.assign(tableau, tableauAtT);
          } else {
            const targetDate: Date = new Date(targetCorrection.created_at);

            // Fallback pour les anciennes corrections sans snapshot: reconstruire
            // l'etat a T en annulant les corrections texte approuvees apres cette date.
            const laterApprovedRes = await pool.query(
              `SELECT * FROM tableaux_corrections
               WHERE id_tableau = $1
                 AND status = 'approved'
                 AND created_at > $2
                 AND type_element IN ('cellule','entete','titre_fr','titre_ar','unite_fr','unite_ar','notes_fr','notes_ar')
               ORDER BY created_at DESC`,
              [id, targetDate.toISOString()]
            );

            const tableauAtT = JSON.parse(JSON.stringify(tableau));
            let donnees = parseJsonArray(tableauAtT.donnees);
            let entetes = parseJsonArray(tableauAtT.entetes);

            for (const later of laterApprovedRes.rows) {
              if (later.type_element === 'cellule' && later.row_index !== null && later.col_index !== null) {
                if (donnees[later.row_index]) donnees[later.row_index][later.col_index] = later.valeur_originale ?? '';
              } else if (later.type_element === 'entete' && later.row_index !== null && later.col_index !== null) {
                if (entetes[later.row_index]) entetes[later.row_index][later.col_index] = later.valeur_originale ?? '';
              } else if (later.type_element === 'titre_fr')  { tableauAtT.titre_fr  = later.valeur_originale ?? ''; }
              else if (later.type_element === 'titre_ar')    { tableauAtT.titre_ar  = later.valeur_originale ?? ''; }
              else if (later.type_element === 'unite_fr')    { tableauAtT.unite_fr  = later.valeur_originale ?? ''; }
              else if (later.type_element === 'unite_ar')    { tableauAtT.unite_ar  = later.valeur_originale ?? ''; }
              else if (later.type_element === 'notes_fr')    { tableauAtT.notes_fr  = later.valeur_originale ?? ''; }
              else if (later.type_element === 'notes_ar')    { tableauAtT.notes_ar  = later.valeur_originale ?? ''; }
            }

            tableauAtT.donnees = donnees;
            tableauAtT.entetes = entetes;
            tableau_original = JSON.parse(JSON.stringify(tableauAtT));
            applyPendingCorrections(tableauAtT, [targetCorrection]);
            Object.assign(tableau, tableauAtT);
          }
        }
      }
    }

    res.json({
      tableau,
      tableau_original,   // null unless admin viewing a specific correction
      history: historyRes.rows
    });
  } catch (err: any) {
    console.error('Erreur GET /api/corrections/tableaux/:id', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/corrections/tableaux/:id
 * Apply a cell or metadata correction to a table.
 * If user is correcteur: saves as pending.
 * If user is admin: applies immediately.
 */
router.post('/tableaux/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    type_element, // 'cellule', 'entete', 'titre_fr', 'titre_ar', 'unite_fr', 'unite_ar', 'notes_fr', 'notes_ar'
    row_index,
    col_index,
    valeur_corrigee,
    commentaire,
    user_display_name
  } = req.body;

  if (!type_element || valeur_corrigee === undefined) {
    res.status(400).json({ error: 'type_element et valeur_corrigee sont requis' });
    return;
  }

  const userRole = req.user?.role || 'correcteur';
  const userId = req.user?.id || null;
  const userDisplayName = user_display_name || req.user?.display_name || 'Correcteur';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tableRes = await client.query(
      `SELECT t.*, td.donnees, td.entetes, td.merged_cells FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       WHERE t.id = $1 FOR UPDATE OF t`,
      [id]
    );

    if (tableRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Tableau non trouvé' });
      return;
    }

    const tableau = tableRes.rows[0];
    const snapshotBefore = buildTableauSnapshot(tableau);
    let valeur_originale = '';
    let updatedTableFields: { [key: string]: any } = {};
    let updatedDataField: any = null;

    if (type_element === 'cellule') {
      if (row_index === undefined || col_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index et col_index requis pour une cellule' });
        return;
      }

      let donnees = tableau.donnees;
      if (typeof donnees === 'string') {
        try { donnees = JSON.parse(donnees); } catch (e) { donnees = []; }
      }
      if (!Array.isArray(donnees)) donnees = [];

      if (!donnees[row_index]) {
        donnees[row_index] = [];
      }

      valeur_originale = strOrEmpty(donnees[row_index][col_index]);
      donnees[row_index][col_index] = strOrEmpty(valeur_corrigee);
      updatedDataField = donnees;

    } else if (type_element === 'entete') {
      if (row_index === undefined || col_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index et col_index requis pour un entête' });
        return;
      }

      let entetes = tableau.entetes;
      if (typeof entetes === 'string') {
        try { entetes = JSON.parse(entetes); } catch (e) { entetes = []; }
      }
      if (!Array.isArray(entetes)) entetes = [];

      if (!entetes[row_index]) {
        entetes[row_index] = [];
      }

      valeur_originale = strOrEmpty(entetes[row_index][col_index]);
      entetes[row_index][col_index] = strOrEmpty(valeur_corrigee);

    } else if (type_element === 'titre_fr') {
      valeur_originale = strOrEmpty(tableau.titre_fr);
      updatedTableFields.titre_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'titre_ar') {
      valeur_originale = strOrEmpty(tableau.titre_ar);
      updatedTableFields.titre_ar = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'unite_fr') {
      valeur_originale = strOrEmpty(tableau.unite_fr);
      updatedTableFields.unite_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'unite_ar') {
      valeur_originale = strOrEmpty(tableau.unite_ar);
      updatedTableFields.unite_ar = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'notes_fr') {
      valeur_originale = strOrEmpty(tableau.notes_fr);
      updatedTableFields.notes_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'notes_ar') {
      valeur_originale = strOrEmpty(tableau.notes_ar);
      updatedTableFields.notes_ar = strOrEmpty(valeur_corrigee);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'type_element invalide' });
      return;
    }

    let logRes;

    if (userRole === 'admin') {
      // Les admins appliquent directement en base
      if (type_element === 'cellule' && updatedDataField !== null) {
        await client.query(
          `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
           VALUES ($1, '[]'::jsonb, $2::jsonb)
           ON CONFLICT (id_tableau) DO UPDATE SET donnees = EXCLUDED.donnees, updated_at = NOW()`,
          [id, JSON.stringify(updatedDataField)]
        );
      } else if (type_element === 'entete') {
        let entetes = tableau.entetes;
        if (typeof entetes === 'string') {
          try { entetes = JSON.parse(entetes); } catch (e) { entetes = []; }
        }
        if (!Array.isArray(entetes)) entetes = [];
        if (!entetes[row_index!]) entetes[row_index!] = [];
        entetes[row_index!][col_index!] = strOrEmpty(valeur_corrigee);

        await client.query(
          `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
           VALUES ($1, $2::jsonb, '[]'::jsonb)
           ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, updated_at = NOW()`,
          [id, JSON.stringify(entetes)]
        );
      }

      if (Object.keys(updatedTableFields).length > 0) {
        const setClause = Object.keys(updatedTableFields).map((k, idx) => `${k} = $${idx + 2}`).join(', ');
        const values = [id, ...Object.values(updatedTableFields)];
        await client.query(`UPDATE tableaux SET ${setClause}, updated_at = NOW() WHERE id = $1`, values);
      }

      // Log immédiat 'approved'
      logRes = await client.query(
        `INSERT INTO tableaux_corrections
         (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire, status, snapshot_before)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10::jsonb)
         RETURNING *`,
        [
          id,
          userId,
          userDisplayName,
          type_element,
          row_index !== undefined ? row_index : null,
          col_index !== undefined ? col_index : null,
          valeur_originale,
          strOrEmpty(valeur_corrigee),
          commentaire || null,
          JSON.stringify(snapshotBefore)
        ]
      );
    } else {
      // Pour les correcteurs, enregistrer en 'pending' et ne PAS modifier les tables publiques
      const existing = await client.query(
        `SELECT id FROM tableaux_corrections
         WHERE id_tableau = $1 
           AND user_id = $2 
           AND type_element = $3 
           AND (row_index = $4 OR (row_index IS NULL AND $4 IS NULL))
           AND (col_index = $5 OR (col_index IS NULL AND $5 IS NULL))
           AND status = 'pending'`,
        [
          id,
          userId,
          type_element,
          row_index !== undefined ? row_index : null,
          col_index !== undefined ? col_index : null
        ]
      );

      if (existing.rows.length > 0) {
        // Mettre à jour la correction existante
        logRes = await client.query(
          `UPDATE tableaux_corrections
           SET valeur_corrigee = $1, commentaire = $2, snapshot_before = $3::jsonb, created_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [strOrEmpty(valeur_corrigee), commentaire || null, JSON.stringify(snapshotBefore), existing.rows[0].id]
        );
      } else {
        // Insérer une nouvelle correction
        logRes = await client.query(
          `INSERT INTO tableaux_corrections
           (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire, status, snapshot_before)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10::jsonb)
           RETURNING *`,
          [
            id,
            userId,
            userDisplayName,
            type_element,
            row_index !== undefined ? row_index : null,
            col_index !== undefined ? col_index : null,
            valeur_originale,
            strOrEmpty(valeur_corrigee),
            commentaire || null,
            JSON.stringify(snapshotBefore)
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Récupérer le tableau final
    const finalTableRes = await client.query(
      `SELECT t.*, td.entetes, td.donnees, td.merged_cells, th.nom_fr AS thematique_nom, th.code AS thematique_code, a.annee AS annuaire_annee, a.pdf_url, a.pdf_path
       FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       WHERE t.id = $1`,
      [id]
    );

    const finalTableau = finalTableRes.rows[0];

    // Si correcteur, appliquer dynamiquement ses corrections "pending" sur le résultat retourné
    if (userRole === 'correcteur' && userId) {
      const pendingRes = await pool.query(
        `SELECT * FROM tableaux_corrections
         WHERE id_tableau = $1 AND user_id = $2 AND status = 'pending'`,
        [id, userId]
      );
      applyPendingCorrections(finalTableau, pendingRes.rows);
    }

    res.json({
      tableau: finalTableau,
      correction: logRes.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /api/corrections/tableaux/:id', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/corrections/:id/approve
 * Approve a pending correction and apply it to database (Validateur uniquement)
 */
router.post('/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'validateur') {
    res.status(403).json({ error: 'Accès interdit. Rôle validateur requis.' });
    return;
  }

  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer la correction en attente
    const corrRes = await client.query(
      `SELECT * FROM tableaux_corrections WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );

    if (corrRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Correction en attente non trouvée' });
      return;
    }

    const correction = corrRes.rows[0];
    const { id_tableau, type_element, row_index, col_index, valeur_corrigee, user_id } = correction;

    // 2. Récupérer le tableau pour y appliquer le changement
    const tableRes = await client.query(
      `SELECT t.*, td.donnees, td.entetes, td.merged_cells FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       WHERE t.id = $1 FOR UPDATE OF t`,
      [id_tableau]
    );

    if (tableRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Tableau associé non trouvé' });
      return;
    }

    const tableau = tableRes.rows[0];
    let updatedTableFields: { [key: string]: any } = {};
    let updatedDataField: any = null;

    if (type_element === 'cellule') {
      let donnees = tableau.donnees;
      if (typeof donnees === 'string') {
        try { donnees = JSON.parse(donnees); } catch (e) { donnees = []; }
      }
      if (!Array.isArray(donnees)) donnees = [];
      if (!donnees[row_index]) donnees[row_index] = [];
      donnees[row_index][col_index] = strOrEmpty(valeur_corrigee);
      updatedDataField = donnees;

    } else if (type_element === 'entete') {
      let entetes = tableau.entetes;
      if (typeof entetes === 'string') {
        try { entetes = JSON.parse(entetes); } catch (e) { entetes = []; }
      }
      if (!Array.isArray(entetes)) entetes = [];
      if (!entetes[row_index]) entetes[row_index] = [];
      entetes[row_index][col_index] = strOrEmpty(valeur_corrigee);
      
      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, '[]'::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, updated_at = NOW()`,
        [id_tableau, JSON.stringify(entetes)]
      );

    } else if (type_element === 'titre_fr') {
      updatedTableFields.titre_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'titre_ar') {
      updatedTableFields.titre_ar = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'unite_fr') {
      updatedTableFields.unite_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'unite_ar') {
      updatedTableFields.unite_ar = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'notes_fr') {
      updatedTableFields.notes_fr = strOrEmpty(valeur_corrigee);
    } else if (type_element === 'notes_ar') {
      updatedTableFields.notes_ar = strOrEmpty(valeur_corrigee);
    }

    // Appliquer en base de données
    if (updatedDataField !== null) {
      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, '[]'::jsonb, $2::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET donnees = EXCLUDED.donnees, updated_at = NOW()`,
        [id_tableau, JSON.stringify(updatedDataField)]
      );
    }

    if (Object.keys(updatedTableFields).length > 0) {
      const setClause = Object.keys(updatedTableFields).map((k, idx) => `${k} = $${idx + 2}`).join(', ');
      const values = [id_tableau, ...Object.values(updatedTableFields)];
      await client.query(`UPDATE tableaux SET ${setClause}, updated_at = NOW() WHERE id = $1`, values);
    }

    // 3. Mettre à jour le statut de la correction en 'approved'
    await client.query(
      `UPDATE tableaux_corrections SET status = 'approved' WHERE id = $1`,
      [id]
    );

    // 4. Donner des points au correcteur
    if (user_id) {
      await client.query(
        `UPDATE users SET points = points + 1 WHERE id = $1`,
        [user_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Correction approuvée et appliquée avec succès' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /api/corrections/:id/approve', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/corrections/:id/reject
 * Reject a pending correction (Validateur uniquement)
 */
router.post('/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'validateur') {
    res.status(403).json({ error: 'Accès interdit. Rôle validateur requis.' });
    return;
  }
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE tableaux_corrections SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Correction en attente non trouvée ou déjà traitée' });
      return;
    }
    res.json({ success: true, message: 'Correction rejetée avec succès' });
  } catch (err: any) {
    console.error('Erreur POST /api/corrections/:id/reject', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/corrections/pdf-proxy
 * Proxy PDF files from HCP to force inline header viewing in browser iframe
 */
router.get('/pdf-proxy', (req: Request, res: Response) => {
  const pdfUrl = req.query.url as string;
  if (!pdfUrl) {
    res.status(400).send('URL manquante');
    return;
  }

  const getter = pdfUrl.startsWith('https') ? https : http;

  const requestOptions = {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  getter.get(pdfUrl, requestOptions, (proxyRes) => {
    // If redirect, follow redirect
    if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      res.redirect(`/api/corrections/pdf-proxy?url=${encodeURIComponent(proxyRes.headers.location)}`);
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="annuaire.pdf"');
    
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('Erreur pdf-proxy:', err);
    res.status(500).send('Erreur lors du chargement du PDF');
  });
});

/**
 * POST /api/corrections/annuaires/:annee/pdf-url
 * Save or update the PDF URL/path for an annuaire year
 */
router.post('/annuaires/:annee/pdf-url', async (req: Request, res: Response) => {
  const { annee } = req.params;
  const { pdf_url, pdf_path } = req.body;

  try {
    const result = await pool.query(
      `UPDATE annuaires SET pdf_url = $1, pdf_path = $2, updated_at = NOW() WHERE annee = $3 RETURNING *`,
      [pdf_url || null, pdf_path || null, annee]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Annuaire non trouvé' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Erreur POST /api/corrections/annuaires/:annee/pdf-url', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/corrections/tableaux/:id/structure
 * Apply a structural operation on header or data rows.
 * Operations:
 *   - entete_merge_cells   : merge a rectangular range of header cells (stores merged_cells)
 *   - entete_move_row      : move a header row up/down
 *   - entete_move_col      : move a column (in all header rows + data rows) left/right
 *   - donnees_insert_row   : insert an empty row in donnees at given position
 *   - donnees_delete_row   : delete a row in donnees at given position
 *
 * New structural operations:
 *   - entete_unmerge_cells : remove a merged-cell rule covering (row_index, col_index)
 *   - entete_insert_row    : insert an empty header row at row_index position
 *   - entete_delete_row    : delete a header row at row_index position
 *   - entete_insert_col    : insert an empty column in headers+data at col_index position
 *   - entete_delete_col    : delete a column from headers+data at col_index position
 *
 * Payload common fields: type_operation, commentaire, user_display_name
 * Per operation extra fields documented inline.
 */
router.post('/tableaux/:id/structure', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    type_operation,
    commentaire,
    user_display_name,
    // merge_cells / unmerge specific
    start_row, start_col, end_row, end_col,
    // move_row / insert_row / delete_row specific
    row_index, direction,
    // move_col / insert_col / delete_col specific
    col_index,
  } = req.body;

  if (!type_operation) {
    res.status(400).json({ error: 'type_operation est requis' });
    return;
  }

  const userRole = req.user?.role || 'correcteur';
  const userId = req.user?.id || null;
  const userDisplayName = user_display_name || req.user?.display_name || 'Correcteur';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tableRes = await client.query(
      `SELECT t.*, td.entetes, td.donnees, td.merged_cells FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       WHERE t.id = $1 FOR UPDATE OF t`,
      [id]
    );

    if (tableRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Tableau non trouvé' });
      return;
    }

    const tableau = tableRes.rows[0];

    let entetes: any[][] = tableau.entetes;
    if (typeof entetes === 'string') { try { entetes = JSON.parse(entetes); } catch { entetes = []; } }
    if (!Array.isArray(entetes)) entetes = [];

    let donnees: any[][] = tableau.donnees;
    if (typeof donnees === 'string') { try { donnees = JSON.parse(donnees); } catch { donnees = []; } }
    if (!Array.isArray(donnees)) donnees = [];

    let mergedCells: any[] = tableau.merged_cells;
    if (typeof mergedCells === 'string') { try { mergedCells = JSON.parse(mergedCells); } catch { mergedCells = []; } }
    if (!Array.isArray(mergedCells)) mergedCells = [];

    // -----------------------------------------------------------------------
    // CRITICAL: apply the user's own pending text corrections onto entetes/donnees
    // before executing any structural operation, so their prior edits are preserved.
    // After the structural op writes the merged state to tableaux_data, those pending
    // corrections are superseded (their values are now baked in), so we mark them approved.
    let supersededCorrectionIds: number[] = [];
    if (userId) {
      const pendingRes = await client.query(
        `SELECT * FROM tableaux_corrections
         WHERE id_tableau = $1 AND user_id = $2 AND status = 'pending'
           AND type_element IN ('cellule', 'entete')
         ORDER BY created_at ASC`,
        [id, userId]
      );
      const pendingTextCorrections = pendingRes.rows;
      if (pendingTextCorrections.length > 0) {
        for (const corr of pendingTextCorrections) {
          if (corr.type_element === 'entete' && corr.row_index !== null && corr.col_index !== null) {
            if (!entetes[corr.row_index]) entetes[corr.row_index] = [];
            entetes[corr.row_index][corr.col_index] = strOrEmpty(corr.valeur_corrigee);
          } else if (corr.type_element === 'cellule' && corr.row_index !== null && corr.col_index !== null) {
            if (!donnees[corr.row_index]) donnees[corr.row_index] = [];
            donnees[corr.row_index][corr.col_index] = strOrEmpty(corr.valeur_corrigee);
          }
        }
        supersededCorrectionIds = pendingTextCorrections.map((c: any) => c.id);
      }
    }

    const snapshotBefore = buildTableauSnapshot(tableau, entetes, donnees, mergedCells);

    // -----------------------------------------------------------------------
    const idxToColLetter = (n: number): string => {
      let s = '';
      n += 1; // 1-based
      while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };

    // -----------------------------------------------------------------------
    let description = '';

    if (type_operation === 'entete_merge_cells') {
      // Validate
      if (start_row === undefined || start_col === undefined || end_row === undefined || end_col === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'start_row, start_col, end_row, end_col requis pour la fusion' });
        return;
      }
      const sR = Math.min(start_row, end_row);
      const eR = Math.max(start_row, end_row);
      const sC = Math.min(start_col, end_col);
      const eC = Math.max(start_col, end_col);

      // Collect the first non-empty value in the range (top-left priority, then scan rest)
      let topLeftValue = '';
      outer: for (let r = sR; r <= eR; r++) {
        for (let c = sC; c <= eC; c++) {
          const v = strOrEmpty(entetes[r]?.[c]);
          if (v !== '') { topLeftValue = v; break outer; }
        }
      }

      // Write that value into the top-left cell, clear all others
      for (let r = sR; r <= eR; r++) {
        if (!entetes[r]) entetes[r] = [];
        for (let c = sC; c <= eC; c++) {
          entetes[r][c] = (r === sR && c === sC) ? topLeftValue : '';
        }
      }

      // Remove any existing merged_cells that overlap with this range
      mergedCells = mergedCells.filter((mc: any) => {
        const rangeStr: string = mc.range || (typeof mc === 'string' ? mc : '');
        const m = rangeStr.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!m) return true;
        const mcSC = colLetterToIdx(m[1]);
        const mcSR = parseInt(m[2], 10) - 1;
        const mcEC = colLetterToIdx(m[3] || m[1]);
        const mcER = parseInt(m[4] || m[2], 10) - 1;
        // Remove if overlapping
        const overlaps = !(mcEC < sC || mcSC > eC || mcER < sR || mcSR > eR);
        return !overlaps;
      });

      // Add new merged cell entry
      const rangeStr = `${idxToColLetter(sC)}${sR + 1}:${idxToColLetter(eC)}${eR + 1}`;
      mergedCells.push({ range: rangeStr, value: strOrEmpty(topLeftValue) });

      description = `Fusion cellules entête ${rangeStr}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, merged_cells = $4::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees), JSON.stringify(mergedCells)]
      );

    } else if (type_operation === 'entete_move_row') {
      if (row_index === undefined || !direction) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index et direction requis' });
        return;
      }
      const rIdx = Number(row_index);
      const targetIdx = direction === 'up' ? rIdx - 1 : rIdx + 1;

      if (targetIdx < 0 || targetIdx >= entetes.length) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Déplacement impossible: hors limites' });
        return;
      }

      // Swap rows
      [entetes[rIdx], entetes[targetIdx]] = [entetes[targetIdx], entetes[rIdx]];
      description = `Déplacement ligne entête ${rIdx + 1} vers ${direction === 'up' ? 'haut' : 'bas'}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees)]
      );

    } else if (type_operation === 'entete_move_col') {
      if (col_index === undefined || !direction) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'col_index et direction requis' });
        return;
      }
      const cIdx = Number(col_index);
      const targetCIdx = direction === 'left' ? cIdx - 1 : cIdx + 1;

      // Determine max cols
      const maxCols = Math.max(
        ...entetes.map(r => r.length),
        ...donnees.map(r => r.length)
      );

      if (targetCIdx < 0 || targetCIdx >= maxCols) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Déplacement impossible: hors limites' });
        return;
      }

      // Swap columns in all header rows
      entetes = entetes.map(row => {
        const newRow = [...row];
        const tmp = newRow[cIdx];
        newRow[cIdx] = newRow[targetCIdx] ?? '';
        newRow[targetCIdx] = tmp ?? '';
        return newRow;
      });

      // Swap columns in all data rows
      donnees = donnees.map(row => {
        const newRow = [...row];
        const tmp = newRow[cIdx];
        newRow[cIdx] = newRow[targetCIdx] ?? '';
        newRow[targetCIdx] = tmp ?? '';
        return newRow;
      });

      description = `Déplacement colonne ${cIdx + 1} vers ${direction === 'left' ? 'gauche' : 'droite'}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees)]
      );

    } else if (type_operation === 'donnees_insert_row') {
      if (row_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index requis' });
        return;
      }
      const rIdx = Number(row_index);
      const colCount = donnees[0]?.length ?? (entetes[entetes.length - 1]?.length ?? 1);
      const emptyRow = Array(colCount).fill('');
      donnees.splice(rIdx, 0, emptyRow);
      description = `Insertion ligne données à la position ${rIdx + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET donnees = $3::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees)]
      );

    } else if (type_operation === 'donnees_delete_row') {
      if (row_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index requis' });
        return;
      }
      const rIdx = Number(row_index);
      if (rIdx < 0 || rIdx >= donnees.length) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index hors limites' });
        return;
      }
      donnees.splice(rIdx, 1);
      description = `Suppression ligne données à la position ${rIdx + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET donnees = $3::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees)]
      );

    } else if (type_operation === 'entete_unmerge_cells') {
      // Remove the merged-cell rule that covers (row_index, col_index)
      if (row_index === undefined || col_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index et col_index requis pour annuler la fusion' });
        return;
      }
      const rIdx = Number(row_index);
      const cIdx = Number(col_index);

      // Find the rule that covers this cell
      const ruleIdx = mergedCells.findIndex((mc: any) => {
        const rangeStr: string = mc.range || (typeof mc === 'string' ? mc : '');
        const m = rangeStr.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!m) return false;
        const mcSC = colLetterToIdx(m[1]);
        const mcSR = parseInt(m[2], 10) - 1;
        const mcEC = colLetterToIdx(m[3] || m[1]);
        const mcER = parseInt(m[4] || m[2], 10) - 1;
        return rIdx >= mcSR && rIdx <= mcER && cIdx >= mcSC && cIdx <= mcEC;
      });

      if (ruleIdx === -1) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Aucune fusion trouvée sur cette cellule' });
        return;
      }

      const removedRule = mergedCells[ruleIdx];
      mergedCells.splice(ruleIdx, 1);
      description = `Annulation fusion ${removedRule.range}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, merged_cells = $4::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees), JSON.stringify(mergedCells)]
      );

    } else if (type_operation === 'entete_insert_row') {
      // Insert an empty header row at row_index (0-based, inserts before)
      if (row_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index requis' });
        return;
      }
      const rIdx = Math.max(0, Math.min(Number(row_index), entetes.length));
      const colCount = entetes[0]?.length ?? (donnees[0]?.length ?? 1);
      entetes.splice(rIdx, 0, Array(colCount).fill(''));
      description = `Insertion ligne d'en-tête à la position ${rIdx + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees)]
      );

    } else if (type_operation === 'entete_delete_row') {
      // Delete header row at row_index
      if (row_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index requis' });
        return;
      }
      const rIdx = Number(row_index);
      if (rIdx < 0 || rIdx >= entetes.length) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'row_index hors limites' });
        return;
      }
      if (entetes.length === 1) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Impossible de supprimer la seule ligne d\'en-tête restante' });
        return;
      }
      entetes.splice(rIdx, 1);
      // Remove merged_cells rules that referenced deleted row; shift rows above
      mergedCells = mergedCells.filter((mc: any) => {
        const rangeStr: string = mc.range || '';
        const m = rangeStr.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!m) return true;
        const mcSR = parseInt(m[2], 10) - 1;
        const mcER = parseInt(m[4] || m[2], 10) - 1;
        // Drop rules that overlap deleted row
        return !(mcSR <= rIdx && mcER >= rIdx);
      });
      description = `Suppression ligne d'en-tête à la position ${rIdx + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, merged_cells = $4::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees), JSON.stringify(mergedCells)]
      );

    } else if (type_operation === 'entete_insert_col') {
      // Insert an empty column at col_index in both headers and data
      if (col_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'col_index requis' });
        return;
      }
      const cIdx = Number(col_index);
      entetes = entetes.map(row => {
        const newRow = [...row];
        newRow.splice(cIdx, 0, '');
        return newRow;
      });
      donnees = donnees.map(row => {
        const newRow = [...row];
        newRow.splice(cIdx, 0, '');
        return newRow;
      });
      // Clear merged_cells (column shifts would make ranges stale — safer to drop)
      mergedCells = [];
      description = `Insertion colonne à la position ${cIdx + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, merged_cells = $4::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees), JSON.stringify(mergedCells)]
      );

    } else if (type_operation === 'entete_delete_col') {
      // Delete a column from headers and data
      if (col_index === undefined) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'col_index requis' });
        return;
      }
      const cIdxN = Number(col_index);

      const maxCols = Math.max(...entetes.map(r => r.length), ...donnees.map(r => r.length), 0);
      if (cIdxN < 0 || cIdxN >= maxCols) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'col_index hors limites' });
        return;
      }
      if (maxCols <= 1) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Impossible de supprimer la seule colonne restante' });
        return;
      }
      entetes = entetes.map(row => {
        const newRow = [...row];
        newRow.splice(cIdxN, 1);
        return newRow;
      });
      donnees = donnees.map(row => {
        const newRow = [...row];
        newRow.splice(cIdxN, 1);
        return newRow;
      });
      // Clear merged_cells (column shifts would make ranges stale)
      mergedCells = [];
      description = `Suppression colonne à la position ${cIdxN + 1}`;

      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, donnees = $3::jsonb, merged_cells = $4::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes), JSON.stringify(donnees), JSON.stringify(mergedCells)]
      );

    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `type_operation inconnu: ${type_operation}` });
      return;
    }

    // Mark superseded pending text corrections as approved
    // (their values were baked into the structural write above)
    if (supersededCorrectionIds.length > 0) {
      await client.query(
        `UPDATE tableaux_corrections SET status = 'approved' WHERE id = ANY($1::int[])`,
        [supersededCorrectionIds]
      );
    }

    // Log the structural operation
    const logRes = await client.query(
      `INSERT INTO tableaux_corrections
       (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire, status, snapshot_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING *`,
      [
        id,
        userId,
        userDisplayName,
        type_operation,
        row_index !== undefined ? Number(row_index) : null,
        col_index !== undefined ? Number(col_index) : null,
        '',
        description,
        commentaire || null,
        userRole === 'admin' ? 'approved' : 'pending',
        JSON.stringify(snapshotBefore)
      ]
    );

    await client.query('COMMIT');

    // Return updated tableau
    const finalRes = await pool.query(
      `SELECT t.*, td.entetes, td.donnees, td.merged_cells, th.nom_fr AS thematique_nom, th.code AS thematique_code, a.annee AS annuaire_annee, a.pdf_url, a.pdf_path
       FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       WHERE t.id = $1`,
      [id]
    );

    res.json({
      tableau: finalRes.rows[0],
      correction: logRes.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /api/corrections/tableaux/:id/structure', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Re-use colLetterToIdx locally (also used in applyPendingCorrections scope above)
function colLetterToIdx(colStr: string): number {
  let idx = 0;
  const str = colStr.toUpperCase();
  for (let i = 0; i < str.length; i++) {
    idx = idx * 26 + (str.charCodeAt(i) - 65 + 1);
  }
  return idx - 1;
}

function strOrEmpty(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

export default router;
