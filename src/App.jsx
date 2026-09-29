import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';

// project imports
import router from 'routes';

// -----------------------|| APP ||-----------------------//

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </>
  );
}

