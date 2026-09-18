import PropTypes from 'prop-types';
import { createContext, useReducer } from 'react';

// project imports
import * as actionType from 'store/actions';
import { CONFIG } from 'config/constant';

const initialState = {
  ...CONFIG,
  isOpen: [], // for active default menu
  isTrigger: [] // for active default menu, set blank for horizontal
};
const ConfigContext = createContext({});
const { Provider } = ConfigContext;

function ConfigProvider({ children }) {
  let trigger = [];
  let open = [];

  const [state, dispatch] = useReducer((stateData, action) => {
    switch (action.type) {
      case actionType.COLLAPSE_MENU:
        return {
          ...stateData,
          collapseMenu: !stateData.collapseMenu
        };
      case actionType.COLLAPSE_HEADERMENU:
        return {
          ...stateData,
          collapseHeaderMenu: !stateData.collapseHeaderMenu
        };

      case actionType.COLLAPSE_OPEN: {
        const id = action.menu?.id;
        if (!id) return stateData;
        const currentTriggers = Array.isArray(stateData.isTrigger) ? stateData.isTrigger : [];
        const currentOpen = Array.isArray(stateData.isOpen) ? stateData.isOpen : [];
        if (currentTriggers.includes(id)) return stateData;
        return {
          ...stateData,
          isTrigger: [...currentTriggers, id],
          isOpen: currentOpen.includes(id) ? currentOpen : [...currentOpen, id]
        };
      }

      case actionType.COLLAPSE_TOGGLE: {
        const id = action.menu?.id;
        if (!id) return stateData;
        const currentTriggers = Array.isArray(stateData.isTrigger) ? stateData.isTrigger : [];
        const currentOpen = Array.isArray(stateData.isOpen) ? stateData.isOpen : [];
        const isCurrentlyOpen = currentTriggers.includes(id);

        return {
          ...stateData,
          isTrigger: isCurrentlyOpen
            ? currentTriggers.filter((item) => item !== id)
            : [...currentTriggers, id],
          isOpen: isCurrentlyOpen
            ? currentOpen.filter((item) => item !== id)
            : [...currentOpen, id]
        };
      }
      default:
        throw new Error();
    }
  }, initialState);
  return (
    <Provider value={{ state, dispatch }}>
      <>{children}</>{' '}
    </Provider>
  );
}

export { ConfigContext, ConfigProvider };

ConfigProvider.propTypes = { children: PropTypes.any };
