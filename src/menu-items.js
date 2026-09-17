import permissionService from './services/permissionService';

// Dynamic / cached CRM navigation items matching https://demoapi.enstasol.com/api/Permission
const menuItems = permissionService.getNavigation();

export default menuItems;
