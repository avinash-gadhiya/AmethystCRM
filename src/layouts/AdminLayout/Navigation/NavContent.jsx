import PropTypes from 'prop-types';
import { useContext } from 'react';
import { Link } from 'react-router-dom';

// project imports
import NavGroup from './NavGroup';
import { ConfigContext } from 'contexts/ConfigContext';

// third party
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

// assets
import logo from 'assets/images/logo.svg';
import logoThumb from 'assets/images/favicon.svg';

// -----------------------|| NAV CONTENT ||-----------------------//

export default function NavContent({ navigation }) {
  const configContext = useContext(ConfigContext);
  const { collapseLayout } = configContext.state;

  const firstNavigationPath = navigation
    .flatMap((group) => group.children || [])
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

  const navListNode = (
    <ul className="pc-navbar">
      {navItems}
    </ul>
  );

  const navContentNode = collapseLayout ? (
    navListNode
  ) : (
    <SimpleBar style={{ height: 'calc(100vh - 70px)' }}>
      {navListNode}
    </SimpleBar>
  );

  return (
    <>
      <div className="m-header">
        <Link to={firstNavigationPath || '/Dashboards'} className="b-brand">
          <img src={logo} alt="DashboardKit" className="logo logo-lg" />
          <img src={logoThumb} alt="DashboardKit" className="logo logo-sm" />
        </Link>
      </div>
      <div className="navbar-content next-scroll">
        {navContentNode}
      </div>
    </>
  );
}

NavContent.propTypes = { navigation: PropTypes.any };
