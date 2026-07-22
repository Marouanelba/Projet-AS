-- Supprimer les valeurs par défaut sur titre_fr et titre_ar
ALTER TABLE public.annuaires ALTER COLUMN titre_fr DROP DEFAULT;
ALTER TABLE public.annuaires ALTER COLUMN titre_ar DROP DEFAULT;