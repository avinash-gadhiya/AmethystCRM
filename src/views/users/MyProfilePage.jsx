import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  AtSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  X,
  Key,
  LayoutGrid,
  Eye,
  EyeOff,
  Lock,
  Circle
} from 'lucide-react';
import authService from 'services/authService';
import userService from 'services/userService';

export default function MyProfilePage() {
  const [currentUser, setCurrentUser] = useState(() => authService.getUser() || {});
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'personal' | 'security'

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: currentUser.firstName || '',
    lastName: currentUser.lastName || '',
    email: currentUser.email || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Fetch fresh user details on mount if userId is available
  useEffect(() => {
    const userId = Number(currentUser.userId || localStorage.getItem('userId')) || 0;
    if (userId > 0) {
      userService.getUserById(userId).then((freshUser) => {
        if (freshUser) {
          setCurrentUser((prev) => ({
            ...prev,
            ...freshUser,
            firstName: freshUser.firstName ?? prev.firstName,
            lastName: freshUser.lastName ?? prev.lastName,
            email: freshUser.email ?? prev.email,
            userName: freshUser.username ?? freshUser.userName ?? prev.userName,
            role: freshUser.roleName ?? freshUser.role ?? prev.role
          }));
        }
      }).catch(() => {
        // Non-blocking fallback to cached user
      });
    }
  }, []);

  const openEditModal = () => {
    setProfileForm({
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      email: currentUser.email || ''
    });
    setProfileError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (!profileSaving) {
      setIsEditModalOpen(false);
      setProfileError('');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');

    if (!profileForm.email.trim()) {
      setProfileError('Email address is required.');
      return;
    }

    setProfileSaving(true);
    try {
      await userService.changeProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim()
      });

      const updatedUser = {
        ...currentUser,
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim(),
        displayName: `${profileForm.firstName.trim()} ${profileForm.lastName.trim()}`.trim() || currentUser.userName
      };

      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setProfileSuccess('Profile updated successfully.');
      setIsEditModalOpen(false);
      setTimeout(() => setProfileSuccess(''), 5000);
    } catch (err) {
      setProfileError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const isLengthValid = passwordForm.newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(passwordForm.newPassword);
  const hasNumber = /\d/.test(passwordForm.newPassword);
  const passwordsMatch = Boolean(
    passwordForm.newPassword &&
    passwordForm.confirmPassword &&
    passwordForm.newPassword === passwordForm.confirmPassword
  );

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.oldPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!isLengthValid) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (!hasLetter) {
      setPasswordError('New password must contain at least one letter.');
      return;
    }
    if (!hasNumber) {
      setPasswordError('New password must contain at least one number.');
      return;
    }
    if (!passwordsMatch) {
      setPasswordError('Both new password fields must match.');
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
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err) {
      setPasswordError(err?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const firstName = currentUser.firstName || 'CRM';
  const lastName = currentUser.lastName || 'Developer';
  const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.displayName || currentUser.userName || 'CRM Developer';
  const userName = currentUser.userName || currentUser.username || 'developer';
  const email = currentUser.email || 'developer@crm.com';
  const role = currentUser.role || currentUser.roleName || 'Developer';

  const initials =
    (currentUser.firstName?.[0] || currentUser.userName?.[0] || 'C') +
    (currentUser.lastName?.[0] || 'D');

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {profileSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{profileSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setProfileSuccess('')}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* TOP HEADER CARD (Matches Screenshot 1) */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-purple-50/50 border border-slate-200/80 p-6 sm:p-8 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar Initials with Vibrant Gradient */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-indigo-500/20 flex-shrink-0 tracking-wider">
              {initials.toUpperCase()}
            </div>

            {/* Profile Info */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {fullName}
              </h1>

              {/* Role Pill Badge */}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-white/90 text-indigo-700 border border-indigo-200/80 shadow-xs">
                  <CheckCircle2 size={13} className="text-indigo-600" />
                  <span>{role}</span>
                </span>
              </div>

              {/* Contact Quick Details */}
              <div className="mt-4 flex flex-wrap items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/80 border border-slate-200 text-slate-400 flex items-center justify-center">
                    <AtSign size={11} />
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">USERNAME</span>
                  <span className="font-semibold text-slate-800">{userName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/80 border border-slate-200 text-slate-400 flex items-center justify-center">
                    <Mail size={11} />
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">EMAIL</span>
                  <span className="font-semibold text-slate-800">{email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Right Edit Profile Button */}
          <div className="self-start md:self-center flex-shrink-0">
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all hover:shadow cursor-pointer"
            >
              <Pencil size={13} />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* PILL TAB NAVIGATION (Matches Screenshot 1) */}
      <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutGrid size={14} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'personal'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User size={14} />
          <span>Personal Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Security</span>
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Section Heading */}
          <div>
            <h2 className="text-sm font-bold text-slate-900">Account overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              A snapshot of the account you are currently signed in with.
            </p>
          </div>

          {/* 3 Summary Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Account Role */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ACCOUNT ROLE
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
                  {role}
                </span>
              </div>
            </div>

            {/* Card 2: Username */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                <AtSign size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  USERNAME
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
                  {userName}
                </span>
              </div>
            </div>

            {/* Card 3: Email */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Mail size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  EMAIL
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
                  {email}
                </span>
              </div>
            </div>
          </div>

          {/* Personal Information Card (Matches Screenshot 1) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Personal information</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your name and email address as they appear across the CRM.
                </p>
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Pencil size={12} />
                <span>Edit Profile</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 pt-6">
              {/* First Name */}
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  <span>FIRST NAME</span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{firstName}</div>
              </div>

              {/* Last Name */}
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  <span>LAST NAME</span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{lastName}</div>
              </div>

              {/* Email Address */}
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  <span>EMAIL ADDRESS</span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{email}</div>
              </div>

              {/* Spacer */}
              <div className="hidden md:block" />

              {/* Username */}
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <AtSign size={13} className="text-slate-400" />
                  <span>USERNAME</span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <span>{userName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                    READ ONLY
                  </span>
                </div>
              </div>

              {/* Role */}
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-slate-400" />
                  <span>ROLE</span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <span>{role}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                    READ ONLY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONAL INFORMATION TAB */}
      {activeTab === 'personal' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Personal information</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your profile details configured in AmethystCRM.
              </p>
            </div>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Pencil size={12} />
              <span>Edit Profile</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 pt-6">
            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <User size={13} />
                <span>FIRST NAME</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{firstName}</div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <User size={13} />
                <span>LAST NAME</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{lastName}</div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Mail size={13} />
                <span>EMAIL ADDRESS</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{email}</div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={13} />
                <span>ROLE</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{role}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  READ ONLY
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <AtSign size={13} />
                <span>USERNAME</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{userName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  READ ONLY
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                <span>ACCOUNT STATUS</span>
              </div>
              <div className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY / CHANGE PASSWORD TAB (Matches Screenshot) */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Section Header */}
          <div>
            <h2 className="text-base font-bold text-slate-900">Security</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage the credentials you use to sign in to the CRM.
            </p>
          </div>

          {/* 3 Status / Info Cards (Matches Screenshot) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Password */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  PASSWORD
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  Set
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 leading-snug">
                  Last changed date is not tracked for this account.
                </span>
              </div>
            </div>

            {/* Card 2: Account */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ACCOUNT
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  Status unavailable
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 leading-snug">
                  Signed in as {role}
                </span>
              </div>
            </div>

            {/* Card 3: Authentication */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  AUTHENTICATION
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  Authenticated
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 leading-snug">
                  This session is signed in with a valid access token.
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
            {/* Header with Key Icon */}
            <div className="flex items-start gap-3.5 pb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Key size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose a strong password you are not using anywhere else. You will stay signed in on this device after changing it.
                </p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Side: Requirements Box (Matches Screenshot) */}
                <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/70 rounded-2xl p-5">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3.5 block">
                    REQUIREMENTS
                  </span>
                  <ul className="space-y-3 text-xs">
                    <li className="flex items-center gap-2.5">
                      {isLengthValid ? (
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={15} className="text-slate-300 flex-shrink-0" />
                      )}
                      <span className={isLengthValid ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                        At least 8 characters
                      </span>
                    </li>

                    <li className="flex items-center gap-2.5">
                      {hasLetter ? (
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={15} className="text-slate-300 flex-shrink-0" />
                      )}
                      <span className={hasLetter ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                        Contains a letter
                      </span>
                    </li>

                    <li className="flex items-center gap-2.5">
                      {hasNumber ? (
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={15} className="text-slate-300 flex-shrink-0" />
                      )}
                      <span className={hasNumber ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                        Contains a number
                      </span>
                    </li>

                    <li className="flex items-center gap-2.5">
                      {passwordsMatch ? (
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={15} className="text-slate-300 flex-shrink-0" />
                      )}
                      <span className={passwordsMatch ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                        Both new password fields match
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Right Side: Inputs (Matches Screenshot) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Current password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        required
                        value={passwordForm.oldPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                        placeholder="Enter current password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      New password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Enter new password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Confirm new password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Re-enter new password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Right Submit Button */}
              <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all hover:shadow cursor-pointer disabled:opacity-50"
                >
                  {passwordSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Change Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL (Matches Screenshot 2 Exactly) */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={closeEditModal}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 sm:p-7 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Edit profile</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Update your name and email address. Changes apply to your account immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={profileSaving}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Error inside modal */}
            {profileError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    placeholder="First name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    placeholder="Last name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={profileSaving}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
