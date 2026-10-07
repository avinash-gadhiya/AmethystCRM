import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

// project imports
import permissionService from 'services/permissionService';
import { BASE_TITLE } from 'config/constant';

// -----------------------|| HEADER BREADCRUMB ||-----------------------//

export default function Breadcrumb() {
  const [main, setMain] = useState(null);
  const [item, setItem] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, '');
    const leadTitles = {
      '/newleads': 'New Leads',
      '/leads/myleads': 'My Leads',
      '/leads/callback': 'Call Back',
      '/leads/voicemail': 'Voicemails',
      '/leads': 'Leads'
    };
    if (leadTitles[normalizedPath]) {
      setItem({ title: leadTitles[normalizedPath], type: 'item' });
      setMain({ title: 'Leads' });
      return;
    }

    const nav = permissionService.getNavigation() || { items: [] };
    let matchedItem = null;
    let matchedMain = null;

    const findMatch = (items, parent = null) => {
      if (!items || !Array.isArray(items)) return;
      for (const entry of items) {
        if (entry.children && Array.isArray(entry.children)) {
          findMatch(entry.children, entry);
          if (matchedItem) break;
        } else if (entry.url) {
          const currentPath = location.pathname.toLowerCase().replace(/\/$/, '');
          const entryPath = ((import.meta.env.VITE_APP_BASE_NAME || '') + entry.url).toLowerCase().replace(/\/$/, '');
          if (currentPath === entryPath || (entryPath !== '' && entryPath !== '/' && currentPath.startsWith(entryPath))) {
            matchedItem = entry;
            matchedMain = parent;
            break;
          }
        }
      }
    };

    if (Array.isArray(nav.items)) {
      findMatch(nav.items);
    }

    if (matchedItem) {
      setItem(matchedItem);
      setMain(matchedMain);
    } else {
      // Fallback for custom routes like /MyProfile, /Tickets, etc.
      const pathParts = location.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || 'Dashboard';
      const formattedTitle = lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();

      setItem({ title: formattedTitle, type: 'item' });
      setMain(pathParts.length > 1 ? { title: pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) } : null);
    }
  }, [location.pathname]);

  const title = item?.title || 'Dashboard';
  if (title) {
    document.title = `${title} ${BASE_TITLE || ''}`.trim();
  }

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      {/* Primary Page Title (Bold) */}
      <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight leading-none mb-0 truncate">{title}</h1>

      <span className="text-slate-300 text-xs font-light select-none">/</span>

      {/* Breadcrumb Trail */}
      <nav aria-label="breadcrumb" className="flex items-center min-w-0">
        <ol className="flex items-center gap-1.5 mb-0 p-0 list-none text-xs">
          <li className="flex items-center">
            <Link
              to="/Performance/Dashboard"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors no-underline"
            >
              <Home size={12} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium hidden sm:inline">Home</span>
            </Link>
          </li>

          {main && main.title && main.title !== title && (
            <li className="flex items-center gap-1 text-slate-400">
              <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
              <span className="hidden md:inline font-normal truncate max-w-[120px]">{main.title}</span>
            </li>
          )}

          <li className="flex items-center gap-1">
            <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
            <span className="text-slate-600 font-semibold truncate max-w-[160px]">{title}</span>
          </li>
        </ol>
      </nav>
    </div>
  );
}
