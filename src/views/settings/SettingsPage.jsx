import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import {
  Award,
  CheckCircle2,
  Database,
  Eye,
  Info,
  Layers,
  ListFilter,
  ListTree,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Globe,
  Tags,
  Trash2,
  FileText,
  Menu as MenuIcon,
  MapPin,
  Target,
  XCircle,
  Mail
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

import settingService from 'services/settingService';
import roleService from 'services/roleService';
import BlockedIpPage from './ip/BlockedIpPage';
import CountryPage from './country/CountryPage';
import SettingPage from './setting/SettingPage';
import BrandListPage from './brand/BrandListPage';
import BrandDetailsPage from './brand/BrandDetailsPage';
import GroupPage from './group/GroupPage';
import GroupEmailPage from './group-email/GroupEmailPage';
import PagesPage from './pages/PagesPage';
import MenusPage from './menus/MenusPage';
import TemplatePage from './template/TemplatePage';
import LocationPage from './location/LocationPage';
import SalesTargetPage from './sales-target/SalesTargetPage';
import BrandTemplatePage from './brand/BrandTemplatePage';

const PAGE_SIZES = [10, 25, 50, 100];
const SECTIONS = [
  { id: 'settings', label: 'Settings', icon: Database, endpoint: '/Setting' },
  { id: 'values', label: 'Setting Values', icon: Tags, endpoint: '/SettingValue' },
  { id: 'roles', label: 'Role Management', icon: ShieldCheck, endpoint: '/Role' },
  { id: 'templates', label: 'Templates', icon: FileText, endpoint: '/Template' },
  { id: 'menus', label: 'Menus', icon: MenuIcon, endpoint: '/Menu' },
  { id: 'pages', label: 'Pages', icon: FileText, endpoint: '/Page' },
  { id: 'location', label: 'Locations', icon: MapPin, endpoint: '/Location' },
  { id: 'salestarget', label: 'Sales Target', icon: Target, endpoint: '/User' },
  { id: 'group', label: 'Groups', icon: Layers, endpoint: '/Group' },
  { id: 'groupemail', label: 'Group Email', icon: Mail, endpoint: '/GroupEmail' },
  { id: 'brand', label: 'Brands', icon: Award, endpoint: '/Brand' },
  { id: 'brandtemplate', label: 'Brand Template', icon: FileText, endpoint: '/BrandEmailTemplates' },
  { id: 'country', label: 'Countries & States', icon: Globe, endpoint: '/Country & /State' },
  { id: 'ip', label: 'Blocked IP Addresses', icon: ShieldAlert, endpoint: '/BlockIp' },
  { id: 'dropdown', label: 'Dropdown Lookup', icon: ListTree, endpoint: '/SettingValue & /Role/RoleDropdown' }
];

const EMPTY_SETTING = { settingId: 0, settingName: '', settingKey: '', isActive: true, settingValueDTOs: [] };
const EMPTY_VALUE = { settingValueId: 0, settingId: '', settingValueText: '', isActive: true };
const EMPTY_ROLE = { roleId: 0, roleName: '', roleDescription: '', isSystemRole: false, isActive: true };

const sectionFromPath = (pathname) => {
  const lower = (pathname || '').toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (compact.includes('brandtemplate')) return 'brandtemplate';
  if (compact.includes('brandemail') || compact.includes('branddetails')) return 'branddetails';
  if (compact.includes('salestarget')) return 'salestarget';
  if (compact.includes('groupemail')) return 'groupemail';
  if (lower.includes('template')) return 'templates';
  if (lower.includes('location')) return 'location';
  if (lower.includes('menu')) return 'menus';
  if (lower.includes('page')) return 'pages';
  if (lower.includes('brand')) return 'brand';
  if (lower.includes('group')) return 'group';
  if (lower.includes('country') || lower.includes('state')) return 'country';
  if (lower.includes('ip') || lower.includes('block')) return 'ip';
  if (lower.includes('role')) return 'roles';
  if (lower.includes('settingvalue') || lower.includes('values')) return 'values';

  // Resolve custom URLs supplied by the Page API from the permission cache.
  try {
    const normalizedPath = lower.replace(/\/+$/, '') || '/';
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus'
    );
    const menus = cacheKeys.flatMap((key) => {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    });
    const matchingPages = menus.flatMap((menu) => menu?.menuPermissionPageDTOs || []).filter((page) => {
        const name = String(page?.pageName || page?.pageDisplayName || '').trim().toLowerCase();
        const url = String(page?.pageUrl || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
        return url === normalizedPath && name;
      });
    const matchesBrandTemplatePage = matchingPages.some((page) => {
      const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return name === 'brandtemplate' || name === 'brandtemplates';
    });
    if (matchesBrandTemplatePage) return 'brandtemplate';
    const matchesGroupEmailPage = matchingPages.some((page) => {
      const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return name === 'groupemail' || name === 'groupemails';
    });
    if (matchesGroupEmailPage) return 'groupemail';
    const matchesLocationPage = matchingPages.some((page) => {
      const name = String(page?.pageName || page?.pageDisplayName || '').trim().toLowerCase();
      return name === 'location' || name === 'locations';
    });
    if (matchesLocationPage) return 'location';
  } catch {
    // Invalid or unavailable cache data falls back to the standard Settings section.
  }
  return 'settings';
};

const Pagination = ({ page, pageSize, total, onPage, onPageSize }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
      <span className="small text-muted">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="d-flex align-items-center gap-2">
        <Form.Select size="sm" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} style={{ width: 85 }}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Form.Select>
        <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="small text-nowrap">{page} / {pages}</span>
        <Button size="sm" variant="outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </Card.Footer>
  );
};

