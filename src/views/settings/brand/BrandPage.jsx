import BrandTable from './BrandTable';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Plus, Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { toast, Toaster } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandPermissions } from '@/utils/brandPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';

import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';

import BrandModal from '@/components/brand/BrandModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const BrandPage = () => {
  const navigate = useNavigate();

  // Permissions (fail-closed)
  const permissions = useMemo(() => resolveBrandPermissions('brand'), []);

  // Data & Pagination state
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('brandId');
  const [isDescending, setIsDescending] = useState(true);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestRef = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [pendingIds, setPendingIds] = useState(new Set());

  // Fetch list of brands from API
  const fetchBrands = useCallback(async () => {
    if (!permissions.canView) {
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    try {
      setLoadError('');
      setLoading(true);
      const res = await brandService.getBrands({
        Text: searchText.trim(),
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      if (requestId !== requestRef.current) return;
      setBrands(res.data || []);
      setTotalCount(res.totalCount || 0);
      if (pageNumber > 1 && pageNumber > Math.max(1, Math.ceil(res.totalCount / pageSize)))
        setPageNumber(Math.max(1, Math.ceil(res.totalCount / pageSize)));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setLoadError(getApiErrorMessage(error, 'Failed to fetch brands'));
      toast.error(getApiErrorMessage(error, 'Failed to fetch brands'));
      setBrands([]);
      setTotalCount(0);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [permissions.canView, searchText, pageNumber, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchBrands();
    return () => {
      requestRef.current++;
    };
  }, [fetchBrands]);

  // Handle Sort toggle
  const handleToggleSort = (property) => {
    if (sortProperty === property) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(property);
      setIsDescending(true);
    }
    setPageNumber(1);
  };

  // Optimistic Toggle Active/Inactive
  const handleToggleActive = async (brand) => {
    if (!permissions.canUpdate || pendingIds.has(brand.brandId)) {
      toast.error('You do not have permission to modify brand status.');
      return;
    }

    setPendingIds((ids) => new Set(ids).add(brand.brandId));
    const previousStatus = brand.isActive;
    const newStatus = !previousStatus;

    // Optimistically update local state
    setBrands((prev) => prev.map((b) => (b.brandId === brand.brandId ? { ...b, isActive: newStatus } : b)));

    try {
      await brandService.updateBrand({
        ...brand,
        isActive: newStatus
      });
      toast.success(`Brand "${brand.brandName}" is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (error) {
      console.error('Failed to update brand status:', error);
      toast.error(getApiErrorMessage(error, 'Failed to update brand status'));
      // Revert optimistic update
      setBrands((prev) => prev.map((b) => (b.brandId === brand.brandId ? { ...b, isActive: previousStatus } : b)));
    } finally {
      setPendingIds((ids) => {
        const next = new Set(ids);
        next.delete(brand.brandId);
        return next;
      });
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await brandService.deleteBrand(deleteTarget.brandId);
      toast.success(`Brand "${deleteTarget.brandName}" was deleted.`);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchBrands();
    } catch (err) {
      console.error('Failed to delete brand:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete brand'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate to brand details
  const handleOpenDetails = (brandId) => {
    navigate(`/settings/brandemail?brandId=${brandId}&tab=email`);
  };

  const handleOpenEmail = (brandId) => {
    navigate(`/settings/brandemail?brandId=${brandId}&tab=email`);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Render Sort Icon
  const renderSortIcon = (property) => {
    if (sortProperty !== property) {
      return <ArrowUpDown size={13} className="text-gray-400 opacity-60 inline ml-1" />;
    }
    return isDescending ? (
      <ArrowDown size={13} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    ) : (
      <ArrowUp size={13} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      {loadError && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">
          {loadError}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
              <Award size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Brands</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Manage your brands, contact details, e-sign integrations, payment gateways, and templates.
              </p>
            </div>
          </div>
        </div>

        {permissions.canAdd && (
          <div className="flex items-center gap-2">
            <LiquidGlassButton
              onClick={() => {
                setEditingBrand(null);
                setEditorModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Brand</span>
            </LiquidGlassButton>
          </div>
        )}
      </div>

      {/* Permission Blocked State */}
      {!permissions.canView ? (
        <div className="card p-12 text-center bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Restricted</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You do not have permission to view the Brands management section. Please contact your system administrator if you believe this
              is an error.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Toolbar Card */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                Showing {brands.length} of {totalCount} Brands
              </h3>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Search field */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by brand name, email..."
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setPageNumber(1);
                    }}
                    className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText('');
                        setPageNumber(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={14} className="text-gray-500 dark:text-gray-300" />
                    </button>
                  )}
                </div>

                {/* Refresh Button */}
                <TableRefreshButton
                  onClick={() => {
                    brandService.clearBrandCache();
                    fetchBrands();
                  }}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Paginated Table Container */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <BrandTable
              handleToggleSort={handleToggleSort}
              renderSortIcon={renderSortIcon}
              loading={loading}
              pageSize={pageSize}
              loadError={loadError}
              brands={brands}
              searchText={searchText}
              permissions={permissions}
              setEditingBrand={setEditingBrand}
              setEditorModalOpen={setEditorModalOpen}
              pageNumber={pageNumber}
              handleOpenDetails={handleOpenDetails}
              handleToggleActive={handleToggleActive}
              pendingIds={pendingIds}
              handleOpenEmail={handleOpenEmail}
              setDeleteTarget={setDeleteTarget}
              setDeleteModalOpen={setDeleteModalOpen}
            />

            {/* Pagination Footer */}
            {!loading && totalCount > 0 && (
              <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                {/* Left: Records summary & Page size selector */}
                <div className="flex items-center gap-3">
                  <span>
                    Showing {(pageNumber - 1) * pageSize + 1} to {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} records
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPageNumber(1);
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

                {/* Right: Page navigation */}
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-2 font-medium text-gray-700 dark:text-gray-300">
                    Page {pageNumber} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={pageNumber >= totalPages}
                    onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Brand Create / Edit Modal */}
      <BrandModal
        open={editorModalOpen}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingBrand(null);
        }}
        brand={editingBrand}
        onSuccess={() => {
          setEditorModalOpen(false);
          setEditingBrand(null);
          fetchBrands();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Brand"
        description="Are you sure you want to delete brand"
        itemName={deleteTarget?.brandName}
        loading={isDeleting}
      />
    </div>
  );
};

export default BrandPage;
