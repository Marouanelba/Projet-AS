import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableaux } from '@/lib/api';

/**
 * Hook de surveillance du statut de publication d'un tableau.
 * Vérifie toutes les 30 secondes si le tableau est toujours publié.
 * Si le statut passe à 'hidden', redirige l'utilisateur vers la page d'accueil.
 */
export function usePublicationGuard(tableauId: number | string | undefined) {
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tableauId) return;

    const checkStatut = async () => {
      try {
        const res = await tableaux.getStatut(tableauId);
        if (res.statut === 'hidden' || res.statut === 'not_found') {
          // Tableau masqué ou supprimé, rediriger
          navigate('/indicateurs', { replace: true });
        }
      } catch {
        // En cas d'erreur réseau, on ne redirige pas
      }
    };

    // Vérification initiale (après un court délai pour laisser le rendu se faire)
    const initialTimeout = setTimeout(checkStatut, 2000);

    // Polling toutes les 30 secondes
    intervalRef.current = setInterval(checkStatut, 30000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tableauId, navigate]);
}