export default function SettingsPage() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => sectionFromPath(location.pathname));
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [settingFilter, setSettingFilter] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Role section specific states
  const [roleSortProperty, setRoleSortProperty] = useState('roleId');
  const [roleSortDescending, setRoleSortDescending] = useState(false);
  const [roleStatusFilter, setRoleStatusFilter] = useState('all'); // all, active, inactive
  const [roleTypeFilter, setRoleTypeFilter] = useState('all'); // all, system, custom
  const [showRoleDropdownExplorer, setShowRoleDropdownExplorer] = useState(false);
  const [roleDropdownPreviewItems, setRoleDropdownPreviewItems] = useState([]);
  const [roleDropdownLoading, setRoleDropdownLoading] = useState(false);
  const [roleDropdownSearch, setRoleDropdownSearch] = useState('');
  const [selectedPreviewRole, setSelectedPreviewRole] = useState('');

  // Role View Modal (/api/Role/{id})
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loadingRoleDetails, setLoadingRoleDetails] = useState(false);

  // Editors
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [settingForm, setSettingForm] = useState(EMPTY_SETTING);
  const [showValueEditor, setShowValueEditor] = useState(false);
  const [valueForm, setValueForm] = useState(EMPTY_VALUE);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE);
  const [loadingRoleForEdit, setLoadingRoleForEdit] = useState(false);

  const [saving, setSaving] = useState(false);

  // Dropdown Lookup tab states
  const [dropdownTab, setDropdownTab] = useState('role'); // 'role' or 'settingValue'
  const [lookupKey, setLookupKey] = useState('');
  const [lookupRows, setLookupRows] = useState([]);
  const [roleLookupText, setRoleLookupText] = useState('');
  const [roleLookupRows, setRoleLookupRows] = useState([]);
  const [roleLookupLoading, setRoleLookupLoading] = useState(false);
  const [selectedRoleDropdownId, setSelectedRoleDropdownId] = useState('');

  const section = SECTIONS.find((item) => item.id === activeSection) || SECTIONS[0];

  useEffect(() => {
    setActiveSection(sectionFromPath(location.pathname));
  }, [location.pathname]);

  // Load settings list for dropdowns
  useEffect(() => {
    const controller = new AbortController();
    settingService
      .getSettings({ PageNumber: 1, PageSize: 1000, IsDescending: false }, controller.signal)
      .then((response) => setSettings(response.data))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setSettings([]);
      });
    return () => controller.abort();
  }, [refreshKey]);

  // Load Main Rows
  const loadRows = useCallback(
    async (signal) => {
      if (
        activeSection === 'dropdown' ||
        activeSection === 'ip' ||
        activeSection === 'country' ||
        activeSection === 'settings' ||
        activeSection === 'values'
      ) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        if (activeSection === 'roles') {
          // Calls GET /api/Role
          const response = await roleService.getRoles(
            {
              Text: searchText,
              PageNumber: page,
              PageSize: pageSize,
              SortProperty: roleSortProperty,
              IsDescending: roleSortDescending
            },
            signal
          );
          setRows(response.data);
          setTotalCount(response.totalCount);
          return;
        }

        const params = {
          Text: searchText,
          SettingId: settingFilter,
          PageNumber: page,
          PageSize: pageSize,
          IsDescending: true
        };
        const response =
          activeSection === 'settings'
            ? await settingService.getSettings({ ...params, SortProperty: 'settingId' }, signal)
            : await settingService.getSettingValues({ ...params, SortProperty: 'settingValueId' }, signal);
        setRows(response.data);
        setTotalCount(response.totalCount);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setTotalCount(0);
        setError(requestError.message || `Unable to load ${activeSection}.`);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeSection, page, pageSize, searchText, settingFilter, roleSortProperty, roleSortDescending]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadRows(controller.signal);
    return () => controller.abort();
  }, [loadRows, refreshKey]);

  const switchSection = (nextSection) => {
    setActiveSection(nextSection);
    setRows([]);
    setPage(1);
    setSearchInput('');
    setSearchText('');
    setSettingFilter('');
    setRoleStatusFilter('all');
    setRoleTypeFilter('all');
    setError('');
    setSuccess('');
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchText('');
    setPage(1);
  };

  // Setting CRUD
  const saveSetting = async (event) => {
    event.preventDefault();
    if (!settingForm.settingName.trim() || !settingForm.settingKey.trim()) {
      setError('Setting name and key are required.');
      return;
    }
    const payload = {
      settingId: Number(settingForm.settingId) || 0,
      settingName: settingForm.settingName.trim(),
      settingKey: settingForm.settingKey.trim(),
      isActive: Boolean(settingForm.isActive),
      settingValueDTOs: Array.isArray(settingForm.settingValueDTOs) ? settingForm.settingValueDTOs : []
    };
    setSaving(true);
    try {
      if (payload.settingId) await settingService.updateSetting(payload);
      else await settingService.createSetting(payload);
      setSuccess(`Setting ${payload.settingId ? 'updated' : 'created'} successfully.`);
      setShowSettingEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save setting.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSetting = async (setting) => {
    if (!window.confirm(`Delete setting “${setting.settingName}”?`)) return;
    try {
      await settingService.deleteSetting(setting.settingId);
      setSuccess('Setting deleted successfully.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete setting.');
    }
  };

  // Setting Value CRUD
  const saveValue = async (event) => {
    event.preventDefault();
    if (Number(valueForm.settingId) <= 0 || !valueForm.settingValueText.trim()) {
      setError('Setting and value text are required.');
      return;
    }
    const payload = {
      settingValueId: Number(valueForm.settingValueId) || 0,
      settingId: Number(valueForm.settingId),
      settingValueText: valueForm.settingValueText.trim(),
      isActive: Boolean(valueForm.isActive)
    };
    setSaving(true);
    try {
      if (payload.settingValueId) await settingService.updateSettingValue(payload);
      else await settingService.createSettingValue(payload);
      setSuccess(`Setting value ${payload.settingValueId ? 'updated' : 'created'} successfully.`);
      setShowValueEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save setting value.');
    } finally {
      setSaving(false);
    }
  };

  const deleteValue = async (value) => {
    if (!window.confirm(`Delete setting value “${value.settingValueText}”?`)) return;
    try {
      await settingService.deleteSettingValue(value.settingValueId);
      setSuccess('Setting value deleted successfully.');
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete setting value.');
    }
  };

  // ==========================================
  // Role Section Implementations
  // Endpoints:
  // 1. GET    /api/Role
  // 2. POST   /api/Role
  // 3. PUT    /api/Role
  // 4. DELETE /api/Role?id={id}
  // 5. GET    /api/Role/RoleDropdown
  // 6. GET    /api/Role/{id}
  // ==========================================

  // View Role Details -> GET /api/Role/{id}
  const viewRoleDetails = async (role) => {
    setSelectedRole(role);
    setShowRoleDetails(true);
    setLoadingRoleDetails(true);
    setError('');
    try {
      const details = await roleService.getRoleById(role.roleId);
      if (details) setSelectedRole(details);
    } catch (requestError) {
      // Keep initial role row info if fetch fails
      console.warn('Failed to fetch detailed role by ID:', requestError);
    } finally {
      setLoadingRoleDetails(false);
    }
  };

  // Open Role Editor -> Loads via GET /api/Role/{id} if editing
  const openRoleEditor = async (role = null) => {
    if (!role) {
      setRoleForm({ ...EMPTY_ROLE });
      setShowRoleEditor(true);
      return;
    }

    setRoleForm({ ...EMPTY_ROLE, ...role });
    setShowRoleEditor(true);
    setLoadingRoleForEdit(true);
    try {
      const details = await roleService.getRoleById(role.roleId);
      if (details) {
        setRoleForm({
          roleId: details.roleId ?? role.roleId,
          roleName: details.roleName ?? role.roleName ?? '',
          roleDescription: details.roleDescription ?? role.roleDescription ?? '',
          isSystemRole: Boolean(details.isSystemRole ?? role.isSystemRole),
          isActive: details.isActive !== undefined ? Boolean(details.isActive) : Boolean(role.isActive)
        });
      }
    } catch (requestError) {
      console.warn('Failed to reload role for edit:', requestError);
    } finally {
      setLoadingRoleForEdit(false);
    }
  };

  // Save Role -> POST /api/Role (Create) or PUT /api/Role (Update)
  const saveRole = async (event) => {
    event.preventDefault();
    if (!roleForm.roleName.trim()) {
      setError('Role name is required.');
      return;
    }
    const payload = {
      roleId: Number(roleForm.roleId) || 0,
      roleName: roleForm.roleName.trim(),
      roleDescription: roleForm.roleDescription?.trim() || '',
      isSystemRole: Boolean(roleForm.isSystemRole),
      isActive: Boolean(roleForm.isActive)
    };
    setSaving(true);
    setError('');
    try {
      if (payload.roleId) {
        // PUT /api/Role
        await roleService.updateRole(payload);
        setSuccess(`Role #${payload.roleId} "${payload.roleName}" updated successfully.`);
      } else {
        // POST /api/Role
        await roleService.createRole(payload);
        setSuccess(`Role "${payload.roleName}" created successfully.`);
      }
      setShowRoleEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Role -> DELETE /api/Role?id={roleId}
  const deleteRole = async (role) => {
    if (role.isSystemRole) {
      setError(`Protected System Role "${role.roleName}" cannot be deleted.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete role #${role.roleId} "${role.roleName}"?`)) return;
    setError('');
    try {
      await roleService.deleteRole(role.roleId);
      setSuccess(`Role "${role.roleName}" was deleted successfully.`);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete role.');
    }
  };

  // Role Dropdown preview query -> GET /api/Role/RoleDropdown
  const fetchRoleDropdownPreview = async (search = '') => {
    setRoleDropdownLoading(true);
    try {
      const items = await roleService.getRoleDropdown({ Text: search, PageSize: 50 });
      setRoleDropdownPreviewItems(items);
      if (items.length && !selectedPreviewRole) {
        const firstId = items[0].roleId || items[0].id || items[0].value;
        setSelectedPreviewRole(String(firstId));
      }
    } catch (dropdownErr) {
      setRoleDropdownPreviewItems([]);
    } finally {
      setRoleDropdownLoading(false);
    }
  };

  // Trigger dropdown fetch when explorer opens
  const toggleRoleDropdownExplorer = () => {
    const nextState = !showRoleDropdownExplorer;
    setShowRoleDropdownExplorer(nextState);
    if (nextState && !roleDropdownPreviewItems.length) {
      fetchRoleDropdownPreview(roleDropdownSearch);
    }
  };

  // Dropdown Lookup Tab: Setting Value Lookup
  const runLookup = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await settingService.getSettingValueDropdown(lookupKey);
      setLookupRows(response.data);
    } catch (requestError) {
      setLookupRows([]);
      setError(requestError.message || 'Unable to load dropdown values.');
    } finally {
      setLoading(false);
    }
  };

  // Dropdown Lookup Tab: Role Dropdown Lookup -> GET /api/Role/RoleDropdown
  const runRoleLookup = async (event) => {
    if (event) event.preventDefault();
    setRoleLookupLoading(true);
    setError('');
    try {
      const items = await roleService.getRoleDropdown({ Text: roleLookupText, PageSize: 100 });
      setRoleLookupRows(items);
      if (items.length > 0 && !selectedRoleDropdownId) {
        const firstVal = items[0].roleId || items[0].id || items[0].value;
        setSelectedRoleDropdownId(String(firstVal));
      }
    } catch (requestError) {
      setRoleLookupRows([]);
      setError(requestError.message || 'Unable to load role dropdown options.');
    } finally {
      setRoleLookupLoading(false);
    }
  };

  const openValueEditor = (value = null, settingId = '') => {
    setValueForm(value ? { ...EMPTY_VALUE, ...value } : { ...EMPTY_VALUE, settingId });
    setShowValueEditor(true);
  };

  // Filter rows on client side if type or status filters are applied
  const displayedRoles = activeSection === 'roles' ? rows.filter((role) => {
    if (roleStatusFilter === 'active' && role.isActive === false) return false;
    if (roleStatusFilter === 'inactive' && role.isActive !== false) return false;
    if (roleTypeFilter === 'system' && !role.isSystemRole) return false;
    if (roleTypeFilter === 'custom' && role.isSystemRole) return false;
    return true;
  }) : rows;

  // Compute metrics for the role stats bar
  const totalRoles = totalCount;
  const activeRolesCount = rows.filter((r) => r.isActive !== false).length;
  const systemRolesCount = rows.filter((r) => r.isSystemRole).length;
  const customRolesCount = rows.filter((r) => !r.isSystemRole).length;

  return (
    <div>
      {/* Settings / Setting Values Section */}
      {activeSection === 'settings' || activeSection === 'values' ? (
        <div className="mt-2">
          <SettingPage />
        </div>
      ) : activeSection === 'templates' ? (
        <div className="mt-2">
          <TemplatePage />
        </div>
      ) : activeSection === 'menus' ? (
        <div className="mt-2">
          <MenusPage />
        </div>
      ) : activeSection === 'pages' ? (
        <div className="mt-2">
          <PagesPage />
        </div>
      ) : activeSection === 'location' ? (
        <div className="mt-2">
          <LocationPage />
        </div>
      ) : activeSection === 'salestarget' ? (
        <div className="mt-2">
          <SalesTargetPage />
        </div>
      ) : activeSection === 'group' ? (
        <div className="mt-2">
          <GroupPage />
        </div>
      ) : activeSection === 'groupemail' ? (
        <div className="mt-2">
          <GroupEmailPage />
        </div>
      ) : activeSection === 'brand' ? (
        <div className="mt-2">
          <BrandListPage />
        </div>
      ) : activeSection === 'brandtemplate' ? (
        <div className="mt-2">
          <BrandTemplatePage />
        </div>
      ) : activeSection === 'branddetails' ? (
        <div className="mt-2">
          <BrandDetailsPage />
        </div>
      ) : activeSection === 'country' ? (
        <div className="mt-2">
          <CountryPage />
        </div>
      ) : activeSection === 'ip' ? (
        <div className="mt-2">
          <BlockedIpPage />
        </div>
      ) : (
        <>
          {/* Notifications */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-3">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')} className="mb-3">
          {success}
        </Alert>
      )}

      {/* Role Management Section Specific Summary Cards */}
      {activeSection === 'roles' && (
        <>
          <Row className="g-3 mb-3">
            <Col sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex align-items-center gap-3 py-3">
                  <div className="rounded-circle bg-primary bg-opacity-10 p-2.5 text-primary">
                    <Shield size={22} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">Total Roles</span>
                    <span className="fs-5 fw-bold text-dark">{totalRoles}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex align-items-center gap-3 py-3">
                  <div className="rounded-circle bg-success bg-opacity-10 p-2.5 text-success">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">Active Roles</span>
                    <span className="fs-5 fw-bold text-success">{activeRolesCount}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex align-items-center gap-3 py-3">
                  <div className="rounded-circle bg-info bg-opacity-10 p-2.5 text-info">
                    <Lock size={22} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">System Roles</span>
                    <span className="fs-5 fw-bold text-info">{systemRolesCount}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex align-items-center gap-3 py-3">
                  <div className="rounded-circle bg-warning bg-opacity-10 p-2.5 text-warning">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">Custom Roles</span>
                    <span className="fs-5 fw-bold text-dark">{customRolesCount}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Interactive Role Dropdown Explorer Toggle / Card */}
          {showRoleDropdownExplorer && (
            <Card className="border border-primary border-opacity-25 shadow-sm mb-4 bg-light bg-opacity-50">
              <Card.Header className="bg-transparent py-2.5 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <ListTree size={16} className="text-primary" />
                  <span className="fw-semibold text-primary">Role Dropdown Explorer</span>
                  <Badge bg="light" text="dark" className="border font-monospace">GET /api/Role/RoleDropdown</Badge>
                </div>
                <Button size="sm" variant="outline-secondary" onClick={() => setShowRoleDropdownExplorer(false)}>
                  Close
                </Button>
              </Card.Header>
              <Card.Body>
                <Row className="g-3 align-items-end mb-3">
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">Query Text Filter</Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        placeholder="Search dropdown options..."
                        value={roleDropdownSearch}
                        onChange={(e) => setRoleDropdownSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchRoleDropdownPreview(roleDropdownSearch)}
                      />
                      <Button
                        variant="primary"
                        onClick={() => fetchRoleDropdownPreview(roleDropdownSearch)}
                        disabled={roleDropdownLoading}
                      >
                        {roleDropdownLoading ? <Spinner size="sm" /> : 'Fetch Dropdown'}
                      </Button>
                    </InputGroup>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">Interactive Dropdown Preview</Form.Label>
                    <Form.Select
                      size="sm"
                      value={selectedPreviewRole}
                      onChange={(e) => setSelectedPreviewRole(e.target.value)}
                      disabled={roleDropdownLoading || !roleDropdownPreviewItems.length}
                    >
                      {!roleDropdownPreviewItems.length ? (
                        <option value="">No dropdown options loaded</option>
                      ) : (
                        roleDropdownPreviewItems.map((item, idx) => {
                          const id = item.roleId || item.id || item.value || idx;
                          const name = item.roleName || item.name || item.text || item.label || `Role #${id}`;
                          return (
                            <option key={id} value={id}>
                              #{id} - {name}
                            </option>
                          );
                        })
                      )}
                    </Form.Select>
                  </Col>
                </Row>
                <div className="small text-muted">
                  Loaded {roleDropdownPreviewItems.length} option(s) directly from <code className="text-primary">https://demoapi.enstasol.com/api/Role/RoleDropdown</code>.
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}

      {/* Dropdown Lookup Tab */}
      {activeSection === 'dropdown' ? (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-transparent py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h6 className="mb-0 fw-semibold">Dropdown Lookup Service</h6>
                <span className="small text-muted">Test and inspect dropdown APIs for Setting Values and Roles</span>
              </div>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  variant={dropdownTab === 'role' ? 'primary' : 'outline-secondary'}
                  onClick={() => {
                    setDropdownTab('role');
                    if (!roleLookupRows.length) runRoleLookup();
                  }}
                >
                  <ShieldCheck size={14} className="me-1.5" />
                  Role Dropdown (/api/Role/RoleDropdown)
                </Button>
                <Button
                  size="sm"
                  variant={dropdownTab === 'settingValue' ? 'primary' : 'outline-secondary'}
                  onClick={() => setDropdownTab('settingValue')}
                >
                  <Tags size={14} className="me-1.5" />
                  Setting Values Dropdown
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            {dropdownTab === 'role' ? (
              <div>
                <Form onSubmit={runRoleLookup}>
                  <Row className="g-3 align-items-end mb-4">
                    <Col md={8}>
                      <Form.Label className="small fw-semibold">Search Filter (Text)</Form.Label>
                      <Form.Control
                        placeholder="Search roles (leave empty to load all)..."
                        value={roleLookupText}
                        onChange={(event) => setRoleLookupText(event.target.value)}
                      />
                    </Col>
                    <Col md={4} className="d-flex gap-2">
                      <Button type="submit" disabled={roleLookupLoading}>
                        {roleLookupLoading ? <Spinner size="sm" className="me-1" /> : <Search size={14} className="me-1" />}
                        {roleLookupLoading ? 'Loading...' : 'Query Role Dropdown'}
                      </Button>
                    </Col>
                  </Row>
                </Form>

                {roleLookupRows.length > 0 && (
                  <div className="p-3 bg-light rounded mb-3 border">
                    <Form.Label className="small fw-semibold text-primary">Live Select Control Demo</Form.Label>
                    <Form.Select
                      value={selectedRoleDropdownId}
                      onChange={(e) => setSelectedRoleDropdownId(e.target.value)}
                    >
                      {roleLookupRows.map((item, index) => {
                        const id = item.roleId || item.id || item.value || index;
                        const name = item.roleName || item.name || item.text || item.label || `Role #${id}`;
                        return (
                          <option key={id} value={id}>
                            #{id} — {name}
                          </option>
                        );
                      })}
                    </Form.Select>
                  </div>
                )}

                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="px-3 py-3">Role ID</th>
                        <th>Role Name</th>
                        <th>Status</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleLookupLoading ? (
                        <tr>
                          <td colSpan="4" className="text-center py-5">
                            <Spinner size="sm" className="me-2" />
                            Querying /api/Role/RoleDropdown...
                          </td>
                        </tr>
                      ) : roleLookupRows.length ? (
                        roleLookupRows.map((item, index) => {
                          const id = item.roleId || item.id || item.value || index;
                          const name = item.roleName || item.name || item.text || item.label || '-';
                          return (
                            <tr key={id}>
                              <td className="px-3 font-monospace fw-semibold">#{id}</td>
                              <td className="fw-semibold text-primary">{name}</td>
                              <td>
                                <Badge bg={item.isActive !== false ? 'success' : 'secondary'}>
                                  {item.isActive !== false ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                              <td>
                                <Badge bg={item.isSystemRole ? 'info' : 'light'} text={item.isSystemRole ? 'white' : 'dark'} className="border">
                                  {item.isSystemRole ? 'System' : 'Custom'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-5">
                            Click &quot;Query Role Dropdown&quot; to test the endpoint.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            ) : (
              <div>
                <Form onSubmit={runLookup}>
                  <Row className="g-3 align-items-end mb-4">
                    <Col md={8}>
                      <Form.Label className="small fw-semibold">Setting Key</Form.Label>
                      <Form.Control
                        required
                        placeholder="Example: payment_types, lead_sources..."
                        value={lookupKey}
                        onChange={(event) => setLookupKey(event.target.value)}
                      />
                    </Col>
                    <Col md={4}>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Loading...' : 'Load Values'}
                      </Button>
                    </Col>
                  </Row>
                </Form>
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="px-3 py-3">ID</th>
                        <th>Value</th>
                        <th>Setting</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookupRows.length ? (
                        lookupRows.map((value, index) => (
                          <tr key={value.settingValueId || value.id || index}>
                            <td className="px-3 font-monospace">{value.settingValueId || value.id || '-'}</td>
                            <td>{value.settingValueText || value.name || value.text || '-'}</td>
                            <td>{value.settingName || lookupKey}</td>
                            <td>
                              <Badge bg={value.isActive !== false ? 'success' : 'secondary'}>
                                {value.isActive !== false ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-5">
                            Enter a setting key to load dropdown values.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      ) : (
        /* Settings, Setting Values, and Role Management Tables */
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-transparent py-3">
            <Row className="g-2 align-items-center">
              {/* Search box */}
              <Col xs={12} md={5} lg={4}>
                <Form onSubmit={applySearch}>
                  <InputGroup>
                    <InputGroup.Text><Search size={15} /></InputGroup.Text>
                    <Form.Control
                      placeholder={`Search ${section.label.toLowerCase()}...`}
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                    />
                    {searchInput && (
                      <Button variant="outline-secondary" onClick={clearSearch} title="Clear search">
                        ✕
                      </Button>
                    )}
                    <Button type="submit" variant="outline-secondary">Search</Button>
                  </InputGroup>
                </Form>
              </Col>

              {/* Setting Values setting filter */}
              {activeSection === 'values' && (
                <Col xs={12} md={4} lg={3}>
                  <Form.Select
                    value={settingFilter}
                    onChange={(event) => {
                      setSettingFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All settings</option>
                    {settings.map((setting) => (
                      <option key={setting.settingId} value={setting.settingId}>
                        {setting.settingName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {/* Role specific filters */}
              {activeSection === 'roles' && (
                <>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Select
                      size="sm"
                      value={roleStatusFilter}
                      onChange={(e) => setRoleStatusFilter(e.target.value)}
                      title="Filter by status"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Select
                      size="sm"
                      value={roleTypeFilter}
                      onChange={(e) => setRoleTypeFilter(e.target.value)}
                      title="Filter by role type"
                    >
                      <option value="all">All Role Types</option>
                      <option value="system">System Roles</option>
                      <option value="custom">Custom Roles</option>
                    </Form.Select>
                  </Col>
                </>
              )}

              {/* Action Buttons */}
              <Col className="d-flex justify-content-end gap-2 flex-wrap">
                {activeSection === 'roles' && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={toggleRoleDropdownExplorer}
                    title="Inspect GET /api/Role/RoleDropdown endpoint"
                  >
                    <ListTree size={15} className="me-1.5" />
                    Role Dropdown
                  </Button>
                )}
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  disabled={loading}
                  title="Refresh list"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    if (activeSection === 'settings') {
                      setSettingForm({ ...EMPTY_SETTING });
                      setShowSettingEditor(true);
                    } else if (activeSection === 'roles') {
                      openRoleEditor();
                    } else {
                      openValueEditor(null, settingFilter);
                    }
                  }}
                >
                  <Plus size={15} className="me-1.5" />
                  Add {activeSection === 'settings' ? 'Setting' : activeSection === 'roles' ? 'Role' : 'Value'}
                </Button>
              </Col>
            </Row>
          </Card.Header>

          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    {activeSection === 'settings' && (
                      <>
                        <th className="px-3 py-3">Setting</th>
                        <th>Key</th>
                        <th>Values</th>
                        <th>Status</th>
                        <th className="text-end px-3">Actions</th>
                      </>
                    )}
                    {activeSection === 'roles' && (
                      <>
                        <th
                          className="px-3 py-3 cursor-pointer user-select-none"
                          onClick={() => {
                            if (roleSortProperty === 'roleId') {
                              setRoleSortDescending(!roleSortDescending);
                            } else {
                              setRoleSortProperty('roleId');
                              setRoleSortDescending(false);
                            }
                          }}
                        >
                          Role ID {roleSortProperty === 'roleId' ? (roleSortDescending ? '↓' : '↑') : ''}
                        </th>
                        <th
                          className="cursor-pointer user-select-none"
                          onClick={() => {
                            if (roleSortProperty === 'roleName') {
                              setRoleSortDescending(!roleSortDescending);
                            } else {
                              setRoleSortProperty('roleName');
                              setRoleSortDescending(false);
                            }
                          }}
                        >
                          Role Name {roleSortProperty === 'roleName' ? (roleSortDescending ? '↓' : '↑') : ''}
                        </th>
                        <th>Description</th>
                        <th>Role Type</th>
                        <th>Status</th>
                        <th className="text-end px-3">Actions</th>
                      </>
                    )}
                    {activeSection === 'values' && (
                      <>
                        <th className="px-3 py-3">Value</th>
                        <th>Setting</th>
                        <th>Status</th>
                        <th className="text-end px-3">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5">
                        <Spinner size="sm" className="me-2" />
                        Loading {section.label.toLowerCase()}...
                      </td>
                    </tr>
                  ) : !displayedRoles.length ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-5">
                        <div className="py-3">
                          <p className="mb-1 fw-semibold">No records found</p>
                          <small className="text-muted">
                            {searchText ? `No match for "${searchText}".` : 'No data available in this section.'}
                          </small>
                        </div>
                      </td>
                    </tr>
                  ) : activeSection === 'settings' ? (
                    displayedRoles.map((setting) => (
                      <tr key={setting.settingId}>
                        <td className="px-3">
                          <div className="fw-semibold text-primary">{setting.settingName || '-'}</div>
                          <small className="text-muted">ID {setting.settingId}</small>
                        </td>
                        <td><code>{setting.settingKey || '-'}</code></td>
                        <td>
                          <Badge bg="light" text="dark" className="border">
                            {Array.isArray(setting.settingValueDTOs) ? setting.settingValueDTOs.length : 0} values
                          </Badge>
                          <Button size="sm" variant="link" onClick={() => { switchSection('values'); setSettingFilter(String(setting.settingId)); }}>
                            View
                          </Button>
                        </td>
                        <td>
                          <Badge bg={setting.isActive ? 'success' : 'secondary'}>
                            {setting.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap text-end px-3">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() => { setSettingForm({ ...EMPTY_SETTING, ...setting }); setShowSettingEditor(true); }}
                            title="Edit Setting"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => deleteSetting(setting)} title="Delete Setting">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : activeSection === 'roles' ? (
                    displayedRoles.map((role) => (
                      <tr key={role.roleId}>
                        <td className="px-3 font-monospace">
                          <span className="fw-semibold text-muted">#{role.roleId}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Shield size={16} className={role.isSystemRole ? 'text-primary' : 'text-secondary'} />
                            <span className="fw-semibold text-primary">{role.roleName || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-muted small">
                            {role.roleDescription || '—'}
                          </span>
                        </td>
                        <td>
                          <Badge
                            bg={role.isSystemRole ? 'info' : 'light'}
                            text={role.isSystemRole ? 'white' : 'dark'}
                            className="border d-inline-flex align-items-center gap-1"
                          >
                            {role.isSystemRole && <Lock size={11} />}
                            {role.isSystemRole ? 'System Role' : 'Custom Role'}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            bg={role.isActive !== false ? 'success' : 'secondary'}
                            className="d-inline-flex align-items-center gap-1"
                          >
                            {role.isActive !== false ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {role.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap text-end px-3">
                          {/* View Role Details (GET /api/Role/{id}) */}
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1.5"
                            onClick={() => viewRoleDetails(role)}
                            title="View Role Details (GET /api/Role/{id})"
                          >
                            <Eye size={14} />
                          </Button>

                          {/* Edit Role (PUT /api/Role) */}
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1.5"
                            onClick={() => openRoleEditor(role)}
                            title="Edit Role (PUT /api/Role)"
                          >
                            <Pencil size={14} />
                          </Button>

                          {/* Delete Role (DELETE /api/Role?id={id}) */}
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => deleteRole(role)}
                            title={role.isSystemRole ? 'System Roles cannot be deleted' : 'Delete Role (DELETE /api/Role)'}
                            disabled={Boolean(role.isSystemRole)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    displayedRoles.map((value) => (
                      <tr key={value.settingValueId}>
                        <td className="px-3">
                          <div className="fw-semibold">{value.settingValueText || '-'}</div>
                          <small className="text-muted">ID {value.settingValueId}</small>
                        </td>
                        <td>
                          {value.settingName || settings.find((setting) => Number(setting.settingId) === Number(value.settingId))?.settingName || value.settingId || '-'}
                        </td>
                        <td>
                          <Badge bg={value.isActive ? 'success' : 'secondary'}>
                            {value.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap text-end px-3">
                          <Button size="sm" variant="outline-primary" className="me-2" onClick={() => openValueEditor(value)}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => deleteValue(value)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalCount}
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
          />
        </Card>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Role View Details Modal (GET /api/Role/{id})      */}
      {/* ========================================================= */}
      <Modal show={showRoleDetails} onHide={() => setShowRoleDetails(false)} centered size="lg">
        <Modal.Header closeButton>
          <div className="d-flex align-items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            <Modal.Title className="mb-0">
              Role Details {selectedRole?.roleName ? `— ${selectedRole.roleName}` : ''}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body>
          {loadingRoleDetails ? (
            <div className="text-center py-4">
              <Spinner size="sm" className="me-2" />
              Loading role information from API...
            </div>
          ) : selectedRole ? (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3 p-2.5 bg-light rounded border">
                <span className="small text-muted font-monospace">Endpoint: GET /api/Role/{selectedRole.roleId}</span>
                <Badge bg={selectedRole.isActive !== false ? 'success' : 'secondary'}>
                  {selectedRole.isActive !== false ? 'Active Status' : 'Inactive Status'}
                </Badge>
              </div>

              <Row className="g-3">
                <Col sm={6}>
                  <label className="text-muted small d-block">Role ID</label>
                  <span className="fw-bold font-monospace fs-6">#{selectedRole.roleId}</span>
                </Col>
                <Col sm={6}>
                  <label className="text-muted small d-block">Role Name</label>
                  <span className="fw-bold fs-6 text-primary">{selectedRole.roleName || '—'}</span>
                </Col>
                <Col xs={12}>
                  <label className="text-muted small d-block">Description</label>
                  <p className="p-3 bg-light rounded text-dark mb-0 small">
                    {selectedRole.roleDescription || 'No description specified for this role.'}
                  </p>
                </Col>
                <Col sm={6}>
                  <label className="text-muted small d-block">Role Classification</label>
                  <Badge bg={selectedRole.isSystemRole ? 'info' : 'light'} text={selectedRole.isSystemRole ? 'white' : 'dark'} className="border px-2.5 py-1.5">
                    {selectedRole.isSystemRole ? '🔒 System Core Role (Protected)' : 'Custom User Defined Role'}
                  </Badge>
                </Col>
                <Col sm={6}>
                  <label className="text-muted small d-block">Deletion Policy</label>
                  <span className="small text-muted">
                    {selectedRole.isSystemRole
                      ? 'System roles are required by the core CRM and cannot be deleted.'
                      : 'This role can be deleted if no longer in use.'}
                  </span>
                </Col>
              </Row>
            </div>
          ) : (
            <div className="text-center py-4 text-muted">No role details found.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowRoleDetails(false)}>
            Close
          </Button>
          {selectedRole && (
            <Button
              variant="primary"
              onClick={() => {
                setShowRoleDetails(false);
                openRoleEditor(selectedRole);
              }}
            >
              <Pencil size={14} className="me-1.5" />
              Edit Role
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: Role Add / Edit Modal (POST /api/Role, PUT /api/Role) */}
      {/* ========================================================= */}
      <Modal show={showRoleEditor} onHide={() => !saving && setShowRoleEditor(false)} centered>
        <Form onSubmit={saveRole}>
          <Modal.Header closeButton>
            <div className="d-flex align-items-center gap-2">
              <Shield size={18} className="text-primary" />
              <Modal.Title className="mb-0">
                {roleForm.roleId ? `Edit Role #${roleForm.roleId}` : 'Add New Role'}
              </Modal.Title>
            </div>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
              <span className="small text-muted font-monospace">
                {roleForm.roleId ? 'Endpoint: PUT /api/Role' : 'Endpoint: POST /api/Role'}
              </span>
              {roleForm.roleId > 0 && <span className="badge bg-secondary font-monospace">ID: {roleForm.roleId}</span>}
            </div>

            {loadingRoleForEdit ? (
              <div className="text-center py-3">
                <Spinner size="sm" className="me-2" />
                Loading latest role data...
              </div>
            ) : (
              <Row className="g-3">
                <Col xs={12}>
                  <Form.Label>
                    Role Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    placeholder="e.g. Administrator, Sales Manager, Support Agent"
                    value={roleForm.roleName}
                    onChange={(event) => setRoleForm((current) => ({ ...current, roleName: event.target.value }))}
                  />
                </Col>
                <Col xs={12}>
                  <Form.Label>Role Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Provide details about access scope, permissions, or responsibilities"
                    value={roleForm.roleDescription || ''}
                    onChange={(event) => setRoleForm((current) => ({ ...current, roleDescription: event.target.value }))}
                  />
                </Col>
                <Col xs={6}>
                  <Form.Check
                    id="role-is-active"
                    label="Active Status"
                    checked={roleForm.isActive}
                    onChange={(event) => setRoleForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                </Col>
                <Col xs={6}>
                  <Form.Check
                    id="role-is-system"
                    label="System Role"
                    checked={roleForm.isSystemRole}
                    onChange={(event) => setRoleForm((current) => ({ ...current, isSystemRole: event.target.checked }))}
                  />
                </Col>
              </Row>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowRoleEditor(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || loadingRoleForEdit}>
              {saving ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Saving...
                </>
              ) : roleForm.roleId ? (
                'Update Role'
              ) : (
                'Create Role'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: Setting Add / Edit Modal                         */}
      {/* ========================================================= */}
      <Modal show={showSettingEditor} onHide={() => !saving && setShowSettingEditor(false)} centered>
        <Form onSubmit={saveSetting}>
          <Modal.Header closeButton>
            <Modal.Title>{settingForm.settingId ? 'Edit Setting' : 'Add Setting'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label>Setting name <span className="text-danger">*</span></Form.Label>
                <Form.Control required value={settingForm.settingName} onChange={(event) => setSettingForm((current) => ({ ...current, settingName: event.target.value }))} />
              </Col>
              <Col xs={12}>
                <Form.Label>Setting key <span className="text-danger">*</span></Form.Label>
                <Form.Control required value={settingForm.settingKey} onChange={(event) => setSettingForm((current) => ({ ...current, settingKey: event.target.value }))} />
              </Col>
              <Col xs={12}>
                <Form.Check id="setting-is-active" label="Active" checked={settingForm.isActive} onChange={(event) => setSettingForm((current) => ({ ...current, isActive: event.target.checked }))} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowSettingEditor(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Setting'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: Setting Value Add / Edit Modal                   */}
      {/* ========================================================= */}
      <Modal show={showValueEditor} onHide={() => !saving && setShowValueEditor(false)} centered>
        <Form onSubmit={saveValue}>
          <Modal.Header closeButton>
            <Modal.Title>{valueForm.settingValueId ? 'Edit Setting Value' : 'Add Setting Value'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label>Setting <span className="text-danger">*</span></Form.Label>
                <Form.Select required value={valueForm.settingId} onChange={(event) => setValueForm((current) => ({ ...current, settingId: event.target.value }))}>
                  <option value="">Select setting</option>
                  {settings.map((setting) => (
                    <option key={setting.settingId} value={setting.settingId}>
                      {setting.settingName} ({setting.settingKey})
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Label>Value <span className="text-danger">*</span></Form.Label>
                <Form.Control required value={valueForm.settingValueText} onChange={(event) => setValueForm((current) => ({ ...current, settingValueText: event.target.value }))} />
              </Col>
              <Col xs={12}>
                <Form.Check id="value-is-active" label="Active" checked={valueForm.isActive} onChange={(event) => setValueForm((current) => ({ ...current, isActive: event.target.checked }))} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowValueEditor(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Value'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
        </>
      )}
    </div>
  );
}
