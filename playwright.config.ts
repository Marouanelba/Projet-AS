import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour les tests E2E
 * 
 * Prérequis : le frontend (port 5173) et le backend (port 3001) doivent être démarrés.
 * 
 * Lancer les tests : npx playwright test
 * Lancer en mode UI : npx playwright test --ui
 * Lancer un seul fichier : npx playwright test tests/auth.spec.ts
 */
export default defineConfig({
  testDir: './e2e',
  
  /* Timeout par test */
  timeout: 30_000,
  
  /* Timeout pour les expect */
  expect: {
    timeout: 10_000,
  },

  /* Reporter */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  /* Paramètres partagés entre tous les tests */
  use: {
    /* URL de base du frontend */
    baseURL: 'http://localhost:8080',

    /* Collecter une trace en cas d'échec pour le debug */
    trace: 'on-first-retry',

    /* Screenshot en cas d'échec */
    screenshot: 'only-on-failure',

    /* Timeout pour les actions (clic, fill...) */
    actionTimeout: 10_000,
  },

  /* Projets / navigateurs */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Décommente pour tester sur d'autres navigateurs :
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  /* Serveurs web à démarrer avant les tests (optionnel) */
  /* Décommente si tu veux que Playwright démarre les serveurs automatiquement :
  webServer: [
    {
      command: 'npm run dev',
      cwd: './backend',
      port: 3001,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      cwd: './frontend',
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
  */
});
