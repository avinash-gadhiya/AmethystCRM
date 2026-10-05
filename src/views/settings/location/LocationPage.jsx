import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin,
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

import locationService from '@/services/locationService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveLocationPermissions } from '@/utils/locationPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

import LocationModal from '@/components/location/LocationModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const LocationPage = () => {
  // Fail-closed permission resolution
  const perms = useMemo(() => resolveLocationPermissions('location'), []);

  // Location List State
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('locationId');
  const [isDescending, setIsDescending] = useState(true);

  // Status updating tracking (Set of locationIds)
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal States
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

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

  // A monotonically increasing request ID prevents older responses from replacing newer results.
  const latestRequestRef = useRef(0);

  const fetchLocations = useCallback(async (forceFresh = false) => {
    if (!perms.canView) {
      setLocations([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const requestId = ++latestRequestRef.current;

    try {
      setLoading(true);
      const res = await locationService.getLocations(
        {
          Text: debouncedSearch,
          PageNumber: currentPage,
          PageSize: pageSize,
          SortProperty: sortProperty,
          IsDescending: isDescending
        },
        undefined,
        forceFresh
      );

      if (requestId !== latestRequestRef.current) return;
      setLocations(res.data);
      setTotalCount(res.totalCount);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      const msg = getApiErrorMessage(err, 'Failed to fetch locations.');
      toast.error(msg);
      setLocations([]);
      setTotalCount(0);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [perms.canView, debouncedSearch, currentPage, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchLocations();
    return () => {
      latestRequestRef.current += 1;
    };
  }, [fetchLocations]);

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
    if (!perms.canUpdate || updatingStatusIds.has(item.locationId)) return;

    const previousStatus = item.isActive;
    const nextStatus = !previousStatus;

    // Optimistic UI update
    setLocations((prev) =>
      prev.map((loc) => (loc.locationId === item.locationId ? { ...loc, isActive: nextStatus } : loc))
    );

    setUpdatingStatusIds((prev) => new Set(prev).add(item.locationId));

    try {
      await locationService.updateLocation({
        locationId: item.locationId,
        name: item.name,
        isActive: nextStatus
      });

      toast.success('Location status updated');
      await fetchLocations(true);
    } catch (err) {
      // Revert optimistic update
      setLocations((prev) =>
        prev.map((loc) => (loc.locationId === item.locationId ? { ...loc, isActive: previousStatus } : loc))
      );
      const msg = getApiErrorMessage(err, 'Failed to update location status.');
      toast.error(msg);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(item.locationId);
        return next;
      });
    }
  };

  // Delete Handler with page clamping
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !perms.canDelete) return;

    try {
      setDeleting(true);
      await locationService.deleteLocation(deleteTarget.locationId);
      toast.success('Location deleted successfully');
      setDeleteModalOpen(false);
      setDeleteTarget(null);

      // Clamp current page if deleting final item on last page
      if (locations.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        fetchLocations(true);
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete location.');
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
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Locations
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage operational locations, branches, and centers
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {perms.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingLocation(null);
              setLocationModalOpen(true);
            }}
            className="flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>Add Location</span>
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
              You do not have permission to view the Locations section. Please contact your system administrator.
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
                  {locations.length} of {totalCount} results
                </h3>
                {/* Mobile Refresh Button */}
                <div className="sm:hidden">
                  <TableRefreshButton onClick={() => fetchLocations(true)} />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Search Box */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Location"
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
                  <TableRefreshButton onClick={() => fetchLocations(true)} className="shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    {/* 1. # */}
                    <th
                      onClick={() => handleSort('locationId')}
                      className="py-3.5 px-4 text-center w-16 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      # {renderSortIndicator('locationId')}
                    </th>

                    {/* 2. Location Name */}
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3.5 px-4 min-w-[240px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Location Name {renderSortIndicator('name')}
                    </th>

                    {/* 3. Is Active */}
                    <th className="py-3.5 px-4 text-center w-36 select-none">
                      Is Active
                    </th>

                    {/* 4. Actions */}
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
                        <tr key={`skel-loc-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-48" />
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
                  {!loading && locations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <MapPin size={28} className="opacity-80" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                            No locations found. Try adjusting your search criteria.
                          </p>
                          {perms.canAdd && !searchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLocation(null);
                                setLocationModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Location
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    locations.map((item, index) => {
                      const rowNumber = (currentPage - 1) * pageSize + index + 1;
                      const isUpdating = updatingStatusIds.has(item.locationId);

                      return (
                        <tr
                          key={item.locationId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* 1. # */}
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>

                          {/* 2. Location Name: Bold violet text */}
                          <td className="py-3.5 px-4 font-semibold text-purple-700 dark:text-purple-300">
                            {item.name || 'N/A'}
                          </td>

                          {/* 3. Is Active: Reusable iOS-style toggle with ON / OFF text */}
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

                          {/* 4. Actions: Sticky right column */}
                          <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Violet edit icon button: Edit Location */}
                              {perms.canUpdate && (
                                <ActionIconButton
                                  icon={Edit}
                                  variant="edit"
                                  tooltip="Edit Location"
                                  onClick={() => {
                                    setEditingLocation(item);
                                    setLocationModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Red delete icon button: Delete Location */}
                              {perms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Location"
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

      {/* Location Form Modal (Create / Edit) */}
      <LocationModal
        open={locationModalOpen}
        location={editingLocation}
        onClose={() => {
          setLocationModalOpen(false);
          setEditingLocation(null);
        }}
        onSuccess={() => fetchLocations(true)}
        canAdd={perms.canAdd}
        canUpdate={perms.canUpdate}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Location"
        description="Are you sure you want to delete"
        itemName={deleteTarget?.name || 'Location'}
        details={[
          { label: 'Location ID', value: deleteTarget?.locationId ?? 'N/A' },
          { label: 'Location Name', value: deleteTarget?.name || 'N/A' }
        ]}
        loading={deleting}
        onCancel={() => {
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

export default LocationPage;
