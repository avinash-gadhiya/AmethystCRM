import { useContext } from 'react';
// third party - Lucide icons
import { Menu, MoreVertical } from 'lucide-react';

// project imports
import { ConfigContext } from 'providers/ConfigProvider';
import * as actionType from 'store/actions';

// assets
import crmLogo from 'assets/images/crm-brain-logo.png';

// -----------------------|| MOBILE HEADER ||-----------------------//

export default function MobileHeader() {
  const configContext = useContext(ConfigContext);
  const { collapseHeaderMenu } = configContext.state;
  const { dispatch } = configContext;

  const navToggleHandler = () => {
    dispatch({ type: actionType.COLLAPSE_MENU });
  };

  const headerToggleHandler = () => {
    dispatch({ type: actionType.COLLAPSE_HEADERMENU, collapseHeaderMenu: !collapseHeaderMenu });
  };

  return (
    <div className="pc-mob-header">
      <div className="pcm-logo">
        <span className="sidebar-brand-mark" aria-hidden="true">
          <img src={crmLogo} alt="" width={40} height={40} className="mobile-crm-logo" />
        </span>
        <span className="sidebar-brand-name">CRM</span>
      </div>
      <div className="pcm-toolbar">
        <button type="button" className="pc-head-link" id="mobile-collapse" onClick={navToggleHandler} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <button type="button" className="pc-head-link" id="header-collapse" onClick={headerToggleHandler} aria-label="Toggle header actions">
          <MoreVertical size={18} title="more" />
        </button>
      </div>
    </div>
  );
}
