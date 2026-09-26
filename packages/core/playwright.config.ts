import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export const DEV_SERVER_PORT = 43217;
export const MOCK_OPENAI_PORT = 43218;

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * What the dev server and every CLI run under test see: a throwaway MOSAGE_HOME
 * so the real API key and usage log are never touched, the mock OpenAI API, and
 * no update check reaching out to npm.
 */
export const E2E_ENV = {
  MOSAGE_HOME: path.join(here, 'e2e', '.scratch', 'home'),
  MOSAGE_OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_OPENAI_PORT}/v1`,
  MOSAGE_NO_UPDATE_CHECK: '1',
};

export default defineConfig({
  testDir: './e2e/tests',
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${DEV_SERVER_PORT}`,
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node e2e/mock-openai.mjs --port ${MOCK_OPENAI_PORT}`,
      url: `http://127.0.0.1:${MOCK_OPENAI_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `node e2e/start-dev-server.mjs --port ${DEV_SERVER_PORT}`,
      url: `http://127.0.0.1:${DEV_SERVER_PORT}/`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: E2E_ENV,
    },
  ],
});
