import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// third party - Lucide icons
import { Bell, User, LogOut, CheckCircle2, ChevronDown } from 'lucide-react';

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
            style={{ width: 310, right: 0, zIndex: 1050 }}
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
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:bg-slate-50/80 active:bg-slate-100 transition-all cursor-pointer"
          onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
          aria-label="User profile"
        >
          {/* Avatar with purple gradient */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs">
            {initials}
          </div>
          <span className="hidden md:flex flex-col items-start text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">{displayName}</span>
            <span className="text-[11px] text-slate-500 leading-tight">{roleTitle}</span>
          </span>
          <ChevronDown size={14} className="hidden md:block text-slate-400 ml-0.5" />
        </button>

        {profileOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ zIndex: 1050 }}
          >
            {/* Profile Header */}
            <div className="px-3.5 py-3 border-b border-slate-100 mb-1 rounded-xl bg-gradient-to-r from-purple-50/50 via-indigo-50/30 to-slate-50/60">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-bold text-slate-800 truncate">{displayName}</span>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block truncate">{roleTitle}</span>
            </div>

            {/* Menu Items: Only Profile and Logout (Settings removed) */}
            <div className="py-1 space-y-0.5">
              <Link
                to="/MyProfile"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-purple-700 hover:bg-purple-50/70 transition-all cursor-pointer no-underline group"
                onClick={() => setProfileOpen(false)}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-purple-100 text-slate-500 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                  <User size={14} />
                </div>
                <span>Profile</span>
              </Link>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-all cursor-pointer border-0 bg-transparent text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-50 group-hover:bg-rose-100 text-rose-500 group-hover:text-rose-600 flex items-center justify-center transition-colors">
                  <LogOut size={14} />
                </div>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
