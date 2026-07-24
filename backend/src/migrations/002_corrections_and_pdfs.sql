-- Migration 002: Table de traçabilité des corrections et colonnes PDF pour les annuaires

-- 1. Colonnes PDF dans la table annuaires
ALTER TABLE annuaires ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(1000);
ALTER TABLE annuaires ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(1000);

-- 2. Table pour la traçabilité des corrections des tableaux
CREATE TABLE IF NOT EXISTS tableaux_corrections (
  id SERIAL PRIMARY KEY,
  id_tableau INTEGER NOT NULL REFERENCES tableaux(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_display_name VARCHAR(255),
  type_element VARCHAR(50) NOT NULL, -- 'cellule', 'titre_fr', 'titre_ar', 'unite_fr', 'unite_ar', 'notes_fr', 'notes_ar'
  row_index INTEGER,
  col_index INTEGER,
  valeur_originale TEXT,
  valeur_corrigee TEXT NOT NULL,
  commentaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_tableau ON tableaux_corrections(id_tableau);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON tableaux_corrections(created_at DESC);
