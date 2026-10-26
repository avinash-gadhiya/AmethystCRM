const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
export const USER_IP_STORAGE_KEY = 'userIp';
const LEGACY_IP_KEYS = ['crm.currentLoginIpv4', 'currentLoginIpv4', 'userIpv4', 'ipAddress', 'clientIp', 'client_ip', 'loginIp'];
let cachedIpv4 = '';
let inFlightPromise = null;
let lastAttemptAt = 0;

const normalizeIpv4 = (value) => {
  const ip = String(value || '').trim();
  return IPV4_REGEX.test(ip) ? ip : '';
};

const persistIpv4 = (ipv4) => {
  try {
    if (typeof window === 'undefined') return;
    if (ipv4) window.localStorage.setItem(USER_IP_STORAGE_KEY, ipv4);
    else window.localStorage.removeItem(USER_IP_STORAGE_KEY);
    LEGACY_IP_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // IP detection and login still work when browser storage is disabled.
  }
};

export const getStoredUserIp = () => {
  try {
    if (typeof window === 'undefined') return cachedIpv4;
    for (const key of [USER_IP_STORAGE_KEY, ...LEGACY_IP_KEYS]) {
      const ip = normalizeIpv4(window.localStorage.getItem(key));
      if (ip) {
        cachedIpv4 = ip;
        persistIpv4(ip);
        return ip;
      }
    }
  } catch {
    // Fall back to this tab's in-memory value.
  }
  return cachedIpv4;
};

const fetchIpv4FromProviders = async () => {
  for (const [url, json] of [
    ['https://api.ipify.org?format=json', true],
    ['https://ipv4.icanhazip.com', false]
  ]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) continue;
      const ip = normalizeIpv4(json ? (await response.json())?.ip : await response.text());
      if (ip) return ip;
    } catch {
      // Try the next provider after a failed or timed-out request.
    } finally {
      clearTimeout(timeout);
    }
  }
  return '';
};

export const getCurrentLoginIpv4 = async (forceRefresh = false) => {
  if (inFlightPromise) return inFlightPromise;
  if (!forceRefresh) {
    const ip = cachedIpv4 || getStoredUserIp();
    if (ip) return ip;
    if (lastAttemptAt && Date.now() - lastAttemptAt < 30000) return '';
  }
  lastAttemptAt = Date.now();
  inFlightPromise = fetchIpv4FromProviders()
    .then((ip) => {
      cachedIpv4 = ip;
      persistIpv4(ip);
      return ip;
    })
    .finally(() => {
      inFlightPromise = null;
    });
  return inFlightPromise;
};

export default { getCurrentLoginIpv4, getStoredUserIp };
