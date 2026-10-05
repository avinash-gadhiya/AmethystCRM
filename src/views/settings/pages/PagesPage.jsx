import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  KeyRound,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

import pageService from '@/services/pageService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolvePagePermissions } from '@/utils/pagePermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

import PageModal from '@/components/pages/PageModal';
import PagePermissionsModal from '@/components/pages/PagePermissionsModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PagesPage = () => {
  // Fail-closed permission resolution
  const perms = useMemo(() => resolvePagePermissions('page'), []);

  // Shared Menu Dropdown Options for Menu Name resolution
  const [menus, setMenus] = useState([]);
  const menuMap = useMemo(() => {
    const map = new Map();
    menus.forEach((m) => {
      map.set(Number(m.id), m.name);
    });
    return map;
  }, [menus]);

  const loadMenus = useCallback(async () => {
    try {
      const opts = await pageService.getMenus();
      setMenus(opts);
    } catch (err) {
      console.warn('Failed to load menu options:', err);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // Page List State
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('pageId');
  const [isDescending, setIsDescending] = useState(true);

  // Status updating tracking (Set of pageIds)
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal States
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);

  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionsTargetPage, setPermissionsTargetPage] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Pages Data
  const abortControllerRef = useRef(null);

  const fetchPages = useCallback(async () => {
    if (!perms.canView) {
      setPages([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const res = await pageService.getPages(
        {
          Text: debouncedSearch,
          PageNumber: currentPage,
          PageSize: pageSize,
          SortProperty: sortProperty,
          IsDescending: isDescending
        },
        controller.signal
      );

      setPages(res.data);
      setTotalCount(res.totalCount);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      const msg = getApiErrorMessage(err, 'Failed to fetch pages.');
      toast.error(msg);
      setPages([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [perms.canView, debouncedSearch, currentPage, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchPages();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPages]);

  // Handle Column Sorting
  const handleSort = (prop) => {
    if (sortProperty === prop) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(prop);
      setIsDescending(true);
    }
    setCurrentPage(1);
  };

  const renderSortIndicator = (prop) => {
    if (sortProperty !== prop) {
      return <ArrowUpDown size={13} className="inline-block ml-1 opacity-40" />;
    }
    return isDescending ? (
      <ArrowDown size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400 font-bold" />
    ) : (
      <ArrowUp size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400 font-bold" />
    );
  };

  // Optimistic Status Toggle
  const handleToggleStatus = async (item) => {
    if (!perms.canUpdate || updatingStatusIds.has(item.pageId)) return;

    const previousStatus = item.isActive;
    const nextStatus = !previousStatus;

    // Optimistic update
    setPages((prev) =>
      prev.map((p) => (p.pageId === item.pageId ? { ...p, isActive: nextStatus } : p))
    );

    setUpdatingStatusIds((prev) => new Set(prev).add(item.pageId));

    try {
      // Send complete PUT payload
      await pageService.updatePage({
        pageId: item.pageId,
        menuId: item.menuId,
        pageName: item.pageName,
        pageDisplayName: item.pageDisplayName,
        pageUrl: item.pageUrl,
        pageIcon: item.pageIcon,
        pageOrder: item.pageOrder,
        parentPageId: item.parentPageId || 0,
        isActive: nextStatus
      });

      toast.success('Page status updated');
    } catch (err) {
      // Revert optimistic update
      setPages((prev) =>
        prev.map((p) => (p.pageId === item.pageId ? { ...p, isActive: previousStatus } : p))
      );
      const msg = getApiErrorMessage(err, 'Failed to update page status.');
      toast.error(msg);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(item.pageId);
        return next;
      });
    }
  };

  // Delete Handler with page clamping
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !perms.canDelete) return;

    try {
      setDeleting(true);
      await pageService.deletePage(deleteTarget.pageId);
      toast.success('Page deleted successfully');
      setDeleteModalOpen(false);
      setDeleteTarget(null);

      // Clamp current page if deleting final item on last page
      if (pages.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        fetchPages();
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete page.');
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Pages
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage system pages and navigation
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {perms.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingPage(null);
              setPageModalOpen(true);
            }}
            className="flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>Add New Page</span>
          </LiquidGlassButton>
        )}
      </div>

      {!perms.canView ? (
        <div className="card p-12 text-center bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Access Restricted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You do not have permission to view the Pages section. Please contact your system administrator.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Frosted / Glass Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                {pages.length} of {totalCount} Pages
              </h3>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Search Box */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Pages"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setDebouncedSearch('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Refresh Button */}
                <TableRefreshButton onClick={fetchPages} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    <th
                      onClick={() => handleSort('pageId')}
                      className="py-3.5 px-4 text-center w-16 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      # {renderSortIndicator('pageId')}
                    </th>
                    <th
                      onClick={() => handleSort('pageName')}
                      className="py-3.5 px-4 min-w-[180px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Page Name {renderSortIndicator('pageName')}
                    </th>
                    <th
                      onClick={() => handleSort('pageDisplayName')}
                      className="py-3.5 px-4 min-w-[180px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Display Name {renderSortIndicator('pageDisplayName')}
                    </th>
                    <th
                      onClick={() => handleSort('pageUrl')}
                      className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      URL {renderSortIndicator('pageUrl')}
                    </th>
                    <th className="py-3.5 px-4 min-w-[150px]">
                      Menu Name
                    </th>
                    <th
                      onClick={() => handleSort('pageOrder')}
                      className="py-3.5 px-4 text-center w-24 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Order {renderSortIndicator('pageOrder')}
                    </th>
                    <th
                      onClick={() => handleSort('isActive')}
                      className="py-3.5 px-4 text-center w-28 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Status {renderSortIndicator('isActive')}
                    </th>
                    <th className="py-3.5 px-4 text-center w-36 sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {/* Loading State */}
                  {loading && (
                    <>
                      {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                        <tr key={`skel-p-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-40" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-8 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-14 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center sticky right-0 bg-white dark:bg-[#17132a]">
                            <div className="h-7 w-24 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {!loading && pages.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <FileText size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No pages found
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            No pages found. Try adjusting your search criteria.
                          </p>
                          {perms.canAdd && !searchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPage(null);
                                setPageModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add New Page
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    pages.map((item, index) => {
                      const rowNumber = (currentPage - 1) * pageSize + index + 1;
                      const isUpdating = updatingStatusIds.has(item.pageId);
                      const resolvedMenuName =
                        menuMap.get(Number(item.menuId)) || (item.menuId ? `#${item.menuId}` : '—');

                      return (
                        <tr
                          key={item.pageId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* 1. # */}
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>

                          {/* 2. Page Name: Bold violet text */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-purple-700 dark:text-purple-300">
                              {item.pageName || 'N/A'}
                            </span>
                          </td>

                          {/* 3. Display Name */}
                          <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white">
                            {item.pageDisplayName || item.pageName || '—'}
                          </td>

                          {/* 4. URL: Violet monospace text, allows long URLs to wrap */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 break-all select-all">
                              {item.pageUrl || '—'}
                            </span>
                          </td>

                          {/* 5. Menu Name: Resolved from loaded menus or fallback to #menuId */}
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 font-medium">
                              {resolvedMenuName}
                            </span>
                          </td>

                          {/* 6. Order */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-500 dark:text-gray-400">
                            {item.pageOrder ?? 0}
                          </td>

                          {/* 7. Status: Reusable iOS-style toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex justify-center">
                              <IosToggle
                                checked={item.isActive}
                                disabled={!perms.canUpdate || isUpdating}
                                loading={isUpdating}
                                onCheckedChange={() => handleToggleStatus(item)}
                                title={item.isActive ? 'Active' : 'Inactive'}
                              />
                            </div>
                          </td>

                          {/* 8. Actions: Sticky right column */}
                          <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Amber key icon: Manage Permissions */}
                              <button
                                type="button"
                                title="Manage Permissions"
                                aria-label="Manage Permissions"
                                onClick={() => {
                                  setPermissionsTargetPage(item);
                                  setPermissionsModalOpen(true);
                                }}
                                className="liquid-glass-icon-btn text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                              >
                                <KeyRound size={15} />
                              </button>

                              {/* Violet edit icon: Edit Page */}
                              {perms.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Page"
                                  onClick={() => {
                                    setEditingPage(item);
                                    setPageModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Red delete icon: Delete Page */}
                              {perms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Page"
                                  onClick={() => {
                                    setDeleteTarget(item);
                                    setDeleteModalOpen(true);
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loading && totalCount > 0 && (
              <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                  <span>
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount} Pages
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-transparent border border-gray-300 dark:border-white/10 rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:border-purple-500"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size} className="dark:bg-[#17132a]">
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <AnchorPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => setCurrentPage(p)}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Page Form Modal (Create / Edit) */}
      <PageModal
        open={pageModalOpen}
        page={editingPage}
        menus={menus}
        onClose={() => {
          setPageModalOpen(false);
          setEditingPage(null);
        }}
        onSuccess={() => {
          fetchPages();
          loadMenus();
        }}
      />

      {/* Page Permissions Modal */}
      <PagePermissionsModal
        open={permissionsModalOpen}
        page={permissionsTargetPage}
        onClose={() => {
          setPermissionsModalOpen(false);
          setPermissionsTargetPage(null);
        }}
        canAdd={perms.canAdd}
        canUpdate={perms.canUpdate}
        canDelete={perms.canDelete}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Page"
        targetName={deleteTarget?.pageDisplayName || deleteTarget?.pageName || 'Page'}
        targetId={deleteTarget?.pageId ? `#${deleteTarget.pageId}` : ''}
        loading={deleting}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default PagesPage;
