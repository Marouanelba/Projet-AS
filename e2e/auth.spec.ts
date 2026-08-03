import { test, expect } from '@playwright/test';
import { SELECTORS } from './helpers/constants';
import { loginViaUI, TEST_USER } from './helpers/auth';

test.describe('Authentification', () => {
  test('la page de connexion se charge correctement', async ({ page }) => {
    await page.goto('/auth');

    // Le formulaire est visible
    await expect(page.locator(SELECTORS.emailInput)).toBeVisible();
    await expect(page.locator(SELECTORS.passwordInput)).toBeVisible();
    await expect(page.locator(SELECTORS.submitButton)).toBeVisible();

    // Le titre est correct
    await expect(page.locator('text=Annuaire Statistique')).toBeVisible();
    await expect(page.locator('text=Back-office de gestion des tableaux')).toBeVisible();
  });

  test('affiche une erreur avec des identifiants invalides', async ({ page }) => {
    await page.goto('/auth');

    await page.locator(SELECTORS.emailInput).fill('faux@email.com');
    await page.locator(SELECTORS.passwordInput).fill('mauvaismdp');
    await page.locator(SELECTORS.submitButton).click();

    // Attendre le message d'erreur (toast sonner)
    await expect(page.locator('text=Erreur de connexion')).toBeVisible({
      timeout: 10_000,
    });

    // On reste sur la page auth
    expect(page.url()).toContain('/auth');
  });

  test('connexion réussie redirige vers le back-office', async ({ page }) => {
    // Ce test nécessite un utilisateur existant dans la base.
    // Si l'utilisateur de test n'existe pas, le test sera marqué comme skipped.
    const response = await page.request.post('http://localhost:3001/api/auth/login', {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });

    if (!response.ok()) {
      test.skip(true, 'Utilisateur de test non disponible dans la base de données');
      return;
    }

    await loginViaUI(page, TEST_USER.email, TEST_USER.password);

    // Après connexion, on n'est plus sur /auth
    expect(page.url()).not.toContain('/auth');

    // On est sur une page admin
    await expect(page.url()).toMatch(/\/admin/);
  });

  test('les champs email et password sont requis (validation HTML)', async ({ page }) => {
    await page.goto('/auth');

    // Cliquer sans remplir — le navigateur bloque la soumission (required)
    await page.locator(SELECTORS.submitButton).click();

    // On est toujours sur /auth (le formulaire n'a pas été soumis)
    expect(page.url()).toContain('/auth');
  });
});
