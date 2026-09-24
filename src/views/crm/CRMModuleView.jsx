import PropTypes from 'prop-types';

import CRMApiWorkspacePage from './api/CRMApiWorkspacePage';

export default function CRMModuleView({ moduleName }) {
  return <CRMApiWorkspacePage moduleName={moduleName} />;
}

CRMModuleView.propTypes = { moduleName: PropTypes.string };
