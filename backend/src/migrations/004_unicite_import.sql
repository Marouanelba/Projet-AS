-- Migration 004 : contraintes d'unicité nécessaires à un import idempotent
--
-- Contexte : POST /api/admin/import créait des doublons.
--   - annuaires : l'insert faisait ON CONFLICT (id) DO NOTHING sans fournir
--     d'id, et annee n'avait aucune contrainte — réimporter une année créait
--     un second annuaire pour cette année.
--   - thematiques : le code faisait un SELECT puis un INSERT ou UPDATE, sans
--     garantie en cas d'appels concurrents.
--
-- Volontairement PAS de contrainte sur tableaux(id_thematique, code) :
-- le code est construit à partir de table_number, qui est faux dans plusieurs
-- chapitres (881 groupes de tableaux distincts partagent un même code, par ex.
-- six tableaux « 10 - 10 » en 1993). Une unicité y fusionnerait des tableaux
-- sans rapport. Le remplacement se fait par suppression explicite, cf. le
-- mode 'replace' de la route d'import.

-- 1. Une seule ligne par année
ALTER TABLE annuaires
  DROP CONSTRAINT IF EXISTS annuaires_annee_key;
ALTER TABLE annuaires
  ADD CONSTRAINT annuaires_annee_key UNIQUE (annee);

-- 2. Un seul chapitre par (annuaire, code)
ALTER TABLE thematiques
  DROP CONSTRAINT IF EXISTS thematiques_annuaire_code_key;
ALTER TABLE thematiques
  ADD CONSTRAINT thematiques_annuaire_code_key UNIQUE (id_annuaire, code);
