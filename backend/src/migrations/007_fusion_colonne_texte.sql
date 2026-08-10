-- Migration 005 : tableaux_fusion.colonne_selectionnee en TEXT
--
-- POST /api/fusion renvoyait un 500 dès qu'on validait une fusion par
-- sélection de colonnes. La colonne était en VARCHAR(255), mais
-- ColumnSelectionModal y écrit le JSON des colonnes retenues :
--   [{"source":"source","originalIndex":0,"name":"…","annee":"1985"}, …]
-- soit environ 80 caractères par colonne. Dès 4 colonnes on dépasse 255 et
-- Postgres rejette (22001, « valeur trop longue »).
--
-- Le champ est traité comme une chaîne libre par tout le code (nom de colonne
-- simple dans HorizontalExtensionModal, JSON dans ColumnSelectionModal), donc
-- TEXT plutôt que jsonb : aucune modification applicative nécessaire.

ALTER TABLE tableaux_fusion
  ALTER COLUMN colonne_selectionnee TYPE TEXT;
