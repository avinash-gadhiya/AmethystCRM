import fs from 'node:fs';
import path from 'node:path';
import { createSecureContext } from 'node:tls';

// Certificates are server-only settings, so these variables intentionally do
// not use the VITE_ prefix (which exposes variables to browser code).
export function loadLocalHttps(root, env = {}, required = false) {
  const requested = required || env.DEV_HTTPS === 'true' || Boolean(env.DEV_HTTPS_CERT || env.DEV_HTTPS_KEY);
  if (!requested) return undefined;
  const certFile = path.resolve(root, env.DEV_HTTPS_CERT || '.certs/localhost.pem');
  const keyFile = path.resolve(root, env.DEV_HTTPS_KEY || '.certs/localhost-key.pem');
  const certExists = fs.existsSync(certFile);
  const keyExists = fs.existsSync(keyFile);

  if (!certExists || !keyExists) {
    throw new Error('Local HTTPS needs both a certificate and its private key. Run npm run setup:https, then npm run dev:https.');
  }

  const https = { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
  try {
    createSecureContext(https);
  } catch {
    throw new Error('The local HTTPS certificate and private key are invalid or do not match. Check DEV_HTTPS_CERT and DEV_HTTPS_KEY.');
  }
  return https;
}
