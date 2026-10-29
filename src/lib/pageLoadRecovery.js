const RELOAD_KEY = 'crm:page-load-retry';
const RETRY_WINDOW_MS = 60_000;

// A deployment can replace a lazy page file while an older tab still references it.
// Reload once to fetch the current entry point; repeated failures reach the error UI.
export function installPageLoadRecovery(target = window) {
  const recover = (event) => {
    const now = Date.now();
    const path = target.location.href;
    try {
      const previous = JSON.parse(target.sessionStorage.getItem(RELOAD_KEY) || 'null');
      if (previous?.path === path && now - previous.time < RETRY_WINDOW_MS) return;
      target.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ path, time: now }));
    } catch {
      // Without persistent storage, automatic retries could create a reload loop.
      return;
    }
    event.preventDefault();
    target.location.reload();
  };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
}
