import { useContext, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

// project imports
import MobileHeader from './MobileHeader';
import Navigation from './Navigation';
import NavBar from './NavBar';
import Breadcrumb from './Breadcrumb';
import useWindowSize from 'hooks/useWindowSize';
import { ConfigContext } from 'contexts/ConfigContext';
import Loader from 'components/Loader/Loader';

// -----------------------|| ADMIN LAYOUT ||-----------------------//

export default function AdminLayout() {
  const windowSize = useWindowSize();
  const configContext = useContext(ConfigContext);
  const bodyElement = document.body;
  const { collapseLayout, collapseMenu } = configContext.state;

  useEffect(() => {
    const shouldUseMiniMenu = windowSize.width > 1024 && (collapseMenu || collapseLayout);
    bodyElement.classList.toggle('minimenu', Boolean(shouldUseMiniMenu));

    return () => bodyElement.classList.remove('minimenu');
  }, [bodyElement, collapseLayout, collapseMenu, windowSize.width]);

  const containerClass = ['pc-container'];

  return (
    <>
      <MobileHeader />
      <NavBar />
      <Navigation />
      <div className={containerClass.join(' ')}>
        <Breadcrumb />
        <div className="pcoded-content">
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </>
  );
}
