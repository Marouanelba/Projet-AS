-- Migration 004: Ajouter snapshot_before pour la reconstitution de l'état exact du tableau
-- avant chaque correction (utile pour la visualisation admin étape par étape)

ALTER TABLE tableaux_corrections
  ADD COLUMN IF NOT EXISTS snapshot_before JSONB DEFAULT NULL;

COMMENT ON COLUMN tableaux_corrections.snapshot_before IS
  'Snapshot JSON de {entetes, donnees, merged_cells, titre_fr, titre_ar, unite_fr, unite_ar, notes_fr, notes_ar} pris immédiatement AVANT cette correction';
