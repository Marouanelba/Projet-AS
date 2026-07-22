-- Créer une table pour les ruptures (indicateurs volontairement non liés)
CREATE TABLE public.indicateurs_ruptures (
    id SERIAL PRIMARY KEY,
    id_indicateur INTEGER NOT NULL REFERENCES public.indicateurs(id) ON DELETE CASCADE,
    annee_rupture VARCHAR NOT NULL, -- L'année adjacente où l'indicateur n'existe pas ou a été interrompu
    direction VARCHAR NOT NULL CHECK (direction IN ('precedente', 'suivante')), -- N-1 ou N+1
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by VARCHAR,
    UNIQUE(id_indicateur, direction) -- Un indicateur ne peut avoir qu'une rupture par direction
);

-- Enable RLS
ALTER TABLE public.indicateurs_ruptures ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Lecture publique ruptures" 
ON public.indicateurs_ruptures 
FOR SELECT 
USING (true);

CREATE POLICY "Insert auth ruptures" 
ON public.indicateurs_ruptures 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Update auth ruptures" 
ON public.indicateurs_ruptures 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Delete auth ruptures" 
ON public.indicateurs_ruptures 
FOR DELETE 
USING (auth.uid() IS NOT NULL);