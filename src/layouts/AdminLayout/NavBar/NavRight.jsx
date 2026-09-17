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
            className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-0 overflow-hidden"
            style={{ width: 310, animation: 'dropIn 0.15s ease' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-2">
                <h6 className="text-sm font-semibold text-gray-800 mb-0">Notifications</h6>
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
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer p-0"
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
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 text-xs cursor-pointer ${
                    n.read
                      ? 'text-gray-400'
                      : 'bg-indigo-50/60 text-gray-700 font-medium'
                  }`}
                >
                  <span>{n.title}</span>
                  <span className="text-gray-400 ml-2 flex-shrink-0">{n.time}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 text-center">
              <Link
                to="/Performance/Dashboard"
                className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
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
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 bg-transparent cursor-pointer"
          onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
          aria-label="User profile"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <span className="hidden md:flex flex-col items-start">
            <span className="text-sm font-semibold text-gray-800 leading-tight">{displayName}</span>
            <span className="text-xs text-gray-400 leading-tight">{roleTitle}</span>
          </span>
          <ChevronDown size={14} className="hidden md:block text-gray-400 ml-0.5" />
        </button>

        {profileOpen && (
          <div
            className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1 overflow-hidden"
            style={{ width: 220, animation: 'dropIn 0.15s ease' }}
          >
            {/* Profile Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-semibold text-gray-800">{displayName}</span>
                <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Online</span>
              </div>
              <span className="text-xs text-gray-400">{roleTitle}</span>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                to="/MyProfile"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <User size={15} className="text-gray-400" /> My Profile
              </Link>
              <Link
                to="/settings/setting"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <Settings size={15} className="text-gray-400" /> Settings
              </Link>
              <div className="dropdown-divider" />
              <button
                type="button"
                onClick={handleLogout}
                className="dropdown-item text-red-500 w-full"
              >
                <LogOut size={15} className="text-red-400" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
