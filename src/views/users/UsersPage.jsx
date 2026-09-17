import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Key,
  ShieldCheck,
  PhoneCall,
  Loader2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  MapPin
} from 'lucide-react';

import userService from 'services/userService';
import authService from 'services/authService';
import { Modal, Button, Form, Badge, Table, Spinner, Alert } from 'components/ui/Bootstrap';

const PAGE_SIZES = [10, 25, 50];

const EMPTY_USER = {
  userId: 0,
  username: '',
  email: '',
  passwordHash: '',
  firstName: '',
  lastName: '',
  roleId: 2,
  roleName: 'Sales Person',
  locationId: 1,
  locationName: 'Headquarters',
  salesTarget: 50000,
  rplTarget: 1500,
  isActive: true,
  isLeadOn: true
};

const ROLES = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'Sales Person' },
  { id: 3, name: 'Sales Manager' },
  { id: 4, name: 'Service Manager' },
  { id: 5, name: 'Developer' }
];

export default function UsersPage() {
  const currentUser = authService.getUser();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState(EMPTY_USER);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Lead ON toggle loading state per user
  const [leadOnLoading, setLeadOnLoading] = useState({});

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Load Users from API
  const loadUsers = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
        const response = await userService.getUsers(
          {
            Text: searchText.trim(),
            isActive: isActiveParam,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'userId',
            IsDescending: true
          },
          signal
        );

        setUsers(response.data);
        setTotalCount(response.totalCount);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load users.');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [searchText, statusFilter, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers, refreshKey]);

  // Client filtered by role if specified
  const displayedUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((u) => String(u.roleName || '').toLowerCase() === roleFilter.toLowerCase());
  }, [users, roleFilter]);

  // KPIs
  const kpiStats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length;
    const leadOnCount = users.filter((u) => u.isLeadOn).length;
    return {
      total: totalCount || users.length,
      active,
      inactive: (totalCount || users.length) - active,
      leadOn: leadOnCount
    };
  }, [users, totalCount]);

  // Save User (Create or Update)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setEditorError('');

    if (!editorData.username?.trim()) {
      setEditorError('Username is required.');
      return;
    }
    if (!editorData.email?.trim()) {
      setEditorError('Email is required.');
      return;
    }
    if (!isEditing && !editorData.passwordHash?.trim()) {
      setEditorError('Password is required for new users.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await userService.updateUser(editorData);
        setSuccessMessage(`User "${editorData.username}" updated successfully.`);
      } else {
        await userService.createUser(editorData);
        setSuccessMessage(`User "${editorData.username}" created successfully.`);
      }
      setShowEditor(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setEditorError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Lead ON/OFF
  const handleToggleLeadOn = async (user) => {
    const newStatus = !user.isLeadOn;
    setLeadOnLoading((prev) => ({ ...prev, [user.userId]: true }));

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.userId === user.userId ? { ...u, isLeadOn: newStatus } : u))
    );

    try {
      await userService.setLeadOn({
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isLeadOn: newStatus,
        isActive: user.isActive
      });
      setSuccessMessage(`Lead assignment ${newStatus ? 'enabled' : 'disabled'} for ${user.username}.`);
    } catch (err) {
      // Revert optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.userId === user.userId ? { ...u, isLeadOn: !newStatus } : u))
      );
      setError(`Failed to update Lead ON for ${user.username}: ${err.message}`);
    } finally {
      setLeadOnLoading((prev) => ({ ...prev, [user.userId]: false }));
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.userId);
      setSuccessMessage(`User "${deleteTarget.username}" deleted successfully.`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  // Change Password Submit
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!passwordForm.newPassword) {
      setPasswordError('New password is required.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await userService.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      setSuccessMessage('Password changed successfully.');
      setShowPasswordModal(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const getInitials = (user) => {
    const first = user?.firstName?.[0] || user?.username?.[0] || 'U';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  return (
    <div className="space-y-5">
      {/* Alert Notifications */}
      {successMessage && (
        <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card flex-row items-center gap-4 p-4 sm:p-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Users size={22} className="text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Total Users</p>
            <div className="text-2xl font-bold text-gray-800 truncate">{kpiStats.total}</div>
            <p className="text-xs text-gray-400 mb-0">System registered accounts</p>
          </div>
        </div>

        <div className="card flex-row items-center gap-4 p-4 sm:p-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <UserCheck size={22} className="text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Active Users</p>
            <div className="text-2xl font-bold text-emerald-600 truncate">{kpiStats.active}</div>
            <p className="text-xs text-gray-400 mb-0">Authorized to login</p>
          </div>
        </div>

        <div className="card flex-row items-center gap-4 p-4 sm:p-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <PhoneCall size={22} className="text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Lead Assignment ON</p>
            <div className="text-2xl font-bold text-amber-600 truncate">{kpiStats.leadOn}</div>
            <p className="text-xs text-gray-400 mb-0">Receiving live lead flow</p>
          </div>
        </div>

        <div className="card flex-row items-center gap-4 p-4 sm:p-5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <UserX size={22} className="text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Inactive Users</p>
            <div className="text-2xl font-bold text-gray-600 truncate">{kpiStats.inactive}</div>
            <p className="text-xs text-gray-400 mb-0">Suspended or locked</p>
          </div>
        </div>
      </div>

      {/* Main Users Table Card */}
      <div className="card">
        {/* Card Header */}
        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-base font-semibold text-gray-800 mb-0.5">User Management</h5>
            <p className="text-xs text-gray-400 mb-0">
              Manage accounts, roles, sales targets, and lead distribution status
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditorData(EMPTY_USER);
                setIsEditing(false);
                setEditorError('');
                setShowEditor(true);
              }}
              className="flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="form-control pl-9 text-sm"
                placeholder="Search by name, email, or username..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                <select
                  className="form-control text-xs py-1.5 px-2.5 w-auto"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500">Role:</span>
                <select
                  className="form-control text-xs py-1.5 px-2.5 w-auto"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Location / Group</th>
                <th>Targets</th>
                <th className="text-center">Lead Flow</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Loader2 size={24} className="animate-spin inline mr-2 text-indigo-500" />
                    <span>Loading users from API...</span>
                  </td>
                </tr>
              )}

              {!loading && displayedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium mb-1">No users found</p>
                    <p className="text-xs text-gray-400">
                      {searchText ? 'Try adjusting your search query.' : 'Click "Add User" to create the first user.'}
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                displayedUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-gray-50/70 transition-colors">
                    {/* User Avatar + Details */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-sm">
                          {getInitials(u)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 text-sm truncate">
                            {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                          </div>
                          <div className="text-xs text-gray-400 truncate flex items-center gap-2">
                            <span>@{u.username}</span>
                            <span>·</span>
                            <span>{u.email || 'No email'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td>
                      <span className="badge bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                        {u.roleName || 'Sales Person'}
                      </span>
                    </td>

                    {/* Location / Group */}
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                        <span>{u.locationName || 'General Office'}</span>
                      </div>
                      {Array.isArray(u.groupName) && u.groupName.length > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">{u.groupName.join(', ')}</div>
                      )}
                    </td>

                    {/* Targets */}
                    <td>
                      <div className="text-xs text-gray-700 font-medium">
                        ${Number(u.salesTarget || 0).toLocaleString()} <span className="text-gray-400 text-[10px]">Sales</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        ${Number(u.rplTarget || 0).toLocaleString()} <span className="text-gray-400 text-[10px]">RPL</span>
                      </div>
                    </td>

                    {/* Lead Flow ON/OFF Toggle */}
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleLeadOn(u)}
                        disabled={leadOnLoading[u.userId]}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                          u.isLeadOn
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                        }`}
                        title="Click to toggle lead flow"
                      >
                        {leadOnLoading[u.userId] ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full ${u.isLeadOn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}
                          />
                        )}
                        <span>{u.isLeadOn ? 'Lead ON' : 'Lead OFF'}</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="text-center">
                      <span
                        className={`badge px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="neu-icon-btn p-1.5 text-gray-500 hover:text-indigo-600"
                          title="Edit User"
                          onClick={() => {
                            setEditorData({
                              ...u,
                              passwordHash: ''
                            });
                            setIsEditing(true);
                            setEditorError('');
                            setShowEditor(true);
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="neu-icon-btn p-1.5 text-gray-500 hover:text-amber-600"
                          title="Change Password"
                          onClick={() => {
                            setPasswordTargetUser(u);
                            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                            setPasswordError('');
                            setShowPasswordModal(true);
                          }}
                        >
                          <Key size={15} />
                        </button>
                        <button
                          type="button"
                          className="neu-icon-btn p-1.5 text-gray-500 hover:text-red-600"
                          title="Delete User"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="card-footer flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Showing <strong className="text-gray-700">{displayedUsers.length}</strong> of{' '}
            <strong className="text-gray-700">{totalCount}</strong> users
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                className="form-control text-xs py-1 px-2 w-auto"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2 font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal show={showEditor} onHide={() => setShowEditor(false)} size="lg">
        <Modal.Header closeButton onHide={() => setShowEditor(false)}>
          <Modal.Title>{isEditing ? 'Edit User' : 'Create New User'}</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleSaveUser}>
          <Modal.Body>
            {editorError && (
              <Alert variant="danger" className="mb-4">
                {editorError}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  disabled={isEditing}
                  value={editorData.username}
                  onChange={(e) => setEditorData({ ...editorData, username: e.target.value })}
                  placeholder="e.g. john_doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={editorData.email}
                  onChange={(e) => setEditorData({ ...editorData, email: e.target.value })}
                  placeholder="e.g. john@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editorData.firstName || ''}
                  onChange={(e) => setEditorData({ ...editorData, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editorData.lastName || ''}
                  onChange={(e) => setEditorData({ ...editorData, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>

              {!isEditing && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    value={editorData.passwordHash}
                    onChange={(e) => setEditorData({ ...editorData, passwordHash: e.target.value })}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role</label>
                <select
                  className="form-control"
                  value={editorData.roleId}
                  onChange={(e) => {
                    const rId = Number(e.target.value);
                    const selected = ROLES.find((r) => r.id === rId);
                    setEditorData({
                      ...editorData,
                      roleId: rId,
                      roleName: selected?.name || 'Sales Person'
                    });
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editorData.locationName || ''}
                  onChange={(e) => setEditorData({ ...editorData, locationName: e.target.value })}
                  placeholder="e.g. Headquarters, Branch 1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Sales Target ($)</label>
                <input
                  type="number"
                  className="form-control"
                  value={editorData.salesTarget || 0}
                  onChange={(e) => setEditorData({ ...editorData, salesTarget: Number(e.target.value) })}
                  placeholder="50000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">RPL Target ($)</label>
                <input
                  type="number"
                  className="form-control"
                  value={editorData.rplTarget || 0}
                  onChange={(e) => setEditorData({ ...editorData, rplTarget: Number(e.target.value) })}
                  placeholder="1500"
                />
              </div>

              <div className="sm:col-span-2 pt-2 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editorData.isActive}
                    onChange={(e) => setEditorData({ ...editorData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">Account Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editorData.isLeadOn}
                    onChange={(e) => setEditorData({ ...editorData, isLeadOn: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">Lead Assignment ON</span>
                </label>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
              <span>{isEditing ? 'Save Changes' : 'Create User'}</span>
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
        <Modal.Header closeButton onHide={() => setShowPasswordModal(false)}>
          <Modal.Title>Change Password</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleChangePassword}>
          <Modal.Body>
            {passwordError && (
              <Alert variant="danger" className="mb-4">
                {passwordError}
              </Alert>
            )}

            <p className="text-xs text-gray-500 mb-4">
              Updating password for user: <strong>@{passwordTargetUser?.username}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Old Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)} disabled={passwordSaving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={passwordSaving}>
              {passwordSaving && <Loader2 size={14} className="animate-spin inline mr-1" />}
              <span>Update Password</span>
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal show={Boolean(deleteTarget)} onHide={() => setDeleteTarget(null)}>
        <Modal.Header closeButton onHide={() => setDeleteTarget(null)}>
          <Modal.Title>Delete User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-gray-700">
            Are you sure you want to delete user{' '}
            <strong className="text-red-600">@{deleteTarget?.username}</strong> ({deleteTarget?.email})?
          </p>
          <p className="text-xs text-gray-400 mt-2">
            This action cannot be undone and will revoke access to the CRM dashboard.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} disabled={deleting}>
            {deleting && <Loader2 size={14} className="animate-spin inline mr-1" />}
            <span>Delete User</span>
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
