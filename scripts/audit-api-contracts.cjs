// Compare statically identifiable HTTP calls with an independently downloaded OpenAPI document.
// Usage: node scripts/audit-api-contracts.cjs path/to/swagger.json [report.json]
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const schemaFile = process.argv[2];
if (!schemaFile) throw new Error('Pass the downloaded Swagger JSON path.');
const spec = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
const operations = Object.entries(spec.paths).flatMap(([route, entry]) =>
  Object.entries(entry).filter(([method]) => methods.has(method)).map(([method, operation]) => ({
    method: method.toUpperCase(), path: route.replace(/^\/api(?=\/)/, ''), operation
  }))
);
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? files(file) : /\.[jt]sx?$/.test(entry.name) ? [file] : [];
});
const literal = (node) => node?.type === 'StringLiteral' ? node.value : undefined;
const properties = (node) => node?.type === 'ObjectExpression'
  ? node.properties.filter((item) => item.type === 'ObjectProperty').map((item) => [item.key.name || item.key.value, item.value]) : [];
const property = (node, key) => properties(node).find(([name]) => name === key)?.[1];
const routeFrom = (node) => {
  if (literal(node)?.startsWith('/')) return literal(node).split('?')[0];
  if (node?.type !== 'TemplateLiteral') return null;
  if (node.expressions[0]?.type === 'Identifier' && /GOOGLE|PLACES/i.test(node.expressions[0].name)) return null;
  let route = '';
  for (let index = 0; index < node.quasis.length; index += 1) {
    route += node.quasis[index].value.cooked;
    if (index < node.expressions.length) {
      if (index === 0 && route === '') continue; // ${API_BASE_URL}/Resource
      route += '{value}';
    }
  }
  return route.startsWith('/') ? route.split('?')[0].replace(/\{value\}$/, (suffix) => route.includes('?') ? '' : suffix) : null;
};
const matchRoute = (pattern, route) => {
  const parts = (value) => value.toLowerCase().split('/').filter(Boolean);
  const expected = parts(pattern), actual = parts(route);
  return expected.length === actual.length && expected.every((part, index) =>
    part.startsWith('{') || actual[index].startsWith('{') || part === actual[index]);
};
const calls = [];
for (const file of files('src')) {
  const tree = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  traverse(tree, {
    CallExpression({ node }) {
      const member = node.callee;
      const memberName = member.type === 'MemberExpression' ? member.property.name : null;
      const objectName = member.type === 'MemberExpression' && member.object.type === 'Identifier' ? member.object.name : null;
      const isClient = ['apiClient', 'axios'].includes(objectName);
      const wrapper = member.type === 'Identifier' && ['request', 'fetch'].includes(member.name);
      if (!(isClient && (methods.has(memberName) || memberName === 'request')) && !wrapper) return;
      const route = routeFrom(node.arguments[0]);
      if (!route) return;
      const config = node.arguments[1];
      const method = methods.has(memberName) ? memberName.toUpperCase() : (literal(property(config, 'method')) || 'GET').toUpperCase();
      const matches = operations.filter((operation) => operation.method === method && matchRoute(operation.path, route));
      const params = objectName === 'apiClient' && memberName === 'get' ? config : property(config, 'params');
      const queryKeys = properties(params).map(([name]) => name);
      const unknownQueryKeys = matches.length === 1 ? queryKeys.filter((key) =>
        !(matches[0].operation.parameters || []).some((parameter) => parameter.in === 'query' && parameter.name.toLowerCase() === key.toLowerCase())) : [];
      calls.push({ file: file.replaceAll('\\', '/'), line: node.loc.start.line, method, path: route,
        documented: matches.length > 0, unknownQueryKeys });
    }
  });
}
const report = { source: 'https://demoapi.enstasol.com/swagger/v1/swagger.json',
  operationCount: operations.length, staticCallCount: calls.length,
  limitations: 'Static call inventory only. Dynamic wrappers and runtime DTOs require service tests; this does not execute authenticated requests.',
  undocumented: calls.filter((call) => !call.documented),
  unsupportedQueryParameters: calls.filter((call) => call.unknownQueryKeys.length), calls };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, calls: undefined }, null, 2));
