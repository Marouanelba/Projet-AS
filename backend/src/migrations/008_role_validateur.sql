-- Migration 008 : rôle « validateur »
--
-- La validation des corrections (approuver / rejeter) était réservée au rôle
-- admin. Elle passe à un rôle dédié : l'administrateur gère les données et les
-- imports, le validateur arbitre les corrections proposées par les correcteurs.
-- Les deux fonctions sont ainsi séparées.
--
-- users.role est un VARCHAR(50) sans contrainte : rien n'empêchait d'écrire
-- « validateurs » ou « Validateur » et de créer un compte silencieusement privé
-- de tout accès. La contrainte ci-dessous ferme cette porte.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'correcteur', 'validateur'));
