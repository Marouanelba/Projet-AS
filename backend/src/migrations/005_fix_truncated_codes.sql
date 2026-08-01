-- Migration 005: Corriger les codes tronqués dans la table tableaux
-- Le problème : lors de l'import, certains codes ont été mal extraits (ex: "5 - 2" au lieu de "5 - 22")
-- Solution : re-extraire le code depuis le titre_fr quand le titre commence par un pattern "X - Y"

-- Étape 1 : Mettre à jour les codes en les extrayant du titre_fr
-- Le pattern cherché dans titre_fr : "chiffres - chiffres" au début du titre
UPDATE tableaux
SET code = trim(substring(titre_fr FROM '^\s*(\d+\s*[-–]\s*\d+)'))
WHERE titre_fr ~ '^\s*\d+\s*[-–]\s*\d+'
  AND trim(substring(titre_fr FROM '^\s*(\d+\s*[-–]\s*\d+)')) IS NOT NULL
  AND trim(substring(titre_fr FROM '^\s*(\d+\s*[-–]\s*\d+)')) != code;
