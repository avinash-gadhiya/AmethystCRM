import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { X509Certificate } from 'node:crypto';
import { loadLocalHttps } from './local-https.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, '.certs');
const certFile = path.join(directory, 'localhost.pem');
const keyFile = path.join(directory, 'localhost-key.pem');
const trust = process.argv.includes('--trust');
const hosts = [...new Set(['localhost', '127.0.0.1', '::1', ...process.argv.slice(2).filter((value) => value !== '--trust')])];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status}).`);
}

try {
  if (hosts.some((host) => !isIP(host) && !/^(?=.{1,253}$)[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*$/.test(host))) {
    throw new Error('Provide a hostname or IP address, without a protocol, port or path.');
  }
  const candidates = ['openssl'];
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe'));
  }
  const openssl = candidates.find((candidate) => spawnSync(candidate, ['version'], { stdio: 'ignore', windowsHide: true }).status === 0);
  if (!openssl) throw new Error('OpenSSL is required. On Windows, install Git for Windows, then rerun this command.');

  fs.mkdirSync(directory, { recursive: true });
  let reusable = false;
  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    const certificate = new X509Certificate(fs.readFileSync(certFile));
    reusable =
      Date.parse(certificate.validTo) > Date.now() + 86400000 &&
      hosts.every((host) => (isIP(host) ? certificate.checkIP(host) : certificate.checkHost(host)));
  }
  if (!reusable) {
    const subjectAltName = hosts.map((host) => `${isIP(host) ? 'IP' : 'DNS'}:${host}`).join(',');
    run(openssl, [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '365',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-subj',
      '/CN=CRM local development',
      '-addext',
      `subjectAltName=${subjectAltName}`,
      '-addext',
      'basicConstraints=critical,CA:FALSE',
      '-addext',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      '-addext',
      'extendedKeyUsage=serverAuth'
    ]);
    fs.chmodSync(keyFile, 0o600);
  }
  loadLocalHttps(root, {}, true);

  if (trust) {
    if (process.platform !== 'win32')
      throw new Error('On this OS, trust .certs/localhost.pem using your browser or OS certificate settings.');
    // Trust only this server certificate for the current Windows user. This is
    // not a certificate authority and cannot issue certificates for other sites.
    console.log('Approve the Windows certificate dialog for "CRM local development" to enable trusted localhost HTTPS.');
    run('certutil.exe', ['-user', '-addstore', 'Root', certFile]);
    console.log('Local HTTPS certificate trusted for the current Windows user.');
  }
  console.log(`Certificate ready for: ${hosts.join(', ')}`);
  console.log('Run npm run dev:https, then open the HTTPS URL printed by Vite (it chooses another port if 3000 is busy).');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
