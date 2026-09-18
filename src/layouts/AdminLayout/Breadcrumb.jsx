import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

// project imports
import navigation from 'menu-items';
import { BASE_TITLE } from 'config/constant';

// -----------------------|| BREADCRUMB ||-----------------------//

export default function Breadcrumb() {
  const [main, setMain] = useState({});
  const [item, setItem] = useState({});
  const location = useLocation();

  useEffect(() => {
    navigation.items.forEach((navItem) => {
      if (navItem.type === 'group') {
        getCollapse(navItem);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const getCollapse = (items) => {
    if (items.children) {
      items.children.forEach((collapse) => {
        if (collapse.type === 'collapse') {
          getCollapse(collapse);
        } else if (collapse.type === 'item') {
          if (document.location.pathname === (import.meta.env.VITE_APP_BASE_NAME || '') + collapse.url) {
            setMain(items);
            setItem(collapse);
          }
        }
      });
    }
  };

  let title = '';

  if (item && item.type === 'item' && item.breadcrumbs !== false) {
    title = item.title;
    document.title = title + BASE_TITLE;

    return (
      <div className="page-header mb-2">
        <div className="page-block py-1.5 px-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <h5 className="text-xs font-bold text-gray-800 mb-0 leading-none">{title}</h5>
              <span className="text-gray-300 text-xs">/</span>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to="/" className="flex items-center gap-1 text-gray-400 hover:text-indigo-500 text-xs">
                      <Home size={11} />
                      Home
                    </Link>
                  </li>
                  {main && main.type === 'collapse' && main.title && main.title !== title && (
                    <li className="breadcrumb-item flex items-center gap-1 text-xs">
                      <ChevronRight size={10} className="text-gray-300" />
                      <Link to="#" className="text-gray-400 hover:text-indigo-500">{main.title}</Link>
                    </li>
                  )}
                  <li className="breadcrumb-item flex items-center gap-1 text-xs">
                    <ChevronRight size={10} className="text-gray-300" />
                    <span className="text-gray-600 font-medium">{title}</span>
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
