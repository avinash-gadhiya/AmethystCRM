// third party
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from './providers/ConfigProvider';

// project imports
import App from './App';
import reportWebVitals from './reportWebVitals';
import authService from './services/authService';
import './services/http';

// Tailwind CSS + all custom styles
import './index.css';

// -----------------------|| REACT DOM RENDER  ||-----------------------//

const container = document.getElementById('root');
authService.setupAxios();
const root = createRoot(container);
root.render(
  <ConfigProvider>
    <App />
  </ConfigProvider>
);

reportWebVitals();
