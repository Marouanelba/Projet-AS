import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/admin/fix-correction-names
 * Met à jour user_display_name dans tableaux_corrections pour les entrées
 * qui ont encore l'ancienne valeur par défaut 'Correcteur', en utilisant
 * le vrai nom (display_name) ou l'email depuis la table users.
 */
router.post('/fix-correction-names', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      UPDATE tableaux_corrections tc
      SET user_display_name = COALESCE(NULLIF(u.display_name, ''), u.email)
      FROM users u
      WHERE tc.user_id = u.id
        AND (tc.user_display_name = 'Correcteur' OR tc.user_display_name IS NULL)
        AND (u.display_name IS NOT NULL OR u.email IS NOT NULL)
      RETURNING tc.id
    `);
    res.json({ success: true, updated: result.rowCount, message: `${result.rowCount} correction(s) mises à jour.` });
  } catch (error) {
    console.error('[ADMIN] Erreur fix-correction-names:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des noms' });
  }
});

/**
 * POST /api/admin/clear-tables
 * Vide toutes les tables dans l'ordre correct (respect des FK)
 */
router.post('/clear-tables', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Ordre de suppression respectant les clés étrangères
    await pool.query('TRUNCATE tableaux_fusion, tableaux_liaisons, tableaux_ruptures, tableaux_data, tableaux_indices, tableaux, thematiques, annuaires RESTART IDENTITY CASCADE');

    res.json({ success: true, message: 'Toutes les tables ont été vidées et les IDs réinitialisés' });
  } catch (error) {
    console.error('[ADMIN] Erreur clear-tables:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des données' });
  }
});

/**
 * POST /api/admin/import
 * Import de données JSON (métadonnées + indicateurs)
 * Remplace la edge function import-data de Supabase
 */
router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  // mode 'replace' (défaut) : les tableaux d'une thématique sont supprimés
  // avant réinsertion, sinon un réimport les dupliquerait — il n'existe aucune
  // clé fiable pour les mettre à jour en place (le code est construit sur
  // table_number, faux dans plusieurs chapitres).
  // mode 'append' : ancien comportement, ajoute sans supprimer.
  const { type, data, mode = 'replace' } = req.body;

  if (!type || !data) {
    res.status(400).json({ error: 'type et data requis' });
    return;
  }
  if (mode !== 'replace' && mode !== 'append') {
    res.status(400).json({ error: `mode inconnu: ${mode}. Utilisez "replace" ou "append".` });
    return;
  }

  const results = {
    type,
    mode,
    annuaires: { inserted: 0, errors: [] as string[] },
    thematiques: { inserted: 0, errors: [] as string[] },
    indicateurs: { inserted: 0, errors: [] as string[] },
    indices: { inserted: 0, errors: [] as string[] },
    data: { inserted: 0, errors: [] as string[] },
    supprimes: 0,
  };

  // Tout l'import dans une transaction : un échec en cours de route ne doit
  // pas laisser un chapitre à moitié remplacé.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'metadata') {
      // Import des métadonnées (annuaires + thématiques)
      const annuaires = data.annuaires || [];

      for (const annuaire of annuaires) {
        try {
          if (!annuaire.annee) {
            results.annuaires.errors.push('Annuaire sans année: ignoré');
            continue;
          }

          // Upsert sur l'année (contrainte annuaires_annee_key, migration 004).
          // L'ancien ON CONFLICT (id) ne se déclenchait jamais faute d'id
          // fourni : réimporter une année créait un second annuaire.
          const annRes = await client.query(
            `INSERT INTO annuaires (annee, titre_fr, titre_ar)
             VALUES ($1, $2, $3)
             ON CONFLICT (annee) DO UPDATE
               SET titre_fr = COALESCE(EXCLUDED.titre_fr, annuaires.titre_fr),
                   titre_ar = COALESCE(EXCLUDED.titre_ar, annuaires.titre_ar),
                   updated_at = NOW()
             RETURNING id`,
            [annuaire.annee, annuaire.titre_fr || null, annuaire.titre_ar || null]
          );
          const annuaireId: number = annRes.rows[0].id;
          results.annuaires.inserted++;

          // Import des thématiques de cet annuaire
          const thematiques = annuaire.thematiques || [];
          for (const them of thematiques) {
            try {
              await client.query(
                `INSERT INTO thematiques (code, nom_fr, nom_ar, id_annuaire, nb_indicateurs, fichier_source)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id_annuaire, code) DO UPDATE
                   SET nom_fr = EXCLUDED.nom_fr,
                       nom_ar = COALESCE(EXCLUDED.nom_ar, thematiques.nom_ar),
                       nb_indicateurs = EXCLUDED.nb_indicateurs,
                       fichier_source = EXCLUDED.fichier_source,
                       updated_at = NOW()`,
                [them.code, them.nom || them.nom_fr, them.nom_ar || null,
                 annuaireId, them.nb_indicateurs || null, them.fichier_source || null]
              );
              results.thematiques.inserted++;
            } catch (err: any) {
              results.thematiques.errors.push(`Thém. ${them.code}: ${err.message}`);
            }
          }
        } catch (err: any) {
          results.annuaires.errors.push(`Annuaire ${annuaire.annee}: ${err.message}`);
        }
      }
    } else if (type === 'indicateur' || type === 'indicateurs') {
      // Import d'un ou plusieurs indicateurs
      const rawItems = Array.isArray(data) ? data : [data];
      const indicateurs: any[] = [];

      for (const item of rawItems) {
        if (item.tables && Array.isArray(item.tables)) {
          // Nouveau format enveloppé
          for (const t of item.tables) {
            // Pas de repli sur une année en dur : sans annuaire_annee, le
            // tableau était rattaché à 2025 sans le moindre message, quelle
            // que soit son année réelle.
            const annee = t.annuaire_annee || item.annuaire_annee || item.annee;
            indicateurs.push({
              code: t.code || `${t.chapter} - ${t.table_number}`,
              thematique_code: t.thematique_code || String(t.chapter),
              annuaire_annee: annee,
              titre_fr: t.title_fr || "",
              titre_ar: t.title_ar || "",
              unite: t.unite || null,
              source: t.source || (t.notes && Array.isArray(t.notes)
                ? { fr: t.notes.find((n: string) => n.toLowerCase().startsWith("source:"))?.replace(/^source:\s*/i, "") || "" }
                : null),
              notes: t.notes || null,
              entetes: t.headers || t.entetes || [],
              donnees: t.rows || t.donnees || [],
              merged_cells: t.merged_cells || null,
              indices: t.indices || null,
              annee_reference: t.annee_reference || null,
              source_feuille: t.source_feuille || item.page || null,
              ligne_debut: t.ligne_debut || null,
              ligne_fin: t.ligne_fin || null
            });
          }
        } else {
          // Format individuel direct
          indicateurs.push({
            ...item,
            entetes: item.entetes || item.headers || [],
            donnees: item.donnees || item.rows || []
          });
        }
      }

      // En mode 'replace', on vide chaque thématique concernée une seule fois,
      // avant d'insérer ses nouveaux tableaux (le CASCADE emporte tableaux_data,
      // _indices, _liaisons, _ruptures, _fusion et _corrections).
      const videes = new Set<number>();

      for (const ind of indicateurs) {
        try {
          if (!ind.annuaire_annee) {
            results.indicateurs.errors.push(
              `Indicateur ${ind.code}: annuaire_annee absent — tableau ignoré`
            );
            continue;
          }

          // Trouver la thématique par code + annee
          const themRes = await client.query(
            `SELECT th.id FROM thematiques th
             JOIN annuaires a ON th.id_annuaire = a.id
             WHERE th.code = $1 AND a.annee = $2`,
            [ind.thematique_code, ind.annuaire_annee]
          );

          if (themRes.rows.length === 0) {
            results.indicateurs.errors.push(
              `Indicateur ${ind.code}: thématique ${ind.thematique_code} / année ${ind.annuaire_annee} non trouvée`
            );
            continue;
          }

          const id_thematique = themRes.rows[0].id;

          if (mode === 'replace' && !videes.has(id_thematique)) {
            const del = await client.query(
              'DELETE FROM tableaux WHERE id_thematique = $1',
              [id_thematique]
            );
            results.supprimes += del.rowCount ?? 0;
            videes.add(id_thematique);
          }

          // Normaliser les notes pour stockage
          let notesFr = null;
          if (ind.notes) {
            if (Array.isArray(ind.notes)) {
              notesFr = JSON.stringify(ind.notes);
            } else if (typeof ind.notes === 'object') {
              notesFr = ind.notes.fr || null;
            } else {
              notesFr = String(ind.notes);
            }
          }

          // Insérer le tableau (indicateur)
          const tabRes = await client.query(
            `INSERT INTO tableaux (code, titre_fr, titre_ar, id_thematique, unite_fr, unite_ar, source_fr, source_ar, notes_fr, notes_ar, annee_reference, source_feuille, ligne_debut, ligne_fin)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
            [
              ind.code, ind.titre_fr, ind.titre_ar || null, id_thematique,
              ind.unite?.fr || null, ind.unite?.ar || null,
              ind.source?.fr || null, ind.source?.ar || null,
              notesFr, ind.notes_ar || ind.notes?.ar || null,
              ind.annee_reference || null, ind.source_feuille || null,
              ind.ligne_debut || null, ind.ligne_fin || null
            ]
          );

          const tableauId = tabRes.rows[0].id;
          results.indicateurs.inserted++;

          // Insérer les indices s'il y en a
          if (ind.indices && Array.isArray(ind.indices)) {
            for (const indice of ind.indices) {
              try {
                await client.query(
                  `INSERT INTO tableaux_indices (id_tableau, code_indice, signification_fr, signification_ar, rattache_type, rattache_valeurs)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [tableauId, indice.code, indice.signification_fr || null,
                   indice.signification_ar || null, indice.rattache_type || null,
                   indice.rattache_valeurs ? JSON.stringify(indice.rattache_valeurs) : null]
                );
                results.indices.inserted++;
              } catch (err: any) {
                results.indices.errors.push(`Indice ${indice.code}: ${err.message}`);
              }
            }
          }

          // Insérer les données s'il y en a
          if (ind.entetes && ind.donnees) {
            try {
              // Convertir donnees si c'est un tableau d'objets en tableau de tableaux
              let donneesArray = ind.donnees;
              if (Array.isArray(donneesArray) && donneesArray.length > 0 && !Array.isArray(donneesArray[0])) {
                // C'est un tableau d'objets — convertir en tableau de tableaux
                // Utiliser les clés de la première ligne d'entêtes comme référence d'ordre
                const lastHeaderRow = Array.isArray(ind.entetes[0]) ? ind.entetes[0] : [];
                const keys = lastHeaderRow.map((h: any) => String(h || ''));
                donneesArray = donneesArray.map((row: any) => {
                  if (typeof row === 'object' && !Array.isArray(row)) {
                    return keys.map((key: string) => row[key] ?? '');
                  }
                  return row;
                });
              }

              await client.query(
                `INSERT INTO tableaux_data (id_tableau, entetes, donnees, merged_cells)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id_tableau) DO UPDATE SET entetes = $2, donnees = $3, merged_cells = $4, updated_at = NOW()`,
                [tableauId, JSON.stringify(ind.entetes), JSON.stringify(donneesArray), ind.merged_cells ? JSON.stringify(ind.merged_cells) : null]
              );
              results.data.inserted++;
            } catch (err: any) {
              results.data.errors.push(`Data pour ${ind.code}: ${err.message}`);
            }
          }
        } catch (err: any) {
          results.indicateurs.errors.push(`Indicateur ${ind.code}: ${err.message}`);
        }
      }
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `Type inconnu: ${type}. Utilisez "metadata" ou "indicateur".` });
      return;
    }

    await client.query('COMMIT');
    res.json({ results });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ADMIN] Erreur import:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'import' });
  } finally {
    client.release();
  }
});

export default router;
