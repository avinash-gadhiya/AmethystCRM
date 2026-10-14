import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';

// project imports
import SessionExpiryHandler from 'auth/SessionExpiryHandler';
import router from 'routing';

// -----------------------|| APP ||-----------------------//

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <SessionExpiryHandler />
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </>
  );
}
