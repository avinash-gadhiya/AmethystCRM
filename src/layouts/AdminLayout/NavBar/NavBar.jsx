import { useContext } from 'react';

// project imports
import NavLeft from './NavLeft';
import NavRight from './NavRight';
import { ConfigContext } from 'contexts/ConfigContext';

// -----------------------|| NAV BAR ||-----------------------//

export default function NavBar() {
  const configContext = useContext(ConfigContext);
  const { collapseTabMenu, collapseHeaderMenu } = configContext.state;

  const headerClass = [
    'pc-header',
    collapseHeaderMenu ? 'mob-header-active' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClass}>
      <div className="header-wrapper">
        <div className={`me-auto pc-mob-drp${collapseTabMenu ? ' mob-drp-active' : ''}`}>
          <NavLeft />
        </div>
        <div className="ms-auto">
          <NavRight />
        </div>
      </div>
      {(collapseTabMenu || collapseHeaderMenu) && (
        <div className="pc-md-overlay" />
      )}
    </header>
  );
}
