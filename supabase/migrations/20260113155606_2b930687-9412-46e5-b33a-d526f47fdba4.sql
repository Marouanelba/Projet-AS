-- Supprimer les anciennes politiques RESTRICTIVE et les recréer en PERMISSIVE

-- annuaires
DROP POLICY IF EXISTS "Lecture publique annuaires" ON public.annuaires;
CREATE POLICY "Lecture publique annuaires" ON public.annuaires
  FOR SELECT USING (true);

-- indicateurs
DROP POLICY IF EXISTS "Lecture publique indicateurs" ON public.indicateurs;
CREATE POLICY "Lecture publique indicateurs" ON public.indicateurs
  FOR SELECT USING (true);

-- indicateurs_data
DROP POLICY IF EXISTS "Lecture publique data" ON public.indicateurs_data;
CREATE POLICY "Lecture publique data" ON public.indicateurs_data
  FOR SELECT USING (true);

-- indicateurs_indices
DROP POLICY IF EXISTS "Lecture publique indices" ON public.indicateurs_indices;
CREATE POLICY "Lecture publique indices" ON public.indicateurs_indices
  FOR SELECT USING (true);

-- indicateurs_liaisons
DROP POLICY IF EXISTS "Lecture publique liaisons" ON public.indicateurs_liaisons;
CREATE POLICY "Lecture publique liaisons" ON public.indicateurs_liaisons
  FOR SELECT USING (true);

-- thematiques
DROP POLICY IF EXISTS "Lecture publique thematiques" ON public.thematiques;
CREATE POLICY "Lecture publique thematiques" ON public.thematiques
  FOR SELECT USING (true);