import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('multiple Vite instances choose available ports and serve the React entry point', async (t) => {
  // Windows may reserve port ranges adjacent to an OS-assigned ephemeral port.
  // Check that both fallback ports are bindable before testing Vite's collision
  // handling; EACCES from an OS reservation is not an EADDRINUSE collision.
  let occupied;
  for (let attempt = 0; attempt < 20; attempt++) {
    const reservations = [];
    try {
      for (let offset = 0; offset < 3; offset++) {
        const probe = net.createServer();
        reservations.push(probe);
        await new Promise((resolve, reject) => {
          probe.once('error', reject);
          probe.listen(offset ? reservations[0].address().port + offset : 0, '127.0.0.1', resolve);
        });
      }
      occupied = reservations.shift();
    } catch (error) {
      if (!['EACCES', 'EADDRINUSE', 'ERR_SOCKET_BAD_PORT'].includes(error.code)) throw error;
    } finally {
      await Promise.all(reservations.filter((server) => server.listening).map((server) => new Promise((resolve) => server.close(resolve))));
    }
    if (occupied) break;
  }
  assert.ok(occupied, 'three adjacent local ports must be available for this integration test');
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  const startingPort = occupied.address().port;
  const ports = new Set([startingPort]);
  const root = fileURLToPath(new URL('../', import.meta.url));

  for (let instance = 0; instance < 2; instance += 1) {
    const server = await createServer({
      root,
      configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
      mode: 'development',
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: startingPort, watch: null, hmr: false, https: undefined },
      optimizeDeps: { noDiscovery: true, include: [] }
    });
    t.after(() => server.close());
    await server.listen();
    const port = server.httpServer.address().port;
    assert.equal(ports.has(port), false, 'each server must use a separate available port');
    ports.add(port);

    const response = await fetch(`http://127.0.0.1:${port}${server.config.base}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /src\/main\.jsx/);
    assert.match(html, /@vite\/client/);
  }
  assert.equal(ports.size, 3);
});
