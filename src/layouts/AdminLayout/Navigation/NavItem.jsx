import PropTypes from 'prop-types';
import { useContext } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

// third party - Lucide icons
import { ChevronRight } from 'lucide-react';

// project imports
import NavIcon from './NavIcon';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';
import useWindowSize from 'hooks/useWindowSize';

// -----------------------|| NAV ITEM ||-----------------------//

export default function NavItem({ item }) {
  const windowSize = useWindowSize();
  const configContext = useContext(ConfigContext);
  const { dispatch } = configContext;
  const location = useLocation();

  const currentPath = (location.pathname || window.location.pathname).toLowerCase();
  const isItemActive = item.url && currentPath === item.url.toLowerCase();
  const currentIndex = document.location.pathname
    .toString()
    .split('/')
    .findIndex((id) => id === item.id);

  const navItemClass = ['pc-item', currentIndex > -1 || isItemActive ? 'active' : '']
    .filter(Boolean)
    .join(' ');

  let subContent;
  if (item.external) {
    subContent = (
      <Link to={item.url} target="_blank" rel="noopener noreferrer" className="pc-link">
        <NavIcon items={item} />
        <span className="pc-mtext">{item.title}</span>
        {item.type === 'collapse' && (
          <span className="pc-arrow">
            <ChevronRight size={14} />
          </span>
        )}
      </Link>
    );
  } else {
    subContent = (
      <NavLink to={item.url} className="pc-link">
        <NavIcon items={item} />
        <span className="pc-mtext">{item.title}</span>
        {item.type === 'collapse' && (
          <span className="pc-arrow">
            <ChevronRight size={14} />
          </span>
        )}
      </NavLink>
    );
  }

  const handleMobileClick = windowSize.width < 992
    ? () => dispatch({ type: actionType.COLLAPSE_MENU })
    : undefined;

  return (
    <li className={navItemClass} onClick={handleMobileClick}>
      {subContent}
    </li>
  );
}

NavItem.propTypes = { item: PropTypes.any };
