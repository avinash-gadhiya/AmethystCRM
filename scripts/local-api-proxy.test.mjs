import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, resolveConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createLocalApiProxy, LOCAL_API_PREFIX } from './local-api-proxy.mjs';

test('local proxy forwards the API path, query, authorization and customer JSON without requiring upstream CORS', async (t) => {
  const received = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({
      method: request.method,
      url: request.url,
      auth: request.headers.authorization,
      body: Buffer.concat(chunks).toString()
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ success: true, data: { customerId: 13 } }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => upstream.close(resolve)));
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      hmr: false,
      watch: null,
      proxy: createLocalApiProxy(`http://127.0.0.1:${upstream.address().port}/api/`)
    },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}${LOCAL_API_PREFIX}`;
  const result = await fetch(`${base}/Customer/13?ip=192.0.2.1`, { headers: { Authorization: 'Bearer test-only' } });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).data.customerId, 13);
  assert.equal(received[0].url, '/api/Customer/13?ip=192.0.2.1');
  assert.equal(received[0].auth, 'Bearer test-only');
  const payload = { name: 'Test', email: 'test@example.test', address: '123 Main St', city: 'Columbus', salesPerson: 7 };
  await fetch(`${base}/Customer`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-only', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(received[1].method, 'POST');
  assert.equal(received[1].url, '/api/Customer');
  assert.deepEqual(JSON.parse(received[1].body), payload);
});

test('Vite uses the local API prefix in development and keeps the configured API URL in production builds', async () => {
  const configFile = fileURLToPath(new URL('../vite.config.mjs', import.meta.url));
  const dev = await resolveConfig({ configFile, logLevel: 'silent' }, 'serve');
  assert.equal(dev.define['import.meta.env.VITE_APP_API_URL'], JSON.stringify(LOCAL_API_PREFIX));
  assert.equal(dev.server.proxy[LOCAL_API_PREFIX].changeOrigin, true);
  const build = await resolveConfig({ configFile, logLevel: 'silent' }, 'build');
  assert.equal(build.define['import.meta.env.VITE_APP_API_URL'], undefined);
});
