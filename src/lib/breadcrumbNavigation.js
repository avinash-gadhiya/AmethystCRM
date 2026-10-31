const normalizePath = (value, baseName = '') => {
  let path = String(value || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  const base = String(baseName || '').replace(/\/+$/, '');
  if (base && base !== '/' && (path.toLowerCase() === base.toLowerCase() || path.toLowerCase().startsWith(`${base.toLowerCase()}/`))) {
    path = path.slice(base.length) || '/';
  }
  return path;
};

const titleFromPath = (path) => {
  const part = path.split('/').filter(Boolean).pop() || 'Dashboard';
  return part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getBreadcrumbNavigation = (navigation, pathname, baseName = '') => {
  const entries = [];
  const visit = (items, parents = []) => {
    for (const item of Array.isArray(items) ? items : []) {
      const path = item.url ? normalizePath(item.url, baseName) : '';
      if (path) entries.push({ ...item, url: path, parents });
      const nextParents = item.type !== 'group' && item.title ? [...parents, { ...item, url: path }] : parents;
      visit(item.children, nextParents);
    }
  };
  visit(Array.isArray(navigation) ? navigation : navigation?.items);
  const currentPath = normalizePath(pathname, baseName).toLowerCase();
  const dashboard = entries.find((entry) => ['/dashboard', '/dashboards'].includes(entry.url.toLowerCase()))
    || entries.find((entry) => /^dashboards?$/i.test(String(entry.title || '').trim()));
  const homePath = dashboard?.url || '/Dashboards';
  const matched = entries.filter((entry) => {
    const path = entry.url.toLowerCase();
    return currentPath === path || (path !== '/' && currentPath.startsWith(`${path}/`));
  }).sort((left, right) => right.url.length - left.url.length)[0];
  const leadTitles = { '/newleads': 'New Leads', '/leads/myleads': 'My Leads', '/leads/callback': 'Call Back', '/leads/voicemail': 'Voicemails', '/leads': 'Leads' };
  const title = leadTitles[currentPath] || matched?.title || titleFromPath(normalizePath(pathname, baseName));
  let parents = matched?.parents || [];
  if (leadTitles[currentPath]) parents = title === 'Leads' ? [] : [{ title: 'Leads', url: entries.find((entry) => entry.url.toLowerCase() === '/leads')?.url }];
  if (!matched && !leadTitles[currentPath]) {
    const parts = normalizePath(pathname, baseName).split('/').filter(Boolean);
    if (parts.length > 1) parents = [{ title: titleFromPath(`/${parts[0]}`) }];
  }
  const seen = new Set([String(title).toLowerCase(), 'navigation']);
  parents = parents.filter((parent) => {
    const key = String(parent.title || '').trim().toLowerCase();
    if (!key || seen.has(key) || parent.url?.toLowerCase() === homePath.toLowerCase()) return false;
    seen.add(key);
    return true;
  });
  return { title, parents, homePath };
};
