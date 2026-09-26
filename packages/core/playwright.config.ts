import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export const DEV_SERVER_PORT = 43217;
export const MOCK_OPENAI_PORT = 43218;

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * What the dev server and every CLI run under test see: a throwaway MOSAGE_HOME
 * so the real API key and usage log are never touched, the mock OpenAI API, no
 * update check reaching out to npm, and a GitHub remote for `code/` that is a
 * local directory.
 */
/** A GitHub address that `code/` connects to, served by a local bare repository. */
export const CODE_REMOTE_URL = 'https://github.com/acme/q3-code.git';
export const CODE_REMOTE_DIR = path.join(here, 'e2e', '.scratch', 'code-remote.git');

export const E2E_ENV = {
  MOSAGE_HOME: path.join(here, 'e2e', '.scratch', 'home'),
  MOSAGE_OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_OPENAI_PORT}/v1`,
  MOSAGE_NO_UPDATE_CHECK: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: `url.${CODE_REMOTE_DIR}.insteadOf`,
  GIT_CONFIG_VALUE_0: CODE_REMOTE_URL,
  GIT_AUTHOR_NAME: 'MoSage e2e',
  GIT_AUTHOR_EMAIL: 'e2e@example.com',
  GIT_COMMITTER_NAME: 'MoSage e2e',
  GIT_COMMITTER_EMAIL: 'e2e@example.com',
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
