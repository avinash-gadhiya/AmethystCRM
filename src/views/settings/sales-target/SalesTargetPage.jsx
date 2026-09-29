import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Search,
  Target,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import salesTargetService from '@/services/salesTargetService';
import { getApiErrorMessage } from '@/lib/apiError';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import SalesTargetModal from '@/components/sales-target/SalesTargetModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const searchableText = (user) =>
  [user.fullName, user.firstName, user.lastName, user.email, user.username, user.userId]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();

const compareValues = (left, right, property) => {
  const leftValue = left[property];
  const rightValue = right[property];

  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;

  if (typeof leftValue === 'number' && typeof rightValue === 'number') return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
};

const SalesTargetPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('userId');
  const [isDescending, setIsDescending] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const latestRequestRef = useRef(0);

  const fetchUsers = useCallback(async (forceFresh = false) => {
    const requestId = ++latestRequestRef.current;
    try {
      setLoading(true);
      const salesUsers = await salesTargetService.getSalesUsers(forceFresh);
      if (requestId !== latestRequestRef.current) return;
      setUsers(salesUsers);
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      setUsers([]);
      toast.error(getApiErrorMessage(error, 'Failed to fetch sales users.'));
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    return () => {
      latestRequestRef.current += 1;
    };
  }, [fetchUsers]);

  const filteredAndSortedUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = query ? users.filter((user) => searchableText(user).includes(query)) : users;

    return [...filtered].sort((left, right) => {
      const comparison = compareValues(left, right, sortProperty);
      return isDescending ? -comparison : comparison;
    });
  }, [isDescending, searchTerm, sortProperty, users]);

  const totalCount = filteredAndSortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedUsers.slice(start, start + pageSize);
  }, [currentPage, filteredAndSortedUsers, pageSize]);

  const handleSort = (property) => {
    setCurrentPage(1);
    if (sortProperty === property) {
      setIsDescending((current) => !current);
    } else {
      setSortProperty(property);
      setIsDescending(false);
    }
  };

  const renderSortIndicator = (property) => {
    if (sortProperty !== property) return <ArrowUpDown size={13} className="inline-block ml-1 opacity-40" />;
    return isDescending ? (
      <ArrowDown size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400" />
    ) : (
      <ArrowUp size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400" />
    );
  };

  const openEditor = (user) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center gap-3 pb-2">
        <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
          <Target size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Sales Target</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Set per-user Sales Target and RPL Target values.
          </p>
        </div>
      </div>

      <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <h3 className="font-medium text-sm text-gray-700 dark:text-white">
              {pagedUsers.length} of {totalCount} Users
            </h3>
            <div className="sm:hidden">
              <TableRefreshButton onClick={() => fetchUsers(true)} loading={loading} />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
              <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
              <input
                type="text"
                placeholder="Search by name"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="hidden sm:block">
              <TableRefreshButton onClick={() => fetchUsers(true)} loading={loading} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                <th
                  onClick={() => handleSort('fullName')}
                  className="py-3.5 px-5 min-w-[260px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 select-none"
                >
                  Name {renderSortIndicator('fullName')}
                </th>
                <th
                  onClick={() => handleSort('salesTarget')}
                  className="py-3.5 px-4 text-center min-w-[150px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 select-none"
                >
                  Sales Target {renderSortIndicator('salesTarget')}
                </th>
                <th
                  onClick={() => handleSort('rplTarget')}
                  className="py-3.5 px-4 text-center min-w-[150px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 select-none"
                >
                  RPL Target {renderSortIndicator('rplTarget')}
                </th>
                <th className="py-3.5 px-4 text-center w-28 sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
              {loading &&
                Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
                  <tr key={`sales-target-skeleton-${index}`} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 w-44 rounded bg-gray-200 dark:bg-white/10" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 mx-auto rounded bg-gray-200 dark:bg-white/10" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 mx-auto rounded bg-gray-200 dark:bg-white/10" /></td>
                    <td className="py-4 px-4 sticky right-0 bg-white dark:bg-[#17132a]"><div className="h-8 w-8 mx-auto rounded-full bg-gray-200 dark:bg-white/10" /></td>
                  </tr>
                ))}

              {!loading && pagedUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                        <Target size={28} className="opacity-80" />
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        No users found. Try adjusting your search criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                pagedUsers.map((user) => (
                  <tr key={user.userId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group">
                    <td className="py-3.5 px-5 font-semibold text-purple-700 dark:text-purple-300">
                      {user.fullName || user.username || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-gray-700 dark:text-gray-300">
                      {user.salesTarget ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-gray-700 dark:text-gray-300">
                      {user.rplTarget ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                      <ActionIconButton
                        icon={Edit}
                        variant="edit"
                        tooltip="Edit Sales Target"
                        onClick={() => openEditor(user)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && totalCount > 0 && (
          <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} Users
              </span>
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border border-gray-300 dark:border-white/10 rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:border-purple-500"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size} className="dark:bg-[#17132a]">{size}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-medium text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <SalesTargetModal
        open={modalOpen}
        user={editingUser}
        users={users}
        usersLoading={loading}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => fetchUsers(true)}
      />
    </div>
  );
};

export default SalesTargetPage;
