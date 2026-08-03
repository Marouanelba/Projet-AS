/**
 * Constantes partagées pour les tests E2E
 */

export const API_BASE_URL = 'http://localhost:3001';
export const FRONTEND_URL = 'http://localhost:5173';

/**
 * Sélecteurs CSS réutilisables.
 * Centralise ici les sélecteurs pour éviter la duplication.
 */
export const SELECTORS = {
  // Page Auth
  emailInput: '#email-signin',
  passwordInput: '#password-signin',
  submitButton: 'button[type="submit"]',

  // Header / Navigation
  headerTitle: 'text=Annuaire Statistique',
  navTableaux: 'text=Tableaux',
  navAdmin: 'text=Administration',

  // Loading states
  spinner: '.animate-spin',
};

/**
 * Timeouts personnalisés pour certaines opérations.
 */
export const TIMEOUTS = {
  pageLoad: 15_000,
  apiCall: 10_000,
  animation: 2_000,
};
