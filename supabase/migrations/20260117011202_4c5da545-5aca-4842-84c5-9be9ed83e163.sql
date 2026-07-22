-- Drop the old check constraint and add a new one with 'colonnes_selectionnees' allowed
ALTER TABLE public.indicateurs_fusion 
DROP CONSTRAINT indicateurs_fusion_strategie_check;

ALTER TABLE public.indicateurs_fusion 
ADD CONSTRAINT indicateurs_fusion_strategie_check 
CHECK (strategie IN ('dernier_tableau', 'dimension_annee', 'mise_a_jour_colonne', 'colonnes_selectionnees'));