import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

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
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      res.status(400).json({ error: 'type et data requis' });
      return;
    }

    const results = {
      type,
      annuaires: { inserted: 0, errors: [] as string[] },
      thematiques: { inserted: 0, errors: [] as string[] },
      indicateurs: { inserted: 0, errors: [] as string[] },
      indices: { inserted: 0, errors: [] as string[] },
      data: { inserted: 0, errors: [] as string[] },
    };

    if (type === 'metadata') {
      // Import des métadonnées (annuaires + thématiques)
      const annuaires = data.annuaires || [];

      for (const annuaire of annuaires) {
        try {
          // Upsert annuaire
          const annRes = await pool.query(
            `INSERT INTO annuaires (annee, titre_fr, titre_ar)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO NOTHING
             RETURNING id`,
            [annuaire.annee, annuaire.titre_fr || null, annuaire.titre_ar || null]
          );

          let annuaireId: number;
          if (annRes.rows.length > 0) {
            annuaireId = annRes.rows[0].id;
            results.annuaires.inserted++;
          } else {
            // Récupérer l'ID existant
            const existing = await pool.query(
              'SELECT id FROM annuaires WHERE annee = $1',
              [annuaire.annee]
            );
            annuaireId = existing.rows[0]?.id;
            if (!annuaireId) {
              results.annuaires.errors.push(`Annuaire ${annuaire.annee}: impossible de récupérer l'ID`);
              continue;
            }
          }

          // Import des thématiques de cet annuaire
          const thematiques = annuaire.thematiques || [];
          for (const them of thematiques) {
            try {
              // Vérifier si la thématique existe déjà pour cet annuaire
              const existingThem = await pool.query(
                'SELECT id FROM thematiques WHERE id_annuaire = $1 AND code = $2',
                [annuaireId, them.code]
              );

              if (existingThem.rows.length > 0) {
                // Mise à jour de la thématique existante
                await pool.query(
                  `UPDATE thematiques 
                   SET nom_fr = $1, nb_indicateurs = $2, fichier_source = $3, updated_at = NOW()
                   WHERE id = $4`,
                  [them.nom || them.nom_fr, them.nb_indicateurs || null, them.fichier_source || null, existingThem.rows[0].id]
                );
                results.thematiques.inserted++; // On comptabilise comme mis à jour/inséré
              } else {
                // Insertion si elle n'existe pas
                await pool.query(
                  `INSERT INTO thematiques (code, nom_fr, nom_ar, id_annuaire, nb_indicateurs, fichier_source)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [them.code, them.nom || them.nom_fr, them.nom_ar || null,
                   annuaireId, them.nb_indicateurs || null, them.fichier_source || null]
                );
                results.thematiques.inserted++;
              }
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
            const annee = t.annuaire_annee || item.annuaire_annee || "2025";
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

      for (const ind of indicateurs) {
        try {
          // Trouver la thématique par code + annee
          const themRes = await pool.query(
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
          const tabRes = await pool.query(
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
                await pool.query(
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

              await pool.query(
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
      res.status(400).json({ error: `Type inconnu: ${type}. Utilisez "metadata" ou "indicateur".` });
      return;
    }

    res.json({ results });
  } catch (error) {
    console.error('[ADMIN] Erreur import:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'import' });
  }
});

export default router;
