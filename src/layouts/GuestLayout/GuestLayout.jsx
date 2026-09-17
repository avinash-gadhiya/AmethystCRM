import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

// project imports
import Loader from 'components/Loader/Loader';

// -----------------------|| GUEST LAYOUT ||-----------------------//

export default function GuestLayout() {
  return (
    <Suspense fallback={<Loader />}>
      <Outlet />
    </Suspense>
  );
}
