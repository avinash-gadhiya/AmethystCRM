export const LOCAL_API_PREFIX = '/crm-api';

export const createLocalApiProxy = (apiUrl) => ({
  [LOCAL_API_PREFIX]: {
    target: apiUrl.replace(/\/$/, ''),
    changeOrigin: true,
    rewrite: (requestPath) => requestPath.replace(/^\/crm-api(?=\/|\?|$)/, '') || '/',
    timeout: 30000,
    proxyTimeout: 30000
  }
});
