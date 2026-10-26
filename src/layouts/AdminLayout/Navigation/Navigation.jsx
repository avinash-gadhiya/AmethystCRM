import { useContext, useState, useEffect } from 'react';

// project imports
import NavContent from './NavContent';
import { ConfigContext } from 'providers/ConfigProvider';
import useWindowSize from 'hooks/useWindowSize';
import permissionService from 'services/permissionService';
import * as actionType from 'store/actions';

// -----------------------|| NAVIGATION ||-----------------------//

export default function Navigation() {
  const configContext = useContext(ConfigContext);
  const { collapseMenu } = configContext.state;
  const windowSize = useWindowSize();
  const { dispatch } = configContext;
  const [isHovered, setIsHovered] = useState(false);

  const [navItems, setNavItems] = useState(() => permissionService.getNavigation()?.items || []);

  useEffect(() => {
    let active = true;

    const refreshNavigation = () =>
      permissionService.fetchPermissions().then((res) => {
        if (!active) return;
        if (res && Array.isArray(res.items) && res.items.length > 0) {
          setNavItems(res.items);
        } else {
          setNavItems([]);
        }
      });

    // 1. Fetch live permissions from API
    refreshNavigation();

    // 2. Subscribe to dynamic permission updates
    const unsubscribe = permissionService.subscribe((updatedNav) => {
      if (updatedNav && Array.isArray(updatedNav.items)) {
        setNavItems(updatedNav.items);
      }
    });

    // ProtectedRoute owns permission refreshes. This layout consumes the same
    // session cache and updates without forcing another network request.

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const navToggleHandler = () => {
    dispatch({ type: actionType.COLLAPSE_MENU });
  };

  const navClass = ['light-sidebar', 'pc-sidebar', 'crm-sidebar'];
  if (windowSize.width <= 1024 && collapseMenu) {
    navClass.push('mob-sidebar-active');
  } else if (collapseMenu) {
    navClass.push('navbar-collapsed');
    if (isHovered) {
      navClass.push('sidebar-hover-expanded');
    }
  }

  const mobileOverlay =
    windowSize.width <= 1024 && collapseMenu ? <div className="pc-menu-overlay" onClick={navToggleHandler} aria-hidden="true" /> : null;

  return (
    <>
      <nav
        className={navClass.join(' ')}
        aria-label="Primary navigation"
        onMouseEnter={() => {
          if (collapseMenu && windowSize.width > 1024) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (collapseMenu && windowSize.width > 1024) setIsHovered(false);
        }}
      >
        <div className="navbar-wrapper">
          <NavContent navigation={navItems} />
        </div>
      </nav>
      {mobileOverlay}
    </>
  );
}
