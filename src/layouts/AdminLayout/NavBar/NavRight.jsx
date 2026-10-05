import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// third party - Lucide icons
import { Bell, User, Settings, LogOut, CheckCircle2, ChevronDown } from 'lucide-react';

// project imports
import authService from 'services/authService';

// -----------------------|| NAV RIGHT ||-----------------------//

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export default function NavRight() {
  const navigate = useNavigate();
  const currentUser = authService.getUser();

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New ticket #1042 assigned', time: '5m ago', read: false },
    { id: 2, title: 'Customer payment verified', time: '20m ago', read: false },
    { id: 3, title: 'Weekly performance report ready', time: '1h ago', read: true }
  ]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleLogout = (e) => {
    e.preventDefault();
    authService.logout();
    navigate('/login', { replace: true });
  };

  const displayName = currentUser?.displayName || currentUser?.userName || 'User';
  const roleTitle = currentUser?.role || 'Developer';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 h-full">

      {/* Notifications Dropdown */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          className="neu-icon-btn relative"
          onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false); }}
          aria-label="Notifications"
        >
          <Bell size={17} />
          {unreadCount > 0 && <span className="neu-notification-dot" />}
        </button>

        {notifOpen && (
          <div
            className="dropdown-menu p-0 overflow-hidden"
            style={{ width: 310, right: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <h6 className="text-sm font-semibold text-slate-800 mb-0">Notifications</h6>
                {unreadCount > 0 && (
                  <span className="badge bg-primary" style={{ fontSize: '0.68rem' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer p-0"
                >
                  <CheckCircle2 size={13} /> Mark read
                </button>
              )}
            </div>

            {/* List */}
            <div className="p-2 max-h-60 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg mb-1 text-xs cursor-pointer transition-colors ${
                    n.read
                      ? 'text-slate-400 hover:bg-slate-50'
                      : 'bg-indigo-50/50 hover:bg-indigo-50 text-slate-700 font-medium border border-indigo-100/60'
                  }`}
                >
                  <span>{n.title}</span>
                  <span className="text-slate-400 ml-2 flex-shrink-0">{n.time}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-200 text-center bg-slate-50">
              <Link
                to="/Performance/Dashboard"
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-700"
                onClick={() => setNotifOpen(false)}
              >
                View all activity
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
          aria-label="User profile"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <span className="hidden md:flex flex-col items-start">
            <span className="text-xs font-semibold text-slate-800 leading-tight">{displayName}</span>
            <span className="text-[11px] text-slate-500 leading-tight">{roleTitle}</span>
          </span>
          <ChevronDown size={14} className="hidden md:block text-slate-400 ml-0.5" />
        </button>

        {profileOpen && (
          <div
            className="dropdown-menu p-1 overflow-hidden"
            style={{ width: 220, right: 0 }}
          >
            {/* Profile Header */}
            <div className="px-4 py-3 border-b border-slate-200 mb-1 bg-slate-50/50">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-slate-800">{displayName}</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">Online</span>
              </div>
              <span className="text-[11px] text-slate-500">{roleTitle}</span>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                to="/MyProfile"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <User size={15} className="text-slate-400" /> My Profile
              </Link>
              <Link
                to="/settings/setting"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <Settings size={15} className="text-slate-400" /> Settings
              </Link>
              <div className="dropdown-divider" />
              <button
                type="button"
                onClick={handleLogout}
                className="dropdown-item text-red-600 font-medium w-full hover:bg-red-50 hover:text-red-700"
              >
                <LogOut size={15} className="text-red-500" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
