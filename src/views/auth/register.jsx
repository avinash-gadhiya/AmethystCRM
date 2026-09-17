import { NavLink } from 'react-router-dom';
import { User, Mail, Lock, Loader2 } from 'lucide-react';

// assets
import logoDark from 'assets/images/logo-dark.svg';

// -----------------------|| SIGN UP ||-----------------------//

export default function SignUp1() {
  return (
    <div className="auth-wrapper">
      <div className="auth-content">
        <div className="auth-card">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img src={logoDark} alt="DashboardKit" className="h-9 w-auto" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">Create account</h2>
            <p className="text-sm text-gray-400 text-center mb-8">
              Sign up to get started with the CRM dashboard
            </p>

            <form noValidate>
              {/* Username */}
              <div className="mb-4">
                <label htmlFor="reg-username" className="block text-xs font-medium text-gray-500 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User size={16} />
                  </span>
                  <input
                    id="reg-username"
                    type="text"
                    className="form-control pl-10"
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-4">
                <label htmlFor="reg-email" className="block text-xs font-medium text-gray-500 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail size={16} />
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    className="form-control pl-10"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label htmlFor="reg-password" className="block text-xs font-medium text-gray-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reg-password"
                    type="password"
                    className="form-control pl-10"
                    placeholder="Create a password"
                  />
                </div>
              </div>

              {/* Newsletter */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Send me the weekly newsletter</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full py-2.5 text-sm font-semibold rounded-xl"
              >
                Create Account
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-8">
              Already have an account?{' '}
              <NavLink to="/login" className="text-indigo-500 font-medium hover:text-indigo-700">
                Sign in
              </NavLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
