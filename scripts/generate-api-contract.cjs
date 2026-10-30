// Regenerate with the public Swagger JSON downloaded from the API host.
const fs = require('node:fs');
const source = process.argv[2];
if (!source) throw new Error('Pass the downloaded swagger.json path.');
const swagger = JSON.parse(fs.readFileSync(source, 'utf8'));
const operations = {};
for (const [path, entry] of Object.entries(swagger.paths)) {
  for (const [method, operation] of Object.entries(entry)) {
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
    const key = `${method.toUpperCase()} ${path.replace(/^\/api(?=\/)/, '')}`;
    const content = operation.requestBody?.content || {};
    const body = content['application/json']?.schema;
    const item = body?.type === 'array' ? body.items : body;
    const schema = item?.$ref ? swagger.components.schemas[item.$ref.split('/').pop()] : item;
    const form = content['multipart/form-data']?.schema;
    const files = Object.entries(form?.properties || {}).find(([, field]) => field.format === 'binary' || field.items?.format === 'binary');
    operations[key] = {
      query: (operation.parameters || []).filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name),
      ...(Object.keys(content).length ? { contentType: Object.keys(content)[0] } : {}),
      ...(schema?.properties ? { bodyFields: Object.keys(schema.properties), bodyArray: body.type === 'array' } : {}),
      ...(form ? { formFields: Object.keys(form.properties || {}) } : {}),
      ...(files ? { fileField: { name: files[0], multiple: files[1].type === 'array' } } : {})
    };
  }
}
fs.writeFileSync('src/services/catalog/crmApiContract.json', JSON.stringify({
  source: 'https://demoapi.enstasol.com/swagger/v1/swagger.json', operations
}, null, 2) + '\n');
console.log(`Generated ${Object.keys(operations).length} API operation contracts.`);
