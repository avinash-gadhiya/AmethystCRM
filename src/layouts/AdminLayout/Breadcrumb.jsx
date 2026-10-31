import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

import permissionService from 'services/permissionService';
import { BASE_TITLE } from 'config/constant';
import { getBreadcrumbNavigation } from '@/lib/breadcrumbNavigation';

export default function Breadcrumb() {
  const location = useLocation();
  const [navigation, setNavigation] = useState(() => permissionService.getNavigation());

  useEffect(() => {
    const update = (next) => setNavigation(next || permissionService.getNavigation());
    const unsubscribe = permissionService.subscribe(update);
    update();
    return unsubscribe;
  }, []);

  const { title, parents, homePath } = useMemo(
    () => getBreadcrumbNavigation(navigation, location.pathname, import.meta.env.VITE_APP_BASE_NAME || ''),
    [navigation, location.pathname]
  );

  useEffect(() => {
    document.title = `${title} ${BASE_TITLE || ''}`.trim();
  }, [title]);

  return (
    <div className="header-breadcrumb">
      <h1 className="header-breadcrumb__title" title={title}>{title}</h1>
      <span className="header-breadcrumb__divider" aria-hidden="true" />
      <nav aria-label="Breadcrumb" className="header-breadcrumb__nav">
        <ol className="header-breadcrumb__list">
          <li className="header-breadcrumb__home-item">
            <Link to={homePath} className="header-breadcrumb__home" title="Open dashboard">
              <Home size={14} aria-hidden="true" />
              <span>Home</span>
            </Link>
          </li>
          {parents.map((parent, index) => (
            <li className="header-breadcrumb__parent" key={`${parent.url || parent.title}-${index}`}>
              <ChevronRight size={12} className="header-breadcrumb__chevron" aria-hidden="true" />
              {parent.url ? (
                <Link to={parent.url} className="header-breadcrumb__parent-link" title={parent.title}>{parent.title}</Link>
              ) : <span title={parent.title}>{parent.title}</span>}
            </li>
          ))}
          <li className="header-breadcrumb__current" aria-current="page">
            <ChevronRight size={12} className="header-breadcrumb__chevron" aria-hidden="true" />
            <span title={title}>{title}</span>
          </li>
        </ol>
      </nav>
    </div>
  );
}
