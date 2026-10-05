import PropTypes from 'prop-types';
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// project imports
import NavGroup from './NavGroup';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';

// third party
import { Blocks, ChevronLeft, ChevronRight, LogOut, UserCircle } from 'lucide-react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

// assets
import authService from 'services/authService';

// -----------------------|| NAV CONTENT ||-----------------------//

export default function NavContent({ navigation }) {
  const configContext = useContext(ConfigContext);
  const { collapseLayout, collapseMenu } = configContext.state;
  const { dispatch } = configContext;
  const navigate = useNavigate();

  const isProfileNavItem = (item) => {
    const title = String(item?.title || '').trim().toLowerCase().replace(/[\s-_]/g, '');
    const url = String(item?.url || '').trim().toLowerCase().replace(/[\s-_]/g, '');
    return title === 'myprofile' || title === 'profile' || url === '/myprofile' || url === '/profile';
  };

  const firstNavigationPath = navigation
    .flatMap((group) => group.children || [])
    .filter((item) => !isProfileNavItem(item))
    .map((item) => item.url || item.children?.find((child) => child.url)?.url)
    .find(Boolean);

  const navItems = navigation.map((item) => {
    switch (item.type) {
      case 'group':
        return <NavGroup group={item} key={`nav-group-${item.id}`} />;
      default:
        return null;
    }
  });

  const navListNode = <ul className="pc-navbar">{navItems}</ul>;

  const navContentNode = collapseLayout ? navListNode : <SimpleBar style={{ height: '100%' }}>{navListNode}</SimpleBar>;

  return (
    <>
      <div className="m-header">
        <Link to={firstNavigationPath || '/Dashboards'} className="b-brand">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <Blocks size={23} strokeWidth={2.2} />
          </span>
          <span className="sidebar-brand-name">DashboardKit CRM</span>
        </Link>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => dispatch({ type: actionType.COLLAPSE_MENU })}
          title={collapseMenu ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          {collapseMenu ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
      <div className="navbar-content next-scroll" aria-label="Workspace navigation">
        {navContentNode}
      </div>
      <div className="sidebar-account-actions" aria-label="Account actions">
        <Link to="/MyProfile" className="pc-link sidebar-account-link" title="Profile">
          <span className="pc-micon">
            <UserCircle size={20} />
          </span>
          <span className="pc-mtext">Profile</span>
        </Link>
        <button
          type="button"
          className="pc-link sidebar-account-link sidebar-logout-link"
          onClick={() => {
            authService.logout();
            navigate('/login', { replace: true });
          }}
          title="Logout"
        >
          <span className="pc-micon">
            <LogOut size={20} />
          </span>
          <span className="pc-mtext">Logout</span>
        </button>
      </div>
    </>
  );
}

NavContent.propTypes = { navigation: PropTypes.any };
