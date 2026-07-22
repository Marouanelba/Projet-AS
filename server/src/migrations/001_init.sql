-- Migration 001: Schéma complet de la base AS
-- Exécuter ce script sur la base "AS" dans PostgreSQL

-- Extension pour la recherche par similarité (trigrams)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TABLE: users (authentification locale)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE: annuaires
-- ============================================================
CREATE TABLE IF NOT EXISTS annuaires (
  id SERIAL PRIMARY KEY,
  annee VARCHAR(10) NOT NULL,
  titre_fr VARCHAR(500),
  titre_ar VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE: thematiques
-- ============================================================
CREATE TABLE IF NOT EXISTS thematiques (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  nom_fr VARCHAR(500) NOT NULL,
  nom_ar VARCHAR(500),
  id_annuaire INTEGER NOT NULL REFERENCES annuaires(id) ON DELETE CASCADE,
  nb_indicateurs INTEGER,
  fichier_source VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thematiques_annuaire ON thematiques(id_annuaire);

-- ============================================================
-- TABLE: tableaux
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  titre_fr VARCHAR(1000) NOT NULL,
  titre_ar VARCHAR(1000),
  id_thematique INTEGER NOT NULL REFERENCES thematiques(id) ON DELETE CASCADE,
  unite_fr VARCHAR(500),
  unite_ar VARCHAR(500),
  source_fr VARCHAR(1000),
  source_ar VARCHAR(1000),
  notes_fr TEXT,
  notes_ar TEXT,
  annee_reference VARCHAR(50),
  source_feuille VARCHAR(500),
  ligne_debut INTEGER,
  ligne_fin INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tableaux_thematique ON tableaux(id_thematique);
CREATE INDEX IF NOT EXISTS idx_tableaux_code ON tableaux(code);
-- Index trigram pour la recherche par similarité
CREATE INDEX IF NOT EXISTS idx_tableaux_titre_trgm ON tableaux USING GIN (titre_fr gin_trgm_ops);

-- ============================================================
-- TABLE: tableaux_data
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux_data (
  id SERIAL PRIMARY KEY,
  id_tableau INTEGER NOT NULL UNIQUE REFERENCES tableaux(id) ON DELETE CASCADE,
  entetes JSONB NOT NULL,
  donnees JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tableaux_data_tableau ON tableaux_data(id_tableau);

-- ============================================================
-- TABLE: tableaux_indices
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux_indices (
  id SERIAL PRIMARY KEY,
  id_tableau INTEGER NOT NULL REFERENCES tableaux(id) ON DELETE CASCADE,
  code_indice VARCHAR(50) NOT NULL,
  signification_fr VARCHAR(1000),
  signification_ar VARCHAR(1000),
  rattache_type VARCHAR(100),
  rattache_valeurs JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tableaux_indices_tableau ON tableaux_indices(id_tableau);

-- ============================================================
-- TABLE: tableaux_liaisons
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux_liaisons (
  id SERIAL PRIMARY KEY,
  id_tableau_source INTEGER NOT NULL REFERENCES tableaux(id) ON DELETE CASCADE,
  id_tableau_cible INTEGER NOT NULL REFERENCES tableaux(id) ON DELETE CASCADE,
  type_liaison VARCHAR(50) NOT NULL,
  confiance NUMERIC(5,2),
  methode_liaison VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liaisons_source ON tableaux_liaisons(id_tableau_source);
CREATE INDEX IF NOT EXISTS idx_liaisons_cible ON tableaux_liaisons(id_tableau_cible);

-- ============================================================
-- TABLE: tableaux_fusion
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux_fusion (
  id SERIAL PRIMARY KEY,
  id_liaison INTEGER NOT NULL UNIQUE REFERENCES tableaux_liaisons(id) ON DELETE CASCADE,
  strategie VARCHAR(100) NOT NULL,
  colonne_selectionnee VARCHAR(255),
  entetes_fusionnees JSONB NOT NULL,
  donnees_fusionnees JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_liaison ON tableaux_fusion(id_liaison);

-- ============================================================
-- TABLE: tableaux_ruptures
-- ============================================================
CREATE TABLE IF NOT EXISTS tableaux_ruptures (
  id SERIAL PRIMARY KEY,
  id_tableau INTEGER NOT NULL REFERENCES tableaux(id) ON DELETE CASCADE,
  annee_rupture VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ruptures_tableau ON tableaux_ruptures(id_tableau);

-- ============================================================
-- VUE: v_tableaux_complets
-- ============================================================
CREATE OR REPLACE VIEW v_tableaux_complets AS
SELECT
  t.id,
  t.code,
  t.titre_fr,
  t.titre_ar,
  t.unite_fr,
  t.unite_ar,
  t.source_fr,
  t.source_ar,
  t.notes_fr,
  t.notes_ar,
  th.id AS thematique_id,
  th.code AS thematique_code,
  th.nom_fr AS thematique_nom,
  a.id AS annuaire_id,
  a.annee AS annuaire_annee
FROM tableaux t
JOIN thematiques th ON t.id_thematique = th.id
JOIN annuaires a ON th.id_annuaire = a.id;

-- ============================================================
-- VUE: v_series_temporelles
-- ============================================================
CREATE OR REPLACE VIEW v_series_temporelles AS
SELECT
  l.id AS liaison_id,
  l.type_liaison,
  l.confiance,
  l.methode_liaison,
  ts.id AS source_id,
  ts.code AS source_code,
  ts.titre_fr AS source_titre,
  as_src.annee AS source_annee,
  tc.id AS cible_id,
  tc.code AS cible_code,
  tc.titre_fr AS cible_titre,
  as_cib.annee AS cible_annee
FROM tableaux_liaisons l
JOIN tableaux ts ON l.id_tableau_source = ts.id
JOIN thematiques th_src ON ts.id_thematique = th_src.id
JOIN annuaires as_src ON th_src.id_annuaire = as_src.id
JOIN tableaux tc ON l.id_tableau_cible = tc.id
JOIN thematiques th_cib ON tc.id_thematique = th_cib.id
JOIN annuaires as_cib ON th_cib.id_annuaire = as_cib.id;

-- ============================================================
-- VUE: v_tableaux_sans_liaison
-- ============================================================
CREATE OR REPLACE VIEW v_tableaux_sans_liaison AS
SELECT
  t.id,
  t.code,
  t.titre_fr,
  a.annee,
  th.nom_fr AS thematique
FROM tableaux t
JOIN thematiques th ON t.id_thematique = th.id
JOIN annuaires a ON th.id_annuaire = a.id
WHERE t.id NOT IN (
  SELECT id_tableau_source FROM tableaux_liaisons
  UNION
  SELECT id_tableau_cible FROM tableaux_liaisons
);

-- ============================================================
-- FONCTION: find_similar_tableaux
-- Recherche des tableaux similaires par titre via pg_trgm
-- ============================================================
CREATE OR REPLACE FUNCTION find_similar_tableaux(
  p_tableau_id INTEGER,
  p_seuil NUMERIC DEFAULT 0.4
)
RETURNS TABLE(
  id INTEGER,
  code VARCHAR,
  titre_fr VARCHAR,
  annee VARCHAR,
  thematique VARCHAR,
  similarite NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_titre VARCHAR;
BEGIN
  -- Récupérer le titre du tableau source
  SELECT t.titre_fr INTO v_titre
  FROM tableaux t
  WHERE t.id = p_tableau_id;

  IF v_titre IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    tab.id,
    tab.code,
    tab.titre_fr,
    a.annee,
    th.nom_fr AS thematique,
    ROUND(similarity(tab.titre_fr, v_titre)::NUMERIC, 3) AS similarite
  FROM tableaux tab
  JOIN thematiques th ON tab.id_thematique = th.id
  JOIN annuaires a ON th.id_annuaire = a.id
  WHERE tab.id != p_tableau_id
    AND similarity(tab.titre_fr, v_titre) >= p_seuil
  ORDER BY similarite DESC
  LIMIT 50;
END;
$$;

-- ============================================================
-- FONCTION: get_serie_temporelle
-- Récupère la série temporelle d'un tableau donné
-- ============================================================
CREATE OR REPLACE FUNCTION get_serie_temporelle(p_tableau_id INTEGER)
RETURNS TABLE(
  id INTEGER,
  code VARCHAR,
  titre_fr VARCHAR,
  annee VARCHAR,
  donnees JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE serie AS (
    -- Point de départ
    SELECT t.id AS tab_id
    FROM tableaux t
    WHERE t.id = p_tableau_id

    UNION

    -- Suivre les liaisons dans les deux sens
    SELECT
      CASE
        WHEN l.id_tableau_source = s.tab_id THEN l.id_tableau_cible
        ELSE l.id_tableau_source
      END AS tab_id
    FROM serie s
    JOIN tableaux_liaisons l ON l.id_tableau_source = s.tab_id OR l.id_tableau_cible = s.tab_id
  )
  SELECT
    t.id,
    t.code,
    t.titre_fr,
    a.annee,
    td.donnees
  FROM serie s
  JOIN tableaux t ON t.id = s.tab_id
  JOIN thematiques th ON t.id_thematique = th.id
  JOIN annuaires a ON th.id_annuaire = a.id
  LEFT JOIN tableaux_data td ON td.id_tableau = t.id
  ORDER BY a.annee DESC;
END;
$$;
