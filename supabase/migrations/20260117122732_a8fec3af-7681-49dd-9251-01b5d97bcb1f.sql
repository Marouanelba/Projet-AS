-- Supprimer l'ancienne contrainte
ALTER TABLE public.indicateurs_fusion DROP CONSTRAINT indicateurs_fusion_strategie_check;

-- Recréer la contrainte avec la nouvelle valeur
ALTER TABLE public.indicateurs_fusion ADD CONSTRAINT indicateurs_fusion_strategie_check 
CHECK (strategie IN ('dernier_tableau', 'dimension_annee', 'mise_a_jour_colonne', 'colonnes_selectionnees', 'extension_horizontale'));