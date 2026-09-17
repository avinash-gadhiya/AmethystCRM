import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import { Database, ListTree, Pencil, Plus, RefreshCw, Search, ShieldCheck, Tags, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import settingService from 'services/settingService';
import roleService from 'services/roleService';

const PAGE_SIZES = [10, 25, 50];
const SECTIONS = [
  { id: 'settings', label: 'Settings', icon: Database, endpoint: '/Setting' },
  { id: 'values', label: 'Setting Values', icon: Tags, endpoint: '/SettingValue' },
  { id: 'roles', label: 'Roles', icon: ShieldCheck, endpoint: '/Role' },
  { id: 'dropdown', label: 'Dropdown Lookup', icon: ListTree, endpoint: '/SettingValue/SettingValueDropDown' }
];

const EMPTY_SETTING = { settingId: 0, settingName: '', settingKey: '', isActive: true, settingValueDTOs: [] };
const EMPTY_VALUE = { settingValueId: 0, settingId: '', settingValueText: '', isActive: true };
const EMPTY_ROLE = { roleId: 0, roleName: '', roleDescription: '', isSystemRole: false, isActive: true };

const sectionFromPath = (pathname) => {
  const lower = (pathname || '').toLowerCase();
  if (lower.includes('role')) return 'roles';
  if (lower.includes('settingvalue') || lower.includes('values')) return 'values';
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
          {PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}
        </Form.Select>
        <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="small text-nowrap">{page} / {pages}</span>
        <Button size="sm" variant="outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
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

  // Editors
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [settingForm, setSettingForm] = useState(EMPTY_SETTING);
  const [showValueEditor, setShowValueEditor] = useState(false);
  const [valueForm, setValueForm] = useState(EMPTY_VALUE);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE);

  const [saving, setSaving] = useState(false);
  const [lookupKey, setLookupKey] = useState('');
  const [lookupRows, setLookupRows] = useState([]);

  const section = SECTIONS.find((item) => item.id === activeSection) || SECTIONS[0];

  useEffect(() => {
    setActiveSection(sectionFromPath(location.pathname));
  }, [location.pathname]);

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

  const loadRows = useCallback(
    async (signal) => {
      if (activeSection === 'dropdown') {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        if (activeSection === 'roles') {
          const response = await roleService.getRoles(
            {
              Text: searchText,
              PageNumber: page,
              PageSize: pageSize,
              SortProperty: 'roleId',
              IsDescending: false
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
    [activeSection, page, pageSize, searchText, settingFilter]
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
    setError('');
    setSuccess('');
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
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

  // Role CRUD
  const openRoleEditor = (role = null) => {
    setRoleForm(role ? { ...EMPTY_ROLE, ...role } : { ...EMPTY_ROLE });
    setShowRoleEditor(true);
  };

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
    try {
      if (payload.roleId) await roleService.updateRole(payload);
      else await roleService.createRole(payload);
      setSuccess(`Role ${payload.roleId ? 'updated' : 'created'} successfully.`);
      setShowRoleEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role “${role.roleName}”?`)) return;
    try {
      await roleService.deleteRole(role.roleId);
      setSuccess('Role deleted successfully.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete role.');
    }
  };

  // Dropdown Lookup
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

  const openValueEditor = (value = null, settingId = '') => {
    setValueForm(value ? { ...EMPTY_VALUE, ...value } : { ...EMPTY_VALUE, settingId });
    setShowValueEditor(true);
  };

  return (
    <div>
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
          <div>
            <h5 className="mb-1 fw-semibold">Settings & Roles Management</h5>
            <span className="small text-muted">Manage system settings, setting values, user roles, and dropdown lookups</span>
          </div>
          <Badge bg="light" text="dark" className="border px-3 py-2">{section.endpoint}</Badge>
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <Button key={id} size="sm" variant={activeSection === id ? 'primary' : 'outline-primary'} onClick={() => switchSection(id)}>
                <Icon size={15} className="me-2" />{label}
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {activeSection === 'dropdown' ? (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-transparent py-3"><h6 className="mb-0">Setting Value Dropdown Lookup</h6></Card.Header>
          <Card.Body>
            <Form onSubmit={runLookup}>
              <Row className="g-3 align-items-end">
                <Col md={8}><Form.Label>Setting key</Form.Label><Form.Control required placeholder="Example: payment_types" value={lookupKey} onChange={(event) => setLookupKey(event.target.value)} /></Col>
                <Col md={4}><Button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Load Values'}</Button></Col>
              </Row>
            </Form>
          </Card.Body>
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light"><tr><th className="px-3 py-3">ID</th><th>Value</th><th>Setting</th><th>Status</th></tr></thead>
              <tbody>{lookupRows.length ? lookupRows.map((value, index) => <tr key={value.settingValueId || value.id || index}><td className="px-3">{value.settingValueId || value.id || '-'}</td><td>{value.settingValueText || value.name || value.text || '-'}</td><td>{value.settingName || lookupKey}</td><td><Badge bg={value.isActive !== false ? 'success' : 'secondary'}>{value.isActive !== false ? 'Active' : 'Inactive'}</Badge></td></tr>) : <tr><td colSpan="4" className="text-center text-muted py-5">Enter a setting key to load dropdown values.</td></tr>}</tbody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-transparent py-3">
            <Row className="g-2 align-items-center">
              <Col md={5} lg={4}>
                <Form onSubmit={applySearch}>
                  <InputGroup>
                    <InputGroup.Text><Search size={16} /></InputGroup.Text>
                    <Form.Control
                      placeholder={`Search ${section.label.toLowerCase()}...`}
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                    />
                    <Button type="submit" variant="outline-secondary">Search</Button>
                  </InputGroup>
                </Form>
              </Col>
              {activeSection === 'values' && (
                <Col md={4} lg={3}>
                  <Form.Select value={settingFilter} onChange={(event) => { setSettingFilter(event.target.value); setPage(1); }}>
                    <option value="">All settings</option>
                    {settings.map((setting) => <option key={setting.settingId} value={setting.settingId}>{setting.settingName}</option>)}
                  </Form.Select>
                </Col>
              )}
              <Col className="d-flex justify-content-end gap-2">
                <Button variant="outline-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} title="Refresh">
                  <RefreshCw size={16} />
                </Button>
                <Button onClick={() => {
                  if (activeSection === 'settings') {
                    setSettingForm({ ...EMPTY_SETTING });
                    setShowSettingEditor(true);
                  } else if (activeSection === 'roles') {
                    openRoleEditor();
                  } else {
                    openValueEditor(null, settingFilter);
                  }
                }}>
                  <Plus size={16} className="me-2" />
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
                        <th>Actions</th>
                      </>
                    )}
                    {activeSection === 'roles' && (
                      <>
                        <th className="px-3 py-3">Role ID</th>
                        <th>Role Name</th>
                        <th>Description</th>
                        <th>Role Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </>
                    )}
                    {activeSection === 'values' && (
                      <>
                        <th className="px-3 py-3">Value</th>
                        <th>Setting</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-5"><Spinner size="sm" className="me-2" />Loading {section.label.toLowerCase()}...</td></tr>
                  ) : !rows.length ? (
                    <tr><td colSpan="6" className="text-center text-muted py-5">No records found.</td></tr>
                  ) : activeSection === 'settings' ? (
                    rows.map((setting) => (
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
                          <Button size="sm" variant="link" onClick={() => { switchSection('values'); setSettingFilter(String(setting.settingId)); }}>View</Button>
                        </td>
                        <td>
                          <Badge bg={setting.isActive ? 'success' : 'secondary'}>
                            {setting.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap">
                          <Button size="sm" variant="outline-primary" className="me-2" onClick={() => { setSettingForm({ ...EMPTY_SETTING, ...setting }); setShowSettingEditor(true); }}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => deleteSetting(setting)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : activeSection === 'roles' ? (
                    rows.map((role) => (
                      <tr key={role.roleId}>
                        <td className="px-3">
                          <span className="fw-semibold text-muted">#{role.roleId}</span>
                        </td>
                        <td>
                          <div className="fw-semibold text-primary">{role.roleName || '-'}</div>
                        </td>
                        <td>
                          <span className="text-muted small">{role.roleDescription || '—'}</span>
                        </td>
                        <td>
                          <Badge bg={role.isSystemRole ? 'info' : 'light'} text={role.isSystemRole ? 'white' : 'dark'} className="border">
                            {role.isSystemRole ? 'System' : 'Custom'}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={role.isActive !== false ? 'success' : 'secondary'}>
                            {role.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() => openRoleEditor(role)}
                            title="Edit Role"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => deleteRole(role)}
                            title="Delete Role"
                            disabled={Boolean(role.isSystemRole)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    rows.map((value) => (
                      <tr key={value.settingValueId}>
                        <td className="px-3">
                          <div className="fw-semibold">{value.settingValueText || '-'}</div>
                          <small className="text-muted">ID {value.settingValueId}</small>
                        </td>
                        <td>{value.settingName || settings.find((setting) => Number(setting.settingId) === Number(value.settingId))?.settingName || value.settingId || '-'}</td>
                        <td>
                          <Badge bg={value.isActive ? 'success' : 'secondary'}>
                            {value.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-nowrap">
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
          <Pagination page={page} pageSize={pageSize} total={totalCount} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </Card>
      )}

      {/* Setting Add/Edit Modal */}
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

      {/* Role Add/Edit Modal */}
      <Modal show={showRoleEditor} onHide={() => !saving && setShowRoleEditor(false)} centered>
        <Form onSubmit={saveRole}>
          <Modal.Header closeButton>
            <Modal.Title>{roleForm.roleId ? 'Edit Role' : 'Add Role'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label>Role Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  required
                  placeholder="e.g. Administrator, Sales Manager, Support Agent"
                  value={roleForm.roleName}
                  onChange={(event) => setRoleForm((current) => ({ ...current, roleName: event.target.value }))}
                />
              </Col>
              <Col xs={12}>
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Role description, access scope or duties"
                  value={roleForm.roleDescription || ''}
                  onChange={(event) => setRoleForm((current) => ({ ...current, roleDescription: event.target.value }))}
                />
              </Col>
              <Col xs={6}>
                <Form.Check
                  id="role-is-active"
                  label="Active"
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
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowRoleEditor(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Role'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Setting Value Add/Edit Modal */}
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
                  {settings.map((setting) => <option key={setting.settingId} value={setting.settingId}>{setting.settingName} ({setting.settingKey})</option>)}
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
    </div>
  );
}
