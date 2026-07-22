-- =============================================================================
-- CORRECTIONS DE SÉCURITÉ
-- =============================================================================

-- Corriger les vues avec security_invoker
DROP VIEW IF EXISTS v_indicateurs_complets;
DROP VIEW IF EXISTS v_series_temporelles;
DROP VIEW IF EXISTS v_indicateurs_sans_liaison;

CREATE VIEW v_indicateurs_complets 
WITH (security_invoker = true) AS
SELECT 
    i.id,
    i.code,
    i.titre_fr,
    i.titre_ar,
    i.unite_fr,
    i.unite_ar,
    i.source_fr,
    i.source_ar,
    i.notes_fr,
    i.notes_ar,
    t.code AS thematique_code,
    t.nom_fr AS thematique_nom,
    a.annee AS annuaire_annee,
    a.id AS annuaire_id,
    t.id AS thematique_id
FROM indicateurs i
JOIN thematiques t ON i.id_thematique = t.id
JOIN annuaires a ON t.id_annuaire = a.id
ORDER BY a.annee DESC, t.code, i.code;

CREATE VIEW v_series_temporelles 
WITH (security_invoker = true) AS
SELECT 
    l.id AS liaison_id,
    l.type_liaison,
    l.confiance,
    l.methode_liaison,
    i1.id AS source_id,
    i1.code AS source_code,
    i1.titre_fr AS source_titre,
    a1.annee AS source_annee,
    i2.id AS cible_id,
    i2.code AS cible_code,
    i2.titre_fr AS cible_titre,
    a2.annee AS cible_annee
FROM indicateurs_liaisons l
JOIN indicateurs i1 ON l.id_indicateur_source = i1.id
JOIN thematiques t1 ON i1.id_thematique = t1.id
JOIN annuaires a1 ON t1.id_annuaire = a1.id
JOIN indicateurs i2 ON l.id_indicateur_cible = i2.id
JOIN thematiques t2 ON i2.id_thematique = t2.id
JOIN annuaires a2 ON t2.id_annuaire = a2.id
ORDER BY a1.annee DESC, i1.code;

CREATE VIEW v_indicateurs_sans_liaison 
WITH (security_invoker = true) AS
SELECT 
    i.id,
    i.code,
    i.titre_fr,
    a.annee,
    t.nom_fr AS thematique
FROM indicateurs i
JOIN thematiques t ON i.id_thematique = t.id
JOIN annuaires a ON t.id_annuaire = a.id
WHERE i.id NOT IN (
    SELECT id_indicateur_source FROM indicateurs_liaisons
    UNION
    SELECT id_indicateur_cible FROM indicateurs_liaisons
)
ORDER BY a.annee DESC, i.code;

-- Corriger les fonctions avec search_path
CREATE OR REPLACE FUNCTION find_similar_indicators(p_indicateur_id INTEGER, p_seuil FLOAT DEFAULT 0.3)
RETURNS TABLE (
    id INTEGER,
    code VARCHAR(20),
    titre_fr TEXT,
    annee VARCHAR(4),
    thematique VARCHAR(255),
    similarite FLOAT
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i2.id,
        i2.code,
        i2.titre_fr,
        a2.annee,
        t2.nom_fr,
        similarity(i1.titre_fr, i2.titre_fr) AS similarite
    FROM indicateurs i1
    JOIN indicateurs i2 ON i1.id != i2.id
    JOIN thematiques t1 ON i1.id_thematique = t1.id
    JOIN thematiques t2 ON i2.id_thematique = t2.id
    JOIN annuaires a1 ON t1.id_annuaire = a1.id
    JOIN annuaires a2 ON t2.id_annuaire = a2.id
    WHERE i1.id = p_indicateur_id
      AND t1.code = t2.code
      AND a1.annee != a2.annee
      AND similarity(i1.titre_fr, i2.titre_fr) >= p_seuil
    ORDER BY similarite DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_serie_temporelle(p_indicateur_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    code VARCHAR(20),
    titre_fr TEXT,
    annee VARCHAR(4),
    donnees JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE serie AS (
        SELECT i.id, i.code, i.titre_fr, a.annee, d.donnees
        FROM indicateurs i
        JOIN thematiques t ON i.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN indicateurs_data d ON i.id = d.id_indicateur
        WHERE i.id = p_indicateur_id
        
        UNION
        
        SELECT i.id, i.code, i.titre_fr, a.annee, d.donnees
        FROM serie s
        JOIN indicateurs_liaisons l ON s.id = l.id_indicateur_source OR s.id = l.id_indicateur_cible
        JOIN indicateurs i ON (i.id = l.id_indicateur_cible OR i.id = l.id_indicateur_source) AND i.id != s.id
        JOIN thematiques t ON i.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN indicateurs_data d ON i.id = d.id_indicateur
        WHERE l.type_liaison = 'serie_temporelle'
    )
    SELECT DISTINCT serie.id, serie.code, serie.titre_fr, serie.annee, serie.donnees
    FROM serie
    ORDER BY annee DESC;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;