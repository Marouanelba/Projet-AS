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

/**
 * GET /api/corrections/pending
 * Retrieve all pending corrections across all tables (Admin only)
 */
router.get('/pending', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
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
 * Retrieve all resolved (approved/rejected) corrections across all tables (Admin only)
 */
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
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

    // Appliquer dynamiquement ses corrections "pending" si l'utilisateur est un correcteur
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;
    if (userRole === 'correcteur' && userId) {
      const pendingRes = await pool.query(
        `SELECT * FROM tableaux_corrections
         WHERE id_tableau = $1 AND user_id = $2 AND status = 'pending'`,
        [id, userId]
      );
      applyPendingCorrections(tableau, pendingRes.rows);
    }

    res.json({
      tableau,
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
      `SELECT t.*, td.donnees, td.entetes FROM tableaux t
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
         (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
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
          commentaire || null
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
           SET valeur_corrigee = $1, commentaire = $2, created_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [strOrEmpty(valeur_corrigee), commentaire || null, existing.rows[0].id]
        );
      } else {
        // Insérer une nouvelle correction
        logRes = await client.query(
          `INSERT INTO tableaux_corrections
           (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
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
            commentaire || null
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
 * Approve a pending correction and apply it to database (Admin only)
 */
router.post('/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
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
      `SELECT t.*, td.donnees, td.entetes FROM tableaux t
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
 * Reject a pending correction (Admin only)
 */
router.post('/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
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

function strOrEmpty(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

export default router;
