import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Retour à la page précédente.
 *
 * Les boutons « Retour » pointaient vers une destination fixe ("/",
 * "/indicateurs"…) : en descendant Accueil → famille → thématique → tableau,
 * le retour renvoyait à la page de départ au lieu de remonter d'un cran.
 *
 * `repli` sert quand il n'y a pas d'historique applicatif — URL ouverte
 * directement, nouvel onglet, lien partagé : navigate(-1) ferait sinon sortir
 * du site. React Router renseigne `history.state.idx`, qui vaut 0 sur la
 * première entrée de l'historique.
 */
export const useRetour = (repli = '/') => {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(repli, { replace: true });
  }, [navigate, repli]);
};
