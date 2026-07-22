-- =============================================================================
-- MIGRATION: Renommer indicateurs → tableaux (CORRIGÉE)
-- =============================================================================

-- 1. Supprimer les vues existantes (elles référencent les anciennes tables)
DROP VIEW IF EXISTS v_indicateurs_complets;
DROP VIEW IF EXISTS v_indicateurs_sans_liaison;
DROP VIEW IF EXISTS v_series_temporelles;

-- 2. Supprimer les fonctions existantes
DROP FUNCTION IF EXISTS find_similar_indicators(integer, real);
DROP FUNCTION IF EXISTS get_serie_temporelle(integer);

-- 3. Renommer les tables
ALTER TABLE indicateurs_fusion RENAME TO tableaux_fusion;
ALTER TABLE indicateurs_ruptures RENAME TO tableaux_ruptures;
ALTER TABLE indicateurs_liaisons RENAME TO tableaux_liaisons;
ALTER TABLE indicateurs_indices RENAME TO tableaux_indices;
ALTER TABLE indicateurs_data RENAME TO tableaux_data;
ALTER TABLE indicateurs RENAME TO tableaux;

-- 4. Renommer les colonnes de clés étrangères
ALTER TABLE tableaux_liaisons RENAME COLUMN id_indicateur_source TO id_tableau_source;
ALTER TABLE tableaux_liaisons RENAME COLUMN id_indicateur_cible TO id_tableau_cible;
ALTER TABLE tableaux_indices RENAME COLUMN id_indicateur TO id_tableau;
ALTER TABLE tableaux_data RENAME COLUMN id_indicateur TO id_tableau;
ALTER TABLE tableaux_ruptures RENAME COLUMN id_indicateur TO id_tableau;

-- 5. Renommer les index
ALTER INDEX IF EXISTS idx_indicateurs_thematique RENAME TO idx_tableaux_thematique;
ALTER INDEX IF EXISTS idx_indicateurs_code RENAME TO idx_tableaux_code;
ALTER INDEX IF EXISTS idx_indicateurs_titre_fr RENAME TO idx_tableaux_titre_fr;
ALTER INDEX IF EXISTS idx_indices_indicateur RENAME TO idx_indices_tableau;
ALTER INDEX IF EXISTS idx_data_indicateur RENAME TO idx_data_tableau;
ALTER INDEX IF EXISTS idx_indicateurs_fusion_liaison RENAME TO idx_tableaux_fusion_liaison;

-- 6. Renommer les triggers
DROP TRIGGER IF EXISTS update_indicateurs_fusion_updated_at ON tableaux_fusion;
CREATE TRIGGER update_tableaux_fusion_updated_at
BEFORE UPDATE ON tableaux_fusion
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 7. Recréer les vues avec les nouveaux noms
CREATE OR REPLACE VIEW v_tableaux_complets AS
SELECT 
    a.id AS annuaire_id,
    t.id AS thematique_id,
    tb.id,
    tb.code,
    tb.titre_fr,
    tb.titre_ar,
    tb.unite_fr,
    tb.unite_ar,
    tb.source_fr,
    tb.source_ar,
    tb.notes_fr,
    tb.notes_ar,
    t.code AS thematique_code,
    t.nom_fr AS thematique_nom,
    a.annee AS annuaire_annee
FROM tableaux tb
JOIN thematiques t ON tb.id_thematique = t.id
JOIN annuaires a ON t.id_annuaire = a.id;

CREATE OR REPLACE VIEW v_tableaux_sans_liaison AS
SELECT 
    tb.id,
    tb.code,
    tb.titre_fr,
    a.annee,
    t.nom_fr AS thematique
FROM tableaux tb
JOIN thematiques t ON tb.id_thematique = t.id
JOIN annuaires a ON t.id_annuaire = a.id
WHERE NOT EXISTS (
    SELECT 1 FROM tableaux_liaisons l 
    WHERE l.id_tableau_source = tb.id OR l.id_tableau_cible = tb.id
);

