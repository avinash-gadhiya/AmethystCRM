import PropTypes from 'prop-types';
import { useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

// third party - Lucide icons
import { ChevronRight } from 'lucide-react';

// project imports
import NavItem from './NavItem';
import LoopNavCollapse from './NavCollapse';
import NavIcon from './NavIcon';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';
import useWindowSize from 'hooks/useWindowSize';

// -----------------------|| NAV COLLAPSE ||-----------------------//

export default function NavCollapse({ collapse, type }) {
  const configContext = useContext(ConfigContext);
  const { dispatch } = configContext;
  const windowSize = useWindowSize();
  const location = useLocation();

  const { isOpen, isTrigger, collapseLayout } = configContext.state;

  useEffect(() => {
    const currentPath = (location.pathname || window.location.pathname).toLowerCase();
    const collapseIdLower = (collapse.id || '').toLowerCase();
    const segments = currentPath.split('/').filter(Boolean).map((s) => s.toLowerCase());
    const hasChildActive =
      Array.isArray(collapse.children) &&
      collapse.children.some((c) => c.url && currentPath === c.url.toLowerCase());

    if (segments.includes(collapseIdLower) || hasChildActive) {
      dispatch({ type: actionType.COLLAPSE_TOGGLE, menu: { id: collapse.id, type: type } });
    }
  }, [collapse, dispatch, type, location.pathname]);

  let navItems = null;
  if (collapse.children) {
    const collapses = collapse.children;
    navItems = Object.keys(collapses).map((key) => {
      const item = collapses[key];
      switch (item.type) {
        case 'collapse':
          return <LoopNavCollapse key={item.id} collapse={item} type="sub" />;
        case 'item':
          return <NavItem key={item.id} item={item} />;
        default:
          return null;
      }
    });
  }

  const currentPath = (location.pathname || window.location.pathname).toLowerCase();
  const collapseIdLower = (collapse.id || '').toLowerCase();
  const segments = currentPath.split('/').filter(Boolean).map((s) => s.toLowerCase());
  const isChildActive =
    Array.isArray(collapse.children) &&
    collapse.children.some((c) => c.url && currentPath === c.url.toLowerCase());

  const openIndex = isOpen.findIndex((id) => id === collapse.id);
  const isActive = openIndex > -1 || isChildActive || segments.includes(collapseIdLower);
  const triggerIndex = isTrigger.findIndex((id) => id === collapse.id);

  const navItemClass = [
    'pc-item',
    'pc-hasmenu',
    isActive ? 'active' : '',
    triggerIndex > -1 ? 'pc-trigger' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const navLinkClass = ['pc-link', isActive ? 'active' : ''].filter(Boolean).join(' ');

  const handleToggle = (e) => {
    e.preventDefault();
    dispatch({ type: actionType.COLLAPSE_TOGGLE, menu: { id: collapse.id, type } });
  };

  return (
    <li className={navItemClass}>
      <Link to="#" className={navLinkClass} onClick={handleToggle}>
        <NavIcon items={collapse} />
        <span className="pc-mtext">{collapse.title}</span>
        <span className="pc-arrow">
          <ChevronRight size={14} />
        </span>
      </Link>
      <ul className="pc-submenu">
        {navItems}
      </ul>
    </li>
  );
}

NavCollapse.propTypes = { collapse: PropTypes.object, type: PropTypes.string };
