import { useState } from 'react';
import { User, Key, ShieldCheck, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import authService from 'services/authService';
import userService from 'services/userService';
import { Button, Alert } from 'components/ui/Bootstrap';

export default function MyProfilePage() {
  const currentUser = authService.getUser() || {};

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    firstName: currentUser.firstName || '',
    lastName: currentUser.lastName || '',
    email: currentUser.email || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileForm.email.trim()) {
      setProfileError('Email is required.');
      return;
    }

    setProfileSaving(true);
    try {
      await userService.changeProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email
      });

      // Update local storage user profile data
      const updatedUser = {
        ...currentUser,
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
        displayName: `${profileForm.firstName} ${profileForm.lastName}`.trim() || currentUser.userName
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.oldPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!passwordForm.newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await userService.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials =
    (currentUser.firstName?.[0] || currentUser.userName?.[0] || 'U') +
    (currentUser.lastName?.[0] || '');

  return (
    <div className="space-y-5">
      {/* Top Banner Card */}
      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg flex-shrink-0">
            {initials.toUpperCase()}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-xl font-bold text-gray-800 mb-1">
              {currentUser.displayName || currentUser.userName || 'CRM User'}
            </h4>
            <p className="text-sm text-gray-500 mb-2">@{currentUser.userName || 'user'}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="badge bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg">
                {currentUser.role || 'Developer'}
              </span>
              <span className="badge bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
                <ShieldCheck size={12} /> Active Session
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile Details Form */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <User size={18} className="text-indigo-600" />
            <h5 className="text-base font-semibold text-gray-800 mb-0">Personal Information</h5>
          </div>
          <div className="card-body">
            {profileSuccess && (
              <Alert variant="success" dismissible onClose={() => setProfileSuccess('')} className="mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{profileSuccess}</span>
                </div>
              </Alert>
            )}

            {profileError && (
              <Alert variant="danger" dismissible onClose={() => setProfileError('')} className="mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{profileError}</span>
                </div>
              </Alert>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={profileSaving} className="w-full sm:w-auto">
                  {profileSaving && <Loader2 size={14} className="animate-spin inline mr-1.5" />}
                  <span>Save Profile</span>
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Key size={18} className="text-indigo-600" />
            <h5 className="text-base font-semibold text-gray-800 mb-0">Change Password</h5>
          </div>
          <div className="card-body">
            {passwordSuccess && (
              <Alert variant="success" dismissible onClose={() => setPasswordSuccess('')} className="mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccess}</span>
                </div>
              </Alert>
            )}

            {passwordError && (
              <Alert variant="danger" dismissible onClose={() => setPasswordError('')} className="mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              </Alert>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={passwordSaving} className="w-full sm:w-auto">
                  {passwordSaving && <Loader2 size={14} className="animate-spin inline mr-1.5" />}
                  <span>Update Password</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
