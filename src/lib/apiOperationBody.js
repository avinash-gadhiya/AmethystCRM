import { getOperationContract } from './apiOperationQuery';

export const buildOperationBody = (method, path, value, files = []) => {
  const contract = getOperationContract(method, path);
  if (!contract?.contentType) return undefined;
  if (contract.contentType !== 'multipart/form-data') {
    const rows = contract.bodyArray ? value : [value];
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error(`Request body must be ${contract.bodyArray ? 'an array of objects' : 'a JSON object'}.`);
    }
    for (const row of rows) {
      const unknown = Object.keys(row).filter((name) => contract.bodyFields && !contract.bodyFields.includes(name));
      if (unknown.length) throw new Error(`Unsupported body fields: ${unknown.join(', ')}.`);
    }
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Form fields must be a JSON object.');
  const data = new FormData();
  for (const [name, item] of Object.entries(value)) {
    if (!contract.formFields.includes(name) || name === contract.fileField?.name) throw new Error(`Unsupported form field: ${name}.`);
    for (const field of Array.isArray(item) ? item : [item]) {
      if (field == null) continue;
      if (typeof field === 'object') throw new Error(`${name} must contain text, numbers, or boolean values.`);
      data.append(name, String(field));
    }
  }
  if (path === '/Payment/UploadExcel' && !files.length) throw new Error('Choose a file to upload.');
  if (!contract.fileField?.multiple && files.length > 1) throw new Error('This operation accepts one file.');
  for (const file of files) data.append(contract.fileField.name, file, file.name || 'upload');
  return data;
};
