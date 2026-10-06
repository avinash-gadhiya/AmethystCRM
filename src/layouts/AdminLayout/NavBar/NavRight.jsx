import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// third party - Lucide icons
import { Bell, User, LogOut, CheckCircle2, ChevronDown, Search } from 'lucide-react';

// project imports
import authService from 'services/authService';
import activityNotificationService, { ACTIVITY_NOTIFICATIONS_CHANGED_EVENT } from 'services/activityNotificationService';
import attendanceService from 'services/attendanceService';

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

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Global Ctrl+K / Cmd+K search focus shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    if (query.includes('ticket')) {
      navigate('/Tickets');
    } else if (query.includes('customer')) {
      navigate('/Customers');
    } else if (query.includes('profile')) {
      navigate('/MyProfile');
    } else if (query.includes('sale') || query.includes('report') || query.includes('perform')) {
      navigate('/Performance/Dashboard');
    } else {
      navigate(`/Performance/Dashboard?search=${encodeURIComponent(query)}`);
    }
  };

  const canViewNotifications = activityNotificationService.isAllowedRole(currentUser);
  const [notifications, setNotifications] = useState(() => activityNotificationService.getActivities());
  const [clock, setClock] = useState(Date.now());
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellShaking, setBellShaking] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));

  useEffect(() => {
    if (!canViewNotifications) return undefined;

    const refreshNotifications = () => setNotifications(activityNotificationService.getActivities());
    const handleStorage = (event) => {
      if (event.key === activityNotificationService.storageKey) refreshNotifications();
    };
    const clockTimer = window.setInterval(() => setClock(Date.now()), 60_000);

    window.addEventListener(ACTIVITY_NOTIFICATIONS_CHANGED_EVENT, refreshNotifications);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(clockTimer);
      window.removeEventListener(ACTIVITY_NOTIFICATIONS_CHANGED_EVENT, refreshNotifications);
      window.removeEventListener('storage', handleStorage);
    };
  }, [canViewNotifications]);

  useEffect(() => {
    if (!canViewNotifications) return undefined;

    const controller = new AbortController();
    let requestInProgress = false;

    const pollAttendance = async () => {
      if (requestInProgress || controller.signal.aborted) return;
      requestInProgress = true;

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;

      try {
        const response = await attendanceService.getRegister(
          {
            FromDate: `${date}T00:00:00`,
            ToDate: `${date}T23:59:59`,
            IncludeInactiveUsers: false,
            PageNumber: 1,
            PageSize: 1000,
            IsDescending: false
          },
          controller.signal
        );
        activityNotificationService.syncAttendanceRegister(response);
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('Unable to refresh attendance notifications:', error);
      } finally {
        requestInProgress = false;
      }
    };

    pollAttendance();
    const pollTimer = window.setInterval(pollAttendance, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(pollTimer);
    };
  }, [canViewNotifications]);

  const unreadCount = canViewNotifications ? activityNotificationService.getUnreadCount(currentUser, notifications) : 0;
  const previousUnreadCountRef = useRef(unreadCount);

  useEffect(() => {
    const previousUnreadCount = previousUnreadCountRef.current;
    previousUnreadCountRef.current = unreadCount;

    if (unreadCount <= previousUnreadCount || notifications[0]?.type !== 'login') return undefined;

    setBellShaking(true);
    const shakeTimer = window.setTimeout(() => setBellShaking(false), 900);
    return () => window.clearTimeout(shakeTimer);
  }, [notifications, unreadCount]);

  const markAllAsRead = () => {
    activityNotificationService.markAllAsRead(currentUser);
    setNotifications(activityNotificationService.getActivities());
  };

  const toggleNotifications = () => {
    const openingNotifications = !notifOpen;
    setNotifOpen(openingNotifications);
    setProfileOpen(false);

    if (openingNotifications && unreadCount > 0) markAllAsRead();
  };

  const formatActivityTime = (timestamp) => {
    const elapsed = Math.max(0, clock - new Date(timestamp).getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
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
      {/* Global Header Search Bar (Blue Box) */}
      <form
        onSubmit={handleSearchSubmit}
        className="relative hidden sm:flex items-center bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl px-3 py-1.5 transition-all w-48 md:w-60 lg:w-72 shadow-2xs mr-1"
      >
        <Search size={14} className="text-slate-400 mr-2 flex-shrink-0" />
        <input
          ref={searchInputRef}
          type="search"
          className="w-full bg-transparent border-0 outline-none text-xs text-slate-800 placeholder-slate-400 p-0"
          placeholder="Search records, tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <kbd className="hidden md:inline-flex items-center text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs ml-1.5 select-none flex-shrink-0">
          Ctrl K
        </kbd>
      </form>

      {/* Login/logout activity is restricted to Admin and Developer roles. */}
      {canViewNotifications && (
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className={`neu-icon-btn relative ${bellShaking ? 'notification-bell-shake' : ''}`}
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && <span className="neu-notification-dot" />}
          </button>

          {notifOpen && (
            <div className="dropdown-menu p-0 overflow-hidden" style={{ width: 310, right: 0, zIndex: 1050 }}>
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
                {notifications.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">No login activity yet</div>}
                {notifications.map((notification) => {
                  const isRead = activityNotificationService.isActivityRead(notification, currentUser);
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg mb-1 text-xs cursor-pointer transition-colors ${
                        isRead
                          ? 'text-slate-400 hover:bg-slate-50'
                          : 'bg-indigo-50/50 hover:bg-indigo-50 text-slate-700 font-medium border border-indigo-100/60'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {notification.displayName} {notification.type === 'login' ? 'logged in' : 'logged out'}
                        </span>
                        {notification.role && <span className="block text-[10px] text-slate-400 mt-0.5">{notification.role}</span>}
                      </span>
                      <span className="text-slate-400 ml-2 flex-shrink-0">{formatActivityTime(notification.timestamp)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-slate-200 text-center bg-slate-50">
                <Link
                  to="/Attendance"
                  className="text-xs text-indigo-600 font-semibold hover:text-indigo-700"
                  onClick={() => setNotifOpen(false)}
                >
                  View attendance activity
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Profile Dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:bg-slate-50/80 active:bg-slate-100 transition-all cursor-pointer"
          onClick={() => {
            setProfileOpen((o) => !o);
            setNotifOpen(false);
          }}
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
