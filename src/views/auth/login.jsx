import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import LoginWelcomeOverlay from 'components/auth/LoginWelcomeOverlay';
import authService from 'services/authService';
import permissionService from 'services/permissionService';
import 'styles/bear-login.css';

function Bear() {
  return (
    <div className="bear__wrapper" aria-hidden="true">
      <svg className="bear" viewBox="0 0 241 257" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="bear__body">
          <path
            d="M213.727 108.553C213.727 136.968 213.701 173.493 201.933 202.922C196.071 217.583 187.328 230.384 174.292 239.532C161.263 248.676 143.78 254.286 120.235 254.286C96.6889 254.286 79.2065 248.676 66.1771 239.532C53.1413 230.384 44.3983 217.583 38.536 202.922C26.7685 173.493 26.7425 136.968 26.7425 108.553C26.7425 52.8665 68.7328 7.97217 120.235 7.97217C171.736 7.97217 213.727 52.8665 213.727 108.553Z"
            fill="#AF7128"
            stroke="currentColor"
            strokeWidth="4"
          />
          <circle cx="37.3983" cy="36.9758" r="34.8416" fill="#AF7128" stroke="currentColor" strokeWidth="4" />
          <circle cx="203.509" cy="36.9758" r="34.8416" fill="#AF7128" stroke="currentColor" strokeWidth="4" />
          <g className="bear__eyes">
            <g className="bear__eyes-crossed">
              <line x1="164.746" x2="183.746" y1="99.811" y2="111.811" strokeWidth="4" strokeLinecap="round" stroke="currentColor" />
              <line x1="164.746" x2="183.746" y1="111.811" y2="99.811" strokeWidth="4" strokeLinecap="round" stroke="currentColor" />
              <line x1="58.1606" x2="74.1606" y1="99.811" y2="111.811" strokeWidth="4" strokeLinecap="round" stroke="currentColor" />
              <line x1="58.1606" x2="74.1606" y1="111.811" y2="99.811" strokeWidth="4" strokeLinecap="round" stroke="currentColor" />
            </g>
            <g className="bear__eyes-normal">
              <circle cx="174.746" cy="105.811" r="8.0793" fill="currentColor" />
              <circle cx="66.1606" cy="105.811" r="8.0793" fill="currentColor" />
            </g>
          </g>
          <path
            d="M141.246 120.415C141.246 128.625 131.378 137.866 120.401 137.866C109.425 137.866 99.5567 128.625 99.5567 120.415C99.5567 112.205 109.425 108.134 120.401 108.134C131.378 108.134 141.246 112.205 141.246 120.415Z"
            fill="currentColor"
          />
          <rect x="75.7932" y="69.9394" width="88.3706" height="13.25" fill="#FF1E1E" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M187.771 28.755C205.711 43.1491 215.789 65.9033 215.789 86.2595H154.142C154.055 72.5907 142.947 61.5369 129.258 61.5369H110.699C97.0096 61.5369 85.902 72.5907 85.8151 86.2595L24.4714 86.2595C24.4714 65.9033 34.5498 43.149 52.4893 28.755C70.4288 14.361 94.76 6.27448 120.13 6.27448C145.501 6.27448 169.832 14.361 187.771 28.755Z"
            fill="currentColor"
          />
        </g>
        <g className="bear__arm">
          <rect x="2" y="120" height="54" width="220" rx="27" fill="#AF7128" strokeWidth="4" stroke="currentColor" />
          <line x1="214" y1="139" x2="192" y2="138" strokeLinecap="round" stroke="currentColor" strokeWidth="4" />
          <line x1="214" y1="157" x2="192" y2="158" strokeLinecap="round" stroke="currentColor" strokeWidth="4" />
        </g>
        <g className="bear__arms">
          <rect x="-10" y="100" width="54" height="80" ry="27" strokeWidth="4" stroke="currentColor" fill="#AF7128" />
          <rect x="0" y="110" width="34" height="40" ry="17" fill="#F2DA89" />
          <rect x="198" y="100" width="54" height="80" ry="27" strokeWidth="4" stroke="currentColor" fill="#AF7128" />
          <rect x="208" y="110" width="34" height="40" ry="17" fill="#F2DA89" />
        </g>
      </svg>
    </div>
  );
}

function IndicatorArm() {
  return (
    <svg className="indicator-arm" viewBox="-4 -4 102 62" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id="bear-arm">
          <rect x="0" y="0" width="98" height="58" rx="28" />
        </clipPath>
      </defs>
      <g className="indicator-arm__arm" clipPath="url(#bear-arm)">
        <g className="indicator-arm__hand">
          <rect x="2" y="2" width="94" height="54" rx="28" fill="#AF7128" stroke="currentColor" strokeWidth="4" />
          <line x1="8" y1="21" x2="30" y2="19" strokeLinecap="round" stroke="currentColor" strokeWidth="4" />
          <line x1="8" y1="39" x2="30" y2="41" strokeLinecap="round" stroke="currentColor" strokeWidth="4" />
        </g>
      </g>
    </svg>
  );
}

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('developer');
  const [password, setPassword] = useState('Pass@2026@Dev');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeUser, setWelcomeUser] = useState('');
  const [pendingRedirectPath, setPendingRedirectPath] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('saved_username');
    if (savedUser) setUserName(savedUser);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        localStorage.setItem('saved_username', userName.trim());

        const navResult = await permissionService.fetchPermissions(result.data?.roleId, { force: true });
        const requestedPath = location.state?.from?.pathname;
        const redirectPath =
          (requestedPath && permissionService.hasPath(requestedPath, navResult) && requestedPath) ||
          permissionService.getFirstAvailablePath(navResult) ||
          '/Dashboards';

        const authenticatedUser = authService.getUser();
        setPendingRedirectPath(redirectPath);
        setWelcomeUser(authenticatedUser?.displayName || authenticatedUser?.userName || userName.trim());
      } else {
        setErrorMessage(result.message || 'Invalid Email and/or Password');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeComplete = useCallback(() => {
    if (pendingRedirectPath) navigate(pendingRedirectPath, { replace: true });
  }, [navigate, pendingRedirectPath]);

  return (
    <div className={`bear-login ${errorMessage ? 'bear-login--error' : ''}`}>
      {welcomeUser && <LoginWelcomeOverlay userName={welcomeUser} onComplete={handleWelcomeComplete} />}
      <Bear />
      <main className="bear-login__main">
        <form className="bear-login__form" onSubmit={handleSubmit} noValidate>
          <div className="bear-login__group">
            <label htmlFor="email">Username / Email</label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              required
              placeholder="Enter username"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="bear-login__group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
            />
            <button
              id="reveal"
              className="bear-login__reveal"
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
          </div>
          <button className="bear-login__submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
          </button>
          {errorMessage && <p className="bear-login__error">{errorMessage}</p>}
          <IndicatorArm />
        </form>
      </main>
    </div>
  );
}
