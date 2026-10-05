import { useContext } from 'react';
import { Menu } from 'lucide-react';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';
import Breadcrumb from '../Breadcrumb';

// -----------------------|| NAV LEFT (GREEN BOX: PAGE NAVIGATION) ||-----------------------//

export default function NavLeft() {
  const configContext = useContext(ConfigContext);
  const { dispatch } = configContext;

  return (
    <div className="flex items-center gap-3 h-full py-1">
      {/* Sidebar toggle button for desktop */}
      <button
        type="button"
        className="neu-icon-btn d-none d-lg-inline-flex"
        onClick={() => dispatch({ type: actionType.COLLAPSE_MENU })}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <Menu size={16} />
      </button>

      {/* Page Navigation & Breadcrumbs in Header (Green Box) */}
      <Breadcrumb />
    </div>
  );
}
