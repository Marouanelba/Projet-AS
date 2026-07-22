CREATE OR REPLACE FUNCTION public.get_serie_temporelle(p_tableau_id integer)
 RETURNS TABLE(id integer, code character varying, titre_fr text, annee character varying, donnees jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE serie AS (
        SELECT tb.id, tb.code, tb.titre_fr, a.annee, d.donnees
        FROM tableaux tb
        JOIN thematiques t ON tb.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN tableaux_data d ON tb.id = d.id_tableau
        WHERE tb.id = p_tableau_id

        UNION

        SELECT tb.id, tb.code, tb.titre_fr, a.annee, d.donnees
        FROM serie s
        JOIN tableaux_liaisons l ON s.id = l.id_tableau_source OR s.id = l.id_tableau_cible
        JOIN tableaux tb ON (tb.id = l.id_tableau_cible OR tb.id = l.id_tableau_source) AND tb.id != s.id
        JOIN thematiques t ON tb.id_thematique = t.id
        JOIN annuaires a ON t.id_annuaire = a.id
        LEFT JOIN tableaux_data d ON tb.id = d.id_tableau
        WHERE l.type_liaison IN ('serie_temporelle','extension_horizontale','fusionne')
    )
    SELECT DISTINCT serie.id, serie.code, serie.titre_fr, serie.annee, serie.donnees
    FROM serie
    ORDER BY annee DESC;
END;
$function$;