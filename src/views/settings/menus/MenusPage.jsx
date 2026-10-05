import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Menu as MenuIcon,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

import menuService from '@/services/menuService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveMenuPermissions } from '@/utils/menuPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

import MenuModal from '@/components/menus/MenuModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const MenusPage = () => {
  // Fail-closed permission resolution
  const perms = useMemo(() => resolveMenuPermissions('menu'), []);

  // Menu List State
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('menuId');
  const [isDescending, setIsDescending] = useState(true);

  // Status updating tracking (Set of menuIds)
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal States
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);

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

  // Fetch Menus Data
  const abortControllerRef = useRef(null);

  const fetchMenus = useCallback(async () => {
    if (!perms.canView) {
      setMenus([]);
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
      const res = await menuService.getMenus(
        {
          Text: debouncedSearch,
          PageNumber: currentPage,
          PageSize: pageSize,
          SortProperty: sortProperty,
          IsDescending: isDescending
        },
        controller.signal
      );

      setMenus(res.data);
      setTotalCount(res.totalCount);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      const msg = getApiErrorMessage(err, 'Failed to fetch menus.');
      toast.error(msg);
      setMenus([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [perms.canView, debouncedSearch, currentPage, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchMenus();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMenus]);

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
    if (!perms.canUpdate || updatingStatusIds.has(item.menuId)) return;

    const previousStatus = item.isActive;
    const nextStatus = !previousStatus;

    // Optimistic update
    setMenus((prev) =>
      prev.map((m) => (m.menuId === item.menuId ? { ...m, isActive: nextStatus } : m))
    );

    setUpdatingStatusIds((prev) => new Set(prev).add(item.menuId));

    try {
      // Send complete PUT payload preserving all fields
      await menuService.updateMenu({
        menuId: item.menuId,
        menuName: item.menuName,
        menuDisplayName: item.menuDisplayName,
        menuIcon: item.menuIcon,
        menuOrder: item.menuOrder,
        menuUrl: item.menuUrl,
        isActive: nextStatus
      });

      toast.success('Menu status updated');
    } catch (err) {
      // Revert optimistic update
      setMenus((prev) =>
        prev.map((m) => (m.menuId === item.menuId ? { ...m, isActive: previousStatus } : m))
      );
      const msg = getApiErrorMessage(err, 'Failed to update menu status.');
      toast.error(msg);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(item.menuId);
        return next;
      });
    }
  };

  // Delete Handler with page clamping
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !perms.canDelete) return;

    try {
      setDeleting(true);
      await menuService.deleteMenu(deleteTarget.menuId);
      toast.success('Menu deleted successfully');
      setDeleteModalOpen(false);
      setDeleteTarget(null);

      // Clamp current page if deleting final item on last page
      if (menus.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        fetchMenus();
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete menu.');
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
            <MenuIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Menus
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage system navigation menus and top-level hierarchy
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {perms.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingMenu(null);
              setMenuModalOpen(true);
            }}
            className="flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>Add Menu</span>
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
              You do not have permission to view the Menus section. Please contact your system administrator.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Frosted / Glass Responsive Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                  {menus.length} of {totalCount} results
                </h3>
                {/* Mobile Refresh Button */}
                <div className="sm:hidden">
                  <TableRefreshButton onClick={fetchMenus} />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Search Box */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Menu"
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

                {/* Desktop Refresh Button */}
                <div className="hidden sm:block">
                  <TableRefreshButton onClick={fetchMenus} className="shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    {/* 1. # */}
                    <th
                      onClick={() => handleSort('menuId')}
                      className="py-3.5 px-4 text-center w-16 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      # {renderSortIndicator('menuId')}
                    </th>

                    {/* 2. Menu Name */}
                    <th
                      onClick={() => handleSort('menuName')}
                      className="py-3.5 px-4 min-w-[180px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Menu Name {renderSortIndicator('menuName')}
                    </th>

                    {/* 3. Display Name */}
                    <th
                      onClick={() => handleSort('menuDisplayName')}
                      className="py-3.5 px-4 min-w-[180px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Display Name {renderSortIndicator('menuDisplayName')}
                    </th>

                    {/* 4. Order */}
                    <th
                      onClick={() => handleSort('menuOrder')}
                      className="py-3.5 px-4 text-center w-24 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Order {renderSortIndicator('menuOrder')}
                    </th>

                    {/* 5. URL */}
                    <th
                      onClick={() => handleSort('menuUrl')}
                      className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      URL {renderSortIndicator('menuUrl')}
                    </th>

                    {/* 6. Is Active */}
                    <th className="py-3.5 px-4 text-center w-36 select-none">
                      Is Active
                    </th>

                    {/* 7. Actions */}
                    <th className="py-3.5 px-4 text-center w-28 sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {/* Loading State */}
                  {loading && (
                    <>
                      {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                        <tr key={`skel-m-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-8 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-40" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-20 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center sticky right-0 bg-white dark:bg-[#17132a]">
                            <div className="h-7 w-20 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {!loading && menus.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <MenuIcon size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No menus found
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            No menus found. Try adjusting your search criteria.
                          </p>
                          {perms.canAdd && !searchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMenu(null);
                                setMenuModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Menu
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    menus.map((item, index) => {
                      const rowNumber = (currentPage - 1) * pageSize + index + 1;
                      const isUpdating = updatingStatusIds.has(item.menuId);

                      return (
                        <tr
                          key={item.menuId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* 1. # */}
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>

                          {/* 2. Menu Name: Bold violet text */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-purple-700 dark:text-purple-300">
                              {item.menuName || 'N/A'}
                            </span>
                          </td>

                          {/* 3. Display Name */}
                          <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white">
                            {item.menuDisplayName || item.menuName || '—'}
                          </td>

                          {/* 4. Order */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-500 dark:text-gray-400">
                            {item.menuOrder ?? 0}
                          </td>

                          {/* 5. URL: Violet monospace text, allows long URLs to wrap */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 break-all select-all">
                              {item.menuUrl || '—'}
                            </span>
                          </td>

                          {/* 6. Is Active: Reusable iOS-style toggle with ON / OFF text beside it */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <IosToggle
                                checked={item.isActive}
                                disabled={!perms.canUpdate || isUpdating}
                                loading={isUpdating}
                                onCheckedChange={() => handleToggleStatus(item)}
                                title={item.isActive ? 'Active' : 'Inactive'}
                              />
                              <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300 min-w-[26px] text-left">
                                {item.isActive ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </td>

                          {/* 7. Actions: Sticky right column */}
                          <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Violet edit icon button: Edit Menu */}
                              {perms.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Menu"
                                  onClick={() => {
                                    setEditingMenu(item);
                                    setMenuModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Red delete icon button: Delete Menu */}
                              {perms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Menu"
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
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount} records
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

      {/* Menu Form Modal (Create / Edit) */}
      <MenuModal
        open={menuModalOpen}
        menu={editingMenu}
        onClose={() => {
          setMenuModalOpen(false);
          setEditingMenu(null);
        }}
        onSuccess={fetchMenus}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Menu"
        message="Are you sure you want to delete this menu? This action cannot be undone."
        targetName={deleteTarget?.menuDisplayName || deleteTarget?.menuName || 'Menu'}
        targetId={deleteTarget?.menuId ? `#${deleteTarget.menuId}` : ''}
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

export default MenusPage;
