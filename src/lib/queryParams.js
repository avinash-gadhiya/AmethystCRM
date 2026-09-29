// Query-string encoding helpers.
//
// Axios (and the native URLSearchParams) serialize a space as `+` because they
// follow the `application/x-www-form-urlencoded` rules. Search terms such as
// "john doe" therefore reach the API as `Text=john+doe`, and backends that read
// the raw query string treat the `+` as a literal plus instead of a space.
//
// These helpers keep the default encoding behaviour but emit `%20` for spaces.

// Mirrors axios' built-in query encoder, minus the `%20` -> `+` replacement.
export const encodeQueryValue = (value) =>
  encodeURIComponent(value ?? '')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']');

// Serialize a plain object (or entries array) into a `%20`-encoded query string.
// Empty/nullish values are skipped so callers can pass optional filters directly.
export const serializeQueryParams = (params) => {
  const entries = Array.isArray(params) ? params : Object.entries(params || {});

  return entries
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === '') return [];
      const values = Array.isArray(value) ? value : [value];
      return values
        .filter((v) => v !== undefined && v !== null && v !== '')
        .map((v) => `${encodeQueryValue(key)}=${encodeQueryValue(v)}`);
    })
    .join('&');
};

// Axios `paramsSerializer` config: reuses axios' own param flattening and only
// swaps in our encoder, so array/object params keep their existing shape.
export const axiosParamsSerializer = { encode: encodeQueryValue };

export default {
  encodeQueryValue,
  serializeQueryParams,
  axiosParamsSerializer,
};
