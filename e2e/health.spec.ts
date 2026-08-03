import { test, expect } from '@playwright/test';
import { API_BASE_URL } from './helpers/constants';

test.describe('Health Check', () => {
  test('le backend API répond correctement', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('le frontend se charge sans erreur', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Vérifie que le titre principal (h1) est visible
    await expect(page.getByRole('heading', { name: 'Annuaire Statistique', exact: true })).toBeVisible();
  });
});
