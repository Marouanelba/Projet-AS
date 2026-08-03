import { Page } from '@playwright/test';

/**
 * Identifiants de test — à adapter selon ton environnement.
 * Idéalement, crée un utilisateur de test dédié dans ta base de données.
 */
export const TEST_USER = {
  email: 'test@example.com',
  password: 'test123456',
};

export const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123456',
};

/**
 * Se connecter via l'interface (formulaire de login).
 * Utilise cette fonction dans les tests qui vérifient le parcours de connexion.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.locator('#email-signin').fill(email);
  await page.locator('#password-signin').fill(password);
  await page.locator('button[type="submit"]').click();
  
  // Attendre la redirection après connexion
  await page.waitForURL((url) => !url.pathname.includes('/auth'), {
    timeout: 10_000,
  });
}

/**
 * Se connecter via l'API directement et injecter le token dans le localStorage.
 * Plus rapide que loginViaUI — utilise ceci pour les tests qui ont besoin
 * d'un utilisateur connecté sans tester le formulaire lui-même.
 */
export async function loginViaAPI(page: Page, email: string, password: string) {
  const API_URL = 'http://localhost:3001';

  // Appeler l'API de login
  const response = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login API failed: ${response.status()} ${await response.text()}`);
  }

  const { token, user } = await response.json();

  // Injecter le token dans le localStorage du frontend
  await page.goto('/');
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user }
  );

  // Recharger pour que l'app React prenne en compte le token
  await page.reload();
}

/**
 * Se déconnecter en nettoyant le localStorage.
 */
export async function logout(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
  await page.reload();
}
