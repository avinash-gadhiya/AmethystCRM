import { useCallback, useRef } from 'react';

const normalizeField = (value) => String(value ?? '').trim().toLowerCase();

// Picking a "search by" field is not a query on its own: the toolbars clear the
// Text value whenever the field changes, so the list effect would fire a
// pointless request for the same rows. This guard swallows exactly that run -
// the API is hit again as soon as something is typed or selected as the search
// value.
//
// `browseAllField` is the option that means "no filter" ('All Tickets',
// 'All Payments', null for Orders, 'name' for Customers). Switching back to it
// IS a real query - it reloads the full list - so Reset/Clear still refetches.
//
// Usage (inside the list-fetching effect, never during render):
//
//   const skipFetchOnSearchFieldChange = useSearchFieldFetchGuard(searchField, 'All Tickets');
//   useEffect(() => {
//     if (skipFetchOnSearchFieldChange(searchText)) return;
//     fetchRows();
//   }, [...deps]);
//
// The previous field lives in a ref that is only read/written from inside the
// effect, so a double-invoked render (StrictMode) cannot consume the change.
// Two effects driven by the same field need one guard instance each.
export const useSearchFieldFetchGuard = (searchField, browseAllField = '') => {
  const previousFieldRef = useRef(searchField);

  return useCallback((searchText) => {
    const changed = previousFieldRef.current !== searchField;
    previousFieldRef.current = searchField;

    if (!changed) return false;
    if (String(searchText ?? '').trim()) return false;

    return normalizeField(searchField) !== normalizeField(browseAllField);
  }, [searchField, browseAllField]);
};

export default useSearchFieldFetchGuard;


