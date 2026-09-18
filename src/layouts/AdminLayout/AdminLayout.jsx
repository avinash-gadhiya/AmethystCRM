import { useContext, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

// project imports
import MobileHeader from './MobileHeader';
import Navigation from './Navigation';
import NavBar from './NavBar';
import Breadcrumb from './Breadcrumb';
import useWindowSize from 'hooks/useWindowSize';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';
import Loader from 'components/Loader/Loader';

// -----------------------|| ADMIN LAYOUT ||-----------------------//

export default function AdminLayout() {
  const windowSize = useWindowSize();
  const configContext = useContext(ConfigContext);
  const bodyElement = document.body;
  const { collapseLayout, collapseMenu } = configContext.state;
  const { dispatch } = configContext;

  useEffect(() => {
    if (windowSize.width > 992 && windowSize.width <= 1024) {
      dispatch({ type: actionType.COLLAPSE_MENU });
    }
  }, [dispatch, windowSize]);

  if (windowSize.width > 992 && (collapseMenu || collapseLayout)) {
    bodyElement.classList.add('minimenu');
  } else {
    bodyElement.classList.remove('minimenu');
  }

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
