import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';

import CRMApiWorkspacePage from './api/CRMApiWorkspacePage';

export default function CRMModuleView({ moduleName }) {
  const { pathname } = useLocation();
  // Remount per route so the selected module and data views reset when navigating between modules.
  return <CRMApiWorkspacePage key={`${moduleName || ''}:${pathname.toLowerCase()}`} moduleName={moduleName} />;
}

CRMModuleView.propTypes = { moduleName: PropTypes.string };
