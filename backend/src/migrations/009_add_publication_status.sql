-- Migration 009: Ajouter un statut de publication aux tableaux et annuaires
-- Permet à l'administrateur de publier ou masquer des éléments du front public.

-- Statut pour les tableaux: 'published' (visible), 'hidden' (masqué)
ALTER TABLE tableaux
  ADD COLUMN IF NOT EXISTS statut VARCHAR(20) DEFAULT 'published' NOT NULL;

-- Statut pour les annuaires: 'published' (visible), 'hidden' (masqué)
ALTER TABLE annuaires
  ADD COLUMN IF NOT EXISTS statut VARCHAR(20) DEFAULT 'published' NOT NULL;

-- Index pour filtrer rapidement par statut
CREATE INDEX IF NOT EXISTS idx_tableaux_statut ON tableaux(statut);
CREATE INDEX IF NOT EXISTS idx_annuaires_statut ON annuaires(statut);

COMMENT ON COLUMN tableaux.statut IS 'Statut de publication: published (visible au front) ou hidden (masqué)';
COMMENT ON COLUMN annuaires.statut IS 'Statut de publication: published (visible au front) ou hidden (masqué)';

-- Recréer la vue v_tableaux_complets pour inclure la colonne statut
DROP VIEW IF EXISTS v_tableaux_complets;
CREATE VIEW v_tableaux_complets AS
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
  a.annee AS annuaire_annee,
  t.statut
FROM tableaux t
JOIN thematiques th ON t.id_thematique = th.id
JOIN annuaires a ON th.id_annuaire = a.id;
