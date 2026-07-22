-- Change colonne_selectionnee from varchar(255) to TEXT to allow longer JSON strings
ALTER TABLE public.indicateurs_fusion
ALTER COLUMN colonne_selectionnee TYPE TEXT;