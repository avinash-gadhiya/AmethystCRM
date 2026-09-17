import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

// project imports
import authService from 'services/authService';
import permissionService from 'services/permissionService';

// assets
import logoDark from 'assets/images/logo-dark.svg';

// -----------------------|| SIGNIN ||-----------------------//

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('saved_username');
    if (savedUser) setUserName(savedUser);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!userName.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login(userName, password);

      if (result.success) {
        if (rememberMe) {
          localStorage.setItem('saved_username', userName.trim());
        } else {
          localStorage.removeItem('saved_username');
        }

        const navResult = await permissionService.fetchPermissions(result.data?.roleId, { force: true });
        const requestedPath = location.state?.from?.pathname;
        const redirectPath =
          (requestedPath && permissionService.hasPath(requestedPath, navResult) && requestedPath) ||
          permissionService.getFirstAvailablePath(navResult) ||
          '/Dashboards';
        navigate(redirectPath, { replace: true });
      } else {
        setErrorMessage(result.message || 'Invalid Email and/or Password');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-content">
        <div className="auth-card">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={logoDark} alt="DashboardKit" className="h-10 w-auto" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">Welcome back</h2>
            <p className="text-sm text-gray-400 text-center mb-8">
              Sign in to your CRM dashboard
            </p>

            {/* Error Alert */}
            {errorMessage && (
              <div className="alert alert-danger mb-6 flex items-center" role="alert">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="flex-1 text-sm">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="bg-transparent border-0 text-red-400 hover:text-red-600 p-0 cursor-pointer leading-none text-lg"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Username */}
              <div className="mb-4">
                <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Username / Email
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center justify-center z-10">
                    <User size={18} />
                  </span>
                  <input
                    id="username"
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '2.75rem', paddingRight: '1rem', height: '46px' }}
                    placeholder="Enter your username or email"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center justify-center z-10">
                    <Lock size={18} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem', height: '46px' }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer p-1 flex items-center justify-center z-10 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center mb-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-600">Remember me</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                style={{ height: '46px' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

