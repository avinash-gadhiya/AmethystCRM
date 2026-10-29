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
        if (stateData.isTrigger?.length === 1 && stateData.isTrigger[0] === id) return stateData;
        return {
          ...stateData,
          isTrigger: [id],
          isOpen: [id]
        };
      }

      case actionType.COLLAPSE_TOGGLE: {
        const id = action.menu?.id;
        if (!id) return stateData;
        const currentTriggers = Array.isArray(stateData.isTrigger) ? stateData.isTrigger : [];
        const isCurrentlyOpen = currentTriggers.includes(id);

        return {
          ...stateData,
          isTrigger: isCurrentlyOpen ? [] : [id],
          isOpen: isCurrentlyOpen ? [] : [id]
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
