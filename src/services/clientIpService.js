const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const STORAGE_KEY = 'crm.currentLoginIpv4';
const CANDIDATE_STORAGE_KEYS = [
  STORAGE_KEY,
  'currentLoginIpv4',
  'userIpv4',
  'userIp',
  'ipAddress',
  'clientIp',
];

let cachedIpv4 = '';
let inFlightPromise = null;

const normalizeIpv4 = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^0-9.]/g, '');
  return IPV4_REGEX.test(cleaned) ? cleaned : '';
};

const readStoredIpv4 = () => {
  if (typeof window === 'undefined') return '';

  for (const key of CANDIDATE_STORAGE_KEYS) {
    const value = normalizeIpv4(window.localStorage.getItem(key));
    if (value) return value;
  }

  return '';
};

const persistIpv4 = (ipv4) => {
  if (!ipv4 || typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, ipv4);
};

const fetchIpv4FromProviders = async () => {
  const providers = [
    async () => {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) return '';
      const data = await response.json();
      return normalizeIpv4(data?.ip);
    },
    async () => {
      const response = await fetch('https://ipv4.icanhazip.com');
      if (!response.ok) return '';
      const text = await response.text();
      return normalizeIpv4(text);
    },
  ];

  for (const provider of providers) {
    try {
      const ip = await provider();
      if (ip) return ip;
    } catch {
      // Try next provider.
    }
  }

  return '';
};

export const getCurrentLoginIpv4 = async (forceRefresh = false) => {
  if (!forceRefresh) {
    if (cachedIpv4) return cachedIpv4;

    const stored = readStoredIpv4();
    if (stored) {
      cachedIpv4 = stored;
      return stored;
    }
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = fetchIpv4FromProviders()
    .then((ip) => {
      cachedIpv4 = ip || '';
      persistIpv4(cachedIpv4);
      return cachedIpv4;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
};

export default {
  getCurrentLoginIpv4,
};


