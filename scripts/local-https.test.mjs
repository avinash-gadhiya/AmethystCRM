import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadLocalHttps } from './local-https.mjs';

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-https-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('HTTP remains available without certificates; HTTPS mode fails instead of silently downgrading', (t) => {
  const root = workspace(t);
  assert.equal(loadLocalHttps(root), undefined);
  assert.throws(() => loadLocalHttps(root, {}, true), /needs both a certificate and its private key/);
  assert.throws(() => loadLocalHttps(root, { DEV_HTTPS_CERT: 'missing.pem' }), /needs both/);
});

test('an incomplete or invalid certificate pair prevents server startup without exposing key content', (t) => {
  const root = workspace(t);
  fs.mkdirSync(path.join(root, '.certs'));
  fs.writeFileSync(path.join(root, '.certs/localhost.pem'), 'invalid certificate');
  assert.equal(loadLocalHttps(root), undefined);
  assert.throws(() => loadLocalHttps(root, {}, true), /needs both/);
  fs.writeFileSync(path.join(root, '.certs/localhost-key.pem'), 'private test content');
  assert.equal(loadLocalHttps(root), undefined, 'certificate files alone do not change the normal HTTP development server');
  assert.throws(
    () => loadLocalHttps(root, { DEV_HTTPS: 'true' }),
    (error) => {
      assert.match(error.message, /invalid or do not match/);
      assert.ok(!error.message.includes('private test content'));
      return true;
    }
  );
});

test('HTTPS accepts configured certificates and completes a verified TLS request without bypassing trust', async (t) => {
  const candidates = ['openssl'];
  if (process.platform === 'win32') candidates.push(path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe'));
  const openssl = candidates.find((candidate) => spawnSync(candidate, ['version'], { stdio: 'ignore' }).status === 0);
  if (!openssl) return t.skip('OpenSSL is required for the TLS handshake test.');
  const root = workspace(t);
  const certFile = path.join(root, 'server.pem');
  const keyFile = path.join(root, 'server-key.pem');
  const generated = spawnSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-subj',
      '/CN=CRM TLS test',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-addext',
      'basicConstraints=critical,CA:FALSE'
    ],
    { stdio: 'ignore' }
  );
  assert.equal(generated.status, 0);
  const options = loadLocalHttps(root, { DEV_HTTPS_CERT: 'server.pem', DEV_HTTPS_KEY: keyFile }, true);
  const certificate = new X509Certificate(options.cert);
  assert.equal(certificate.ca, false);
  assert.ok(certificate.checkHost('localhost'));
  assert.equal(certificate.checkHost('unrelated.example'), undefined);
  const server = https.createServer(options, (_request, response) => response.end('secure CRM'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const result = await new Promise((resolve, reject) => {
    const request = https.get(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        ca: options.cert,
        agent: false
      },
      (response) => {
        assert.equal(response.socket.authorized, true);
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (value) => {
          body += value;
        });
        response.on('end', () => resolve(body));
      }
    );
    request.on('error', reject);
  });
  assert.equal(result, 'secure CRM');
});
