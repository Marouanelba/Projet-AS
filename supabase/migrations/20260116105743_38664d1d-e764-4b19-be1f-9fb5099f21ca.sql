
-- Modifier la fonction pour ne plus filtrer par code de thématique
-- car les codes varient entre annuaires (ex: "1" en 2019, "2" en 2020)
CREATE OR REPLACE FUNCTION public.find_similar_indicators(p_indicateur_id integer, p_seuil real DEFAULT 0.3)
RETURNS TABLE(id integer, code character varying, titre_fr text, annee character varying, thematique character varying, similarite real)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        i2.id,
        i2.code,
        i2.titre_fr,
        a2.annee,
        t2.nom_fr,
        similarity(i1.titre_fr, i2.titre_fr) AS similarite
    FROM indicateurs i1
    JOIN indicateurs i2 ON i1.id != i2.id
    JOIN thematiques t1 ON i1.id_thematique = t1.id
    JOIN thematiques t2 ON i2.id_thematique = t2.id
    JOIN annuaires a1 ON t1.id_annuaire = a1.id
    JOIN annuaires a2 ON t2.id_annuaire = a2.id
    WHERE i1.id = p_indicateur_id
      AND a1.annee != a2.annee  -- Seulement d'autres années
      AND similarity(i1.titre_fr, i2.titre_fr) >= p_seuil
    ORDER BY similarite DESC;
END;
$function$;