CREATE OR REPLACE VIEW v_series_temporelles AS
SELECT 
    l.id AS liaison_id,
    l.type_liaison,
    l.methode_liaison,
    l.confiance,
    src.id AS source_id,
    src.code AS source_code,
    src.titre_fr AS source_titre,
    a_src.annee AS source_annee,
    cib.id AS cible_id,
    cib.code AS cible_code,
    cib.titre_fr AS cible_titre,
    a_cib.annee AS cible_annee
FROM tableaux_liaisons l
JOIN tableaux src ON l.id_tableau_source = src.id
JOIN thematiques t_src ON src.id_thematique = t_src.id
JOIN annuaires a_src ON t_src.id_annuaire = a_src.id
JOIN tableaux cib ON l.id_tableau_cible = cib.id
JOIN thematiques t_cib ON cib.id_thematique = t_cib.id
JOIN annuaires a_cib ON t_cib.id_annuaire = a_cib.id;

-- 8. Recréer les fonctions avec les nouveaux noms
CREATE OR REPLACE FUNCTION find_similar_tableaux(p_tableau_id INTEGER, p_seuil REAL DEFAULT 0.3)
RETURNS TABLE(id INTEGER, code VARCHAR, titre_fr TEXT, annee VARCHAR, thematique VARCHAR, similarite REAL)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tb2.id,
        tb2.code,
        tb2.titre_fr,
        a2.annee,
        t2.nom_fr,
        similarity(tb1.titre_fr, tb2.titre_fr) AS similarite
    FROM tableaux tb1
    JOIN tableaux tb2 ON tb1.id != tb2.id
    JOIN thematiques t1 ON tb1.id_thematique = t1.id
    JOIN thematiques t2 ON tb2.id_thematique = t2.id
    JOIN annuaires a1 ON t1.id_annuaire = a1.id
    JOIN annuaires a2 ON t2.id_annuaire = a2.id
    WHERE tb1.id = p_tableau_id
      AND a1.annee != a2.annee
      AND similarity(tb1.titre_fr, tb2.titre_fr) >= p_seuil
    ORDER BY similarite DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_serie_temporelle(p_tableau_id INTEGER)
RETURNS TABLE(id INTEGER, code VARCHAR, titre_fr TEXT, annee VARCHAR, donnees JSONB)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE serie AS (
        SELECT tb.id, tb.code, tb.titre_fr, a.annee, d.donnees
        FROM tableaux tb
        JOIN thematiques t ON tb.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN tableaux_data d ON tb.id = d.id_tableau
        WHERE tb.id = p_tableau_id
        
        UNION
        
        SELECT tb.id, tb.code, tb.titre_fr, a.annee, d.donnees
        FROM serie s
        JOIN tableaux_liaisons l ON s.id = l.id_tableau_source OR s.id = l.id_tableau_cible
        JOIN tableaux tb ON (tb.id = l.id_tableau_cible OR tb.id = l.id_tableau_source) AND tb.id != s.id
        JOIN thematiques t ON tb.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN tableaux_data d ON tb.id = d.id_tableau
        WHERE l.type_liaison = 'serie_temporelle'
    )
    SELECT DISTINCT serie.id, serie.code, serie.titre_fr, serie.annee, serie.donnees
    FROM serie
    ORDER BY annee DESC;
END;
$$;

-- 9. Ajouter des commentaires
COMMENT ON TABLE tableaux IS 'Métadonnées des tableaux statistiques (titre, code, source, notes)';
COMMENT ON TABLE tableaux_data IS 'Données tabulaires des tableaux (entetes + donnees en JSON)';
COMMENT ON TABLE tableaux_indices IS 'Légendes des indices (1), (2), etc.';
COMMENT ON TABLE tableaux_liaisons IS 'Liens entre tableaux de différentes années';
COMMENT ON TABLE tableaux_fusion IS 'Données fusionnées pour les liaisons configurées';
COMMENT ON TABLE tableaux_ruptures IS 'Marques de discontinuité temporelle';
COMMENT ON VIEW v_tableaux_complets IS 'Vue des tableaux avec infos thématique et annuaire';
COMMENT ON VIEW v_tableaux_sans_liaison IS 'Vue des tableaux sans liaison temporelle';
COMMENT ON VIEW v_series_temporelles IS 'Vue des séries temporelles avec détails source et cible';