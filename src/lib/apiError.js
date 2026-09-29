// Centralized helpers for surfacing backend error messages in the UI.

const normalizeToString = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const extractFromValidationErrors = (errorsObj) => {
  if (!errorsObj || typeof errorsObj !== 'object') return '';

  const messages = [];
  for (const key of Object.keys(errorsObj)) {
    const entry = errorsObj[key];
    if (Array.isArray(entry)) {
      for (const item of entry) {
        const msg = normalizeToString(item);
        if (msg) messages.push(msg);
      }
    } else {
      const msg = normalizeToString(entry);
      if (msg) messages.push(msg);
    }
  }

  return messages.length ? messages[0] : '';
};

export const getApiMessageFromData = (data) => {
  if (data == null) return '';

  if (typeof data === 'string') return data.trim();

  const direct =
    normalizeToString(data.message) ||
    normalizeToString(data.Message) ||
    normalizeToString(data.error) ||
    normalizeToString(data.Error) ||
    normalizeToString(data.title) ||
    normalizeToString(data.Title);

  if (direct) return direct;

  const validation = extractFromValidationErrors(data.errors || data.Errors);
  if (validation) return validation;

  const nested = data.data || data.Data;
  if (nested && typeof nested === 'object') {
    const nestedMessage =
      normalizeToString(nested.message) ||
      normalizeToString(nested.Message) ||
      extractFromValidationErrors(nested.errors || nested.Errors);
    if (nestedMessage) return nestedMessage;
  }

  return '';
};

export const getApiErrorMessage = (error, fallbackMessage = 'Something went wrong') => {
  const apiMessage =
    getApiMessageFromData(error?.response?.data) ||
    getApiMessageFromData(error?.data) ||
    normalizeToString(error?.message);

  const normalizedFallback = normalizeToString(fallbackMessage) || 'Something went wrong';

  if (!apiMessage) return normalizedFallback;
  if (apiMessage.toLowerCase().startsWith('request failed with status code')) {
    return normalizedFallback;
  }
  if (apiMessage.toLowerCase() === 'network error') {
    return normalizedFallback;
  }

  return apiMessage;
};

export default {
  getApiErrorMessage,
  getApiMessageFromData
};
