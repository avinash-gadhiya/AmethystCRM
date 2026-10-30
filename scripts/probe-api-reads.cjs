// Exercises documented read routes only. Set AMETHYST_API_TEST_TOKEN locally for authenticated verification.
const fs = require('node:fs');
const contract = require('../src/services/catalog/crmApiContract.json');
const base = (process.env.AMETHYST_API_TEST_BASE || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
const token = process.env.AMETHYST_API_TEST_TOKEN;
const queue = Object.keys(contract.operations).filter((key) => key.startsWith('GET ')
  && !key.includes('{') && !/(SendMail|SendPandaDocMail|GetFullUrl)/i.test(key));
const results = [];
(async () => {
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const operation = queue.shift();
      const path = operation.slice(4);
      const query = new URLSearchParams();
      for (const name of contract.operations[operation].query) {
        if (['PageNumber', 'pageNo'].includes(name)) query.set(name, '1');
        if (name === 'PageSize') query.set(name, '1');
      }
      try {
        const response = await fetch(`${base}${path}${query.size ? '?' + query : ''}`, {
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: AbortSignal.timeout(15000)
        });
        // Do not store CRM records or authentication material in audit artifacts.
        await response.body?.cancel();
        results.push({ operation, status: response.status });
      } catch (error) {
        results.push({ operation, status: null, error: error.name });
      }
    }
  }));
  results.sort((left, right) => left.operation.localeCompare(right.operation));
  const report = { authenticated: !!token, results };
  const output = process.argv[2];
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  const counts = results.reduce((summary, result) => {
    const key = result.status ?? result.error;
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
  console.log(JSON.stringify({ authenticated: !!token, readCount: results.length, statuses: counts }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
