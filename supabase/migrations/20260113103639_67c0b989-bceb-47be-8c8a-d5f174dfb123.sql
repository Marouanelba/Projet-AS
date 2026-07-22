-- =============================================================================
-- SCHÉMA BASE DE DONNÉES - INDICATEURS STATISTIQUES CND MAROC
-- =============================================================================

-- Activer l'extension pg_trgm pour la similarité
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- TABLE: annuaires
-- =============================================================================
CREATE TABLE annuaires (
    id SERIAL PRIMARY KEY,
    annee VARCHAR(4) NOT NULL UNIQUE,
    titre_fr VARCHAR(255) DEFAULT 'Annuaire Statistique du Maroc',
    titre_ar VARCHAR(255) DEFAULT 'الكتاب السنوي للإحصاء بالمغرب',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_annuaires_annee ON annuaires(annee);

-- =============================================================================
-- TABLE: thematiques
-- =============================================================================
CREATE TABLE thematiques (
    id SERIAL PRIMARY KEY,
    id_annuaire INTEGER NOT NULL REFERENCES annuaires(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    nom_fr VARCHAR(255) NOT NULL,
    nom_ar VARCHAR(255),
    fichier_source VARCHAR(255),
    nb_indicateurs INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(id_annuaire, code)
);

CREATE INDEX idx_thematiques_annuaire ON thematiques(id_annuaire);
CREATE INDEX idx_thematiques_code ON thematiques(code);

-- =============================================================================
-- TABLE: indicateurs
-- =============================================================================
CREATE TABLE indicateurs (
    id SERIAL PRIMARY KEY,
    id_thematique INTEGER NOT NULL REFERENCES thematiques(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    titre_fr TEXT NOT NULL,
    titre_ar TEXT,
    unite_fr VARCHAR(100),
    unite_ar VARCHAR(100),
    source_fr TEXT,
    source_ar TEXT,
    notes_fr TEXT,
    notes_ar TEXT,
    annee_reference VARCHAR(10),
    source_feuille VARCHAR(100),
    ligne_debut INTEGER,
    ligne_fin INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(id_thematique, code)
);

CREATE INDEX idx_indicateurs_thematique ON indicateurs(id_thematique);
CREATE INDEX idx_indicateurs_code ON indicateurs(code);
CREATE INDEX idx_indicateurs_titre_fr ON indicateurs USING gin(to_tsvector('french', titre_fr));

-- =============================================================================
-- TABLE: indicateurs_indices
-- =============================================================================
CREATE TABLE indicateurs_indices (
    id SERIAL PRIMARY KEY,
    id_indicateur INTEGER NOT NULL REFERENCES indicateurs(id) ON DELETE CASCADE,
    code_indice VARCHAR(10) NOT NULL,
    signification_fr TEXT,
    signification_ar TEXT,
    rattache_type VARCHAR(20),
    rattache_valeurs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(id_indicateur, code_indice)
);

CREATE INDEX idx_indices_indicateur ON indicateurs_indices(id_indicateur);

-- =============================================================================
-- TABLE: indicateurs_data
-- =============================================================================
CREATE TABLE indicateurs_data (
    id SERIAL PRIMARY KEY,
    id_indicateur INTEGER NOT NULL REFERENCES indicateurs(id) ON DELETE CASCADE UNIQUE,
    entetes JSONB NOT NULL,
    donnees JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_indicateur ON indicateurs_data(id_indicateur);

-- =============================================================================
-- TABLE: indicateurs_liaisons
-- =============================================================================
CREATE TABLE indicateurs_liaisons (
    id SERIAL PRIMARY KEY,
    id_indicateur_source INTEGER NOT NULL REFERENCES indicateurs(id) ON DELETE CASCADE,
    id_indicateur_cible INTEGER NOT NULL REFERENCES indicateurs(id) ON DELETE CASCADE,
    type_liaison VARCHAR(50) NOT NULL DEFAULT 'serie_temporelle',
    confiance INTEGER DEFAULT 100,
    methode_liaison VARCHAR(50),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(id_indicateur_source, id_indicateur_cible)
);

CREATE INDEX idx_liaisons_source ON indicateurs_liaisons(id_indicateur_source);
CREATE INDEX idx_liaisons_cible ON indicateurs_liaisons(id_indicateur_cible);
CREATE INDEX idx_liaisons_type ON indicateurs_liaisons(type_liaison);

-- =============================================================================
-- VUES
-- =============================================================================
CREATE OR REPLACE VIEW v_indicateurs_complets AS
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

CREATE OR REPLACE VIEW v_series_temporelles AS
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

CREATE OR REPLACE VIEW v_indicateurs_sans_liaison AS
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

-- =============================================================================
-- FONCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION find_similar_indicators(p_indicateur_id INTEGER, p_seuil FLOAT DEFAULT 0.3)
RETURNS TABLE (
    id INTEGER,
    code VARCHAR(20),
    titre_fr TEXT,
    annee VARCHAR(4),
    thematique VARCHAR(255),
    similarite FLOAT
) AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_serie_temporelle(p_indicateur_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    code VARCHAR(20),
    titre_fr TEXT,
    annee VARCHAR(4),
    donnees JSONB
) AS $$
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
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_annuaires_updated_at
    BEFORE UPDATE ON annuaires
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_thematiques_updated_at
    BEFORE UPDATE ON thematiques
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_indicateurs_updated_at
    BEFORE UPDATE ON indicateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_indicateurs_data_updated_at
    BEFORE UPDATE ON indicateurs_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE annuaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE thematiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateurs_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateurs_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateurs_liaisons ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "Lecture publique annuaires" ON annuaires FOR SELECT USING (true);
CREATE POLICY "Lecture publique thematiques" ON thematiques FOR SELECT USING (true);
CREATE POLICY "Lecture publique indicateurs" ON indicateurs FOR SELECT USING (true);
CREATE POLICY "Lecture publique indices" ON indicateurs_indices FOR SELECT USING (true);
CREATE POLICY "Lecture publique data" ON indicateurs_data FOR SELECT USING (true);
CREATE POLICY "Lecture publique liaisons" ON indicateurs_liaisons FOR SELECT USING (true);

-- Écriture pour utilisateurs authentifiés
CREATE POLICY "Insert auth annuaires" ON annuaires FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth annuaires" ON annuaires FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth annuaires" ON annuaires FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert auth thematiques" ON thematiques FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth thematiques" ON thematiques FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth thematiques" ON thematiques FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert auth indicateurs" ON indicateurs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth indicateurs" ON indicateurs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth indicateurs" ON indicateurs FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert auth indices" ON indicateurs_indices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth indices" ON indicateurs_indices FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth indices" ON indicateurs_indices FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert auth data" ON indicateurs_data FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth data" ON indicateurs_data FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth data" ON indicateurs_data FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert auth liaisons" ON indicateurs_liaisons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update auth liaisons" ON indicateurs_liaisons FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Delete auth liaisons" ON indicateurs_liaisons FOR DELETE USING (auth.uid() IS NOT NULL);