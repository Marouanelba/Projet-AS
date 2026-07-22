-- Table pour stocker les résultats de fusion entre indicateurs liés
CREATE TABLE public.indicateurs_fusion (
    id SERIAL PRIMARY KEY,
    id_liaison INTEGER NOT NULL REFERENCES public.indicateurs_liaisons(id) ON DELETE CASCADE,
    strategie VARCHAR(50) NOT NULL CHECK (strategie IN ('dernier_tableau', 'dimension_annee', 'mise_a_jour_colonne')),
    colonne_selectionnee VARCHAR(255), -- Nom de la colonne sélectionnée pour dimension_annee ou mise_a_jour_colonne
    donnees_fusionnees JSONB NOT NULL, -- Tableau de données résultant de la fusion
    entetes_fusionnees JSONB NOT NULL, -- Entêtes du tableau fusionné
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(id_liaison)
);

-- Enable RLS
ALTER TABLE public.indicateurs_fusion ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Lecture publique fusion" ON public.indicateurs_fusion
FOR SELECT USING (true);

CREATE POLICY "Insert auth fusion" ON public.indicateurs_fusion
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Update auth fusion" ON public.indicateurs_fusion
FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Delete auth fusion" ON public.indicateurs_fusion
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Trigger pour updated_at
CREATE TRIGGER update_indicateurs_fusion_updated_at
BEFORE UPDATE ON public.indicateurs_fusion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Index pour performance
CREATE INDEX idx_indicateurs_fusion_liaison ON public.indicateurs_fusion(id_liaison);

COMMENT ON TABLE public.indicateurs_fusion IS 'Stocke les résultats de fusion des indicateurs liés avec différentes stratégies';
COMMENT ON COLUMN public.indicateurs_fusion.strategie IS 'dernier_tableau: affiche simplement le dernier, dimension_annee: ajoute colonnes années, mise_a_jour_colonne: remplace/ajoute une colonne';