// third party
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from './contexts/ConfigContext';

// project imports
import App from './App';
import reportWebVitals from './reportWebVitals';

// Tailwind CSS + all custom styles
import './index.css';

// -----------------------|| REACT DOM RENDER  ||-----------------------//

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <ConfigProvider>
    <App />
  </ConfigProvider>
);

reportWebVitals();
