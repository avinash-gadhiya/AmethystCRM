// Several Swagger resources expose a paged collection but no GET /Resource/{id}.
export const findPagedRecord = async (getPage, idKey, requestedId, signal) => {
  const id = Number(requestedId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid record ID is required.');
  const seen = new Set();
  for (let page = 1; page <= 1000; page += 1) {
    const result = await getPage({ PageNumber: page, PageSize: 100, SortProperty: idKey, IsDescending: false }, signal);
    const rows = Array.isArray(result?.data) ? result.data : [];
    const match = rows.find((row) => Number(row[idKey]) === id);
    if (match) return match;
    let added = 0;
    for (const row of rows) {
      const key = Number(row[idKey]);
      if (!seen.has(key)) { seen.add(key); added += 1; }
    }
    if (!rows.length || rows.length < 100 || (result.totalCount != null && seen.size >= Number(result.totalCount))) {
      throw new Error('Record not found.');
    }
    if (!added) throw new Error('The record list could not be fully loaded.');
  }
  throw new Error('The record list could not be fully loaded.');
};
