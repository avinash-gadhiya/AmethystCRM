import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';

import CRMApiWorkspacePage from './api/CRMApiWorkspacePage';
import LeadSchedulerPage from './LeadSchedulerPage';

export default function CRMModuleView({ moduleName }) {
  const { pathname } = useLocation();
  if (String(moduleName || '').replace(/[^a-z]/gi, '').toLowerCase() === 'leadscheduler') {
    return <LeadSchedulerPage />;
  }
  // Remount per route so the selected module and data views reset when navigating between modules.
  return <CRMApiWorkspacePage key={`${moduleName || ''}:${pathname.toLowerCase()}`} moduleName={moduleName} />;
}

CRMModuleView.propTypes = { moduleName: PropTypes.string };
