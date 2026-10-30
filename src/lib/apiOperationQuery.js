import contract from '@/services/catalog/crmApiContract.json';

export const getOperationContract = (method, path) => contract.operations[`${method.toUpperCase()} ${path}`];

// Use only documented query names, preserving the spelling of each endpoint.
export const getOperationQuery = (method, path, candidates = {}) => {
  const operation = getOperationContract(method, path);
  if (!operation) return candidates;
  return Object.fromEntries(operation.query.flatMap((name) => {
    const match = Object.keys(candidates).find((key) => key.toLowerCase() === name.toLowerCase())
      || (name === 'pageNo' && 'PageNumber' in candidates ? 'PageNumber' : undefined);
    return match === undefined ? [] : [[name, candidates[match]]];
  }));
};
