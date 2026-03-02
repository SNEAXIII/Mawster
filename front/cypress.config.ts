import { defineConfig } from 'cypress';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Read NEXTAUTH_SECRET from local env files (same secret the dev server uses).
 * Search order: front/.env → front/.env.local → project-root/front.env → fallback
 */
function getNextAuthSecret(configDir: string): string {
  const candidates = [
    path.resolve(configDir, '.env'),
    path.resolve(configDir, '.env.local'),
    path.resolve(configDir, '..', 'front.env'),
  ];

  for (const file of candidates) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(/NEXTAUTH_SECRET=["']?([^\s"']+)["']?/);
      if (match) return match[1];
    } catch {
      // file not found, try next
    }
  }

  return process.env.NEXTAUTH_SECRET || '';
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    env: {
      API_PROXY: '/api/back',
    },
    setupNodeEvents(on, _config) {
      const secret = getNextAuthSecret(__dirname);
      const cookieName = 'authjs.session-token';

      on('task', {
        /**
         * Generate an encrypted NextAuth v5 session cookie.
         * Uses the same HKDF + JWE (A256CBC-HS512) encryption as NextAuth.
         */
        async generateSessionCookie(payload: Record<string, unknown>) {
          const { EncryptJWT } = await import('jose');

          // Derive 64-byte encryption key via HKDF (same as @auth/core)
          const keyBuffer = crypto.hkdfSync(
            'sha256',
            secret,
            cookieName,
            `Auth.js Generated Encryption Key (${cookieName})`,
            64,
          );
          const key = new Uint8Array(keyBuffer);

          const token = await new EncryptJWT(payload)
            .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
            .setIssuedAt()
            .setExpirationTime(Math.round(Date.now() / 1000 + 30 * 24 * 60 * 60))
            .setJti(crypto.randomUUID())
            .encrypt(key);

          return token;
        },
      });
    },
  },
});
