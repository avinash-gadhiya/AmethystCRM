import PropTypes from 'prop-types';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Filter, ShieldCheck } from 'lucide-react';
import authService from 'services/authService';

export default function CRMModuleView({ moduleName }) {
  const location = useLocation();
  const currentUser = authService.getUser();
  const [searchQuery, setSearchQuery] = useState('');

  const pathParts = location.pathname.split('/').filter(Boolean);
  const derivedTitle = moduleName || (pathParts.length > 0 ? pathParts[pathParts.length - 1].replace(/-/g, ' ') : 'Module');
  const formattedTitle = derivedTitle.charAt(0).toUpperCase() + derivedTitle.slice(1);

  const mockRows = [1, 2, 3, 4, 5];

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="text-base font-semibold text-gray-800 capitalize mb-1">{formattedTitle}</h5>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{location.pathname}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
              <ShieldCheck size={11} /> Authorized
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1">
            <Filter size={13} /> Filter
          </button>
          <button type="button" className="btn btn-primary btn-sm flex items-center gap-1">
            <Plus size={13} /> Add New
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="form-control pl-9"
              placeholder={`Search ${formattedTitle}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="text-xs text-gray-400">
            Logged in as <strong className="text-gray-600">{currentUser?.displayName || 'User'}</strong>
            {' '}({currentUser?.role || 'Developer'})
          </span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name / Record</th>
                <th>Created Date</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockRows.map((idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs text-gray-500">#{1000 + idx}</td>
                  <td className="font-medium text-gray-800">{formattedTitle} Item #{idx}</td>
                  <td className="text-xs text-gray-400">2026-09-16 10:{20 + idx} AM</td>
                  <td className="text-sm text-gray-600">{currentUser?.displayName || 'CRM Agent'}</td>
                  <td>
                    <span className={`badge ${idx % 2 === 0 ? 'bg-success' : 'bg-primary'}`}>
                      {idx % 2 === 0 ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button type="button" className="text-xs text-indigo-600 hover:text-indigo-800 bg-transparent border-0 cursor-pointer p-0">View</button>
                      <button type="button" className="text-xs text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer p-0">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

CRMModuleView.propTypes = { moduleName: PropTypes.string };
