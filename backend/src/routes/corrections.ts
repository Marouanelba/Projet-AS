import { Router, Request, Response } from 'express';
import pool from '../db.js';
import https from 'https';
import http from 'http';

const router = Router();

/**
 * GET /api/corrections/tableaux/:id
 * Retrieve a table with its entetes/donnees from tableaux_data, pdf info, and correction history
 */
router.get('/tableaux/:id', async (req: Request, res: Response) => {
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
      return res.status(404).json({ error: 'Tableau non trouvé' });
    }

    const tableau = tableRes.rows[0];

    // Fetch correction history
    const historyRes = await pool.query(
      `SELECT * FROM tableaux_corrections
       WHERE id_tableau = $1
       ORDER BY created_at DESC`,
      [id]
    );

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
 * Apply a cell or metadata correction to a table and record audit log
 */
router.post('/tableaux/:id', async (req: Request, res: Response) => {
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
    return res.status(400).json({ error: 'type_element et valeur_corrigee sont requis' });
  }

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
      return res.status(404).json({ error: 'Tableau non trouvé' });
    }

    const tableau = tableRes.rows[0];
    let valeur_originale = '';
    let updatedTableFields: { [key: string]: any } = {};
    let updatedDataField: any = null;

    if (type_element === 'cellule') {
      if (row_index === undefined || col_index === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'row_index et col_index requis pour une cellule' });
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
    } else if (type_element === 'entete') {
      // Modification d'une cellule d'en-tête
      if (row_index === undefined || col_index === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'row_index et col_index requis pour un entête' });
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

      // Update entetes in tableaux_data
      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, $2::jsonb, '[]'::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2::jsonb, updated_at = NOW()`,
        [id, JSON.stringify(entetes)]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'type_element invalide' });
    }

    // Apply update to tableaux_data if cell was edited
    if (updatedDataField !== null) {
      await client.query(
        `INSERT INTO tableaux_data (id_tableau, entetes, donnees)
         VALUES ($1, '[]'::jsonb, $2::jsonb)
         ON CONFLICT (id_tableau) DO UPDATE SET donnees = EXCLUDED.donnees, updated_at = NOW()`,
        [id, JSON.stringify(updatedDataField)]
      );
    }

    // Apply update to tableaux metadata if metadata was edited
    if (Object.keys(updatedTableFields).length > 0) {
      const setClause = Object.keys(updatedTableFields).map((k, idx) => `${k} = $${idx + 2}`).join(', ');
      const values = [id, ...Object.values(updatedTableFields)];
      await client.query(`UPDATE tableaux SET ${setClause}, updated_at = NOW() WHERE id = $1`, values);
    }

    // Insert correction log
    const userDisplayName = user_display_name || (req as any).user?.display_name || 'Correcteur';
    const userId = (req as any).user?.id || null;

    const logRes = await client.query(
      `INSERT INTO tableaux_corrections
       (id_tableau, user_id, user_display_name, type_element, row_index, col_index, valeur_originale, valeur_corrigee, commentaire)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

    await client.query('COMMIT');

    // Return updated table + log entry
    const finalTableRes = await client.query(
      `SELECT t.*, td.entetes, td.donnees, td.merged_cells, th.nom_fr AS thematique_nom, th.code AS thematique_code, a.annee AS annuaire_annee, a.pdf_url, a.pdf_path
       FROM tableaux t
       LEFT JOIN tableaux_data td ON td.id_tableau = t.id
       JOIN thematiques th ON t.id_thematique = th.id
       JOIN annuaires a ON th.id_annuaire = a.id
       WHERE t.id = $1`,
      [id]
    );

    res.json({
      tableau: finalTableRes.rows[0],
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
 * GET /api/corrections/pdf-proxy
 * Proxy PDF files from HCP to force inline header viewing in browser iframe
 */
router.get('/pdf-proxy', (req: Request, res: Response) => {
  const pdfUrl = req.query.url as string;
  if (!pdfUrl) {
    return res.status(400).send('URL manquante');
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
      return res.redirect(`/api/corrections/pdf-proxy?url=${encodeURIComponent(proxyRes.headers.location)}`);
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
      return res.status(404).json({ error: 'Annuaire non trouvé' });
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
