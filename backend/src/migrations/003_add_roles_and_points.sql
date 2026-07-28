-- Migration 003: Gestion des rôles, points et statut des corrections

-- 1. Ajouter la colonne role dans users (valeurs possibles: 'admin', 'correcteur')
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'correcteur';

-- 2. Ajouter la colonne points dans users pour les correcteurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- 3. Ajouter la colonne status dans tableaux_corrections ('pending', 'approved', 'rejected')
ALTER TABLE tableaux_corrections ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- 4. S'assurer que l'utilisateur admin a le rôle admin
UPDATE users SET role = 'admin' WHERE email = 'admin@hcp.ma';
