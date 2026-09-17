import PropTypes from 'prop-types';

// project imports
import NavCollapse from './NavCollapse';
import NavItem from './NavItem';

// -----------------------|| NAV GROUP ||-----------------------//

export default function NavGroup({ group, id }) {
  let navItems = null;

  if (group.children) {
    const groups = group.children;
    navItems = Object.keys(groups).map((key) => {
      const item = groups[key];
      switch (item.type) {
        case 'collapse':
          return <NavCollapse key={`nav-collapse-${item.id}`} collapse={item} type="main" />;
        case 'item':
          return <NavItem key={`nav-item-${item.id}`} item={item} />;
        default:
          return null;
      }
    });
  }

  return (
    <>
      {group.title && (
        <li className="pc-item pc-caption" id={id} key={group.id}>
          <label>{group.title}</label>
          {group.subtitle && <span>{group.subtitle}</span>}
        </li>
      )}
      {navItems}
    </>
  );
}

NavGroup.propTypes = { group: PropTypes.any, id: PropTypes.any };
