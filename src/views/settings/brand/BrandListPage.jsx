import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Building2,
  Mail,
  Phone,
  FileCheck2
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandPermissions } from '@/utils/brandPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';
import BrandModal from '@/components/brand/BrandModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const BrandListPage = () => {
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

  // Fetch list of brands from API
  const fetchBrands = useCallback(async () => {
    if (!permissions.canView) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await brandService.getBrands({
        Text: searchText.trim(),
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      setBrands(res.data || []);
      setTotalCount(res.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch brands'));
      setBrands([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [permissions.canView, searchText, pageNumber, pageSize, sortProperty, isDescending]);

  // StrictMode mount protection
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchBrands();
      return;
    }
    fetchBrands();
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
    if (!permissions.canUpdate) {
      toast.error('You do not have permission to modify brand status.');
      return;
    }

    const previousStatus = brand.isActive;
    const newStatus = !previousStatus;

    // Optimistically update local state
    setBrands((prev) =>
      prev.map((b) => (b.brandId === brand.brandId ? { ...b, isActive: newStatus } : b))
    );

    try {
      await brandService.updateBrand({
        ...brand,
        isActive: newStatus
      });
      toast.success(
        `Brand "${brand.brandName}" is now ${newStatus ? 'active' : 'inactive'}.`
      );
    } catch (error) {
      console.error('Failed to update brand status:', error);
      toast.error(getApiErrorMessage(error, 'Failed to update brand status'));
      // Revert optimistic update
      setBrands((prev) =>
        prev.map((b) => (b.brandId === brand.brandId ? { ...b, isActive: previousStatus } : b))
      );
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
    navigate(`/settings/branddetails?brandId=${brandId}&tab=email`);
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
              <Award size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Brands
              </h1>
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Access Restricted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You do not have permission to view the Brands management section. Please contact
              your system administrator if you believe this is an error.
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
                <TableRefreshButton onClick={fetchBrands} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Paginated Table Container */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    <th className="py-3.5 px-4 text-center w-14">#</th>
                    <th className="py-3.5 px-4 w-16 text-center">Logo</th>
                    <th
                      onClick={() => handleToggleSort('brandName')}
                      className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Brand Name {renderSortIcon('brandName')}
                    </th>
                    <th className="py-3.5 px-4 min-w-[220px]">
                      Contact Information
                    </th>
                    <th className="py-3.5 px-4 min-w-[140px]">
                      Doc Signing
                    </th>
                    <th
                      onClick={() => handleToggleSort('isActive')}
                      className="py-3.5 px-4 text-center w-28 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Status {renderSortIcon('isActive')}
                    </th>
                    <th className="py-3.5 px-4 text-right min-w-[160px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {/* Loading State Skeleton */}
                  {loading && (
                    <>
                      {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                        <tr key={`skel-brand-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-10 w-10 bg-gray-200 dark:bg-white/10 rounded-lg mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-44 mb-1.5" />
                            <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-28" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36 mb-1" />
                            <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-24" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded-full w-20" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-5 w-10 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="h-7 w-24 bg-gray-200 dark:bg-white/10 rounded-lg ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {!loading && brands.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <Building2 size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            {searchText ? 'No matching brands' : 'No brands available'}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            {searchText
                              ? `No brands match "${searchText}". Try searching for another term.`
                              : 'Get started by creating your first corporate brand.'}
                          </p>
                          {permissions.canAdd && !searchText && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBrand(null);
                                setEditorModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Create Brand
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    brands.map((brand, index) => {
                      const rowNumber = (pageNumber - 1) * pageSize + index + 1;
                      return (
                        <tr
                          key={brand.brandId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* Row Number */}
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>

                          {/* Logo Preview */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden mx-auto shadow-2xs">
                              {brand.logoUrl ? (
                                <img
                                  src={brand.logoUrl}
                                  alt={brand.brandName}
                                  className="w-full h-full object-contain p-0.5"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <span
                                style={{ display: brand.logoUrl ? 'none' : 'flex' }}
                                className="text-xs font-bold text-purple-600 dark:text-purple-400 items-center justify-center w-full h-full uppercase"
                              >
                                {brand.brandName?.charAt(0) || 'B'}
                              </span>
                            </div>
                          </td>

                          {/* Brand Name & Display Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => handleOpenDetails(brand.brandId)}
                                className="text-left font-semibold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1.5 group-hover:underline"
                              >
                                {brand.brandName}
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                                  #{brand.brandId}
                                </span>
                              </button>
                              {brand.brandDisplayName && brand.brandDisplayName !== brand.brandName && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {brand.brandDisplayName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Contact Information */}
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <div className="space-y-1">
                              {brand.supportEmail ? (
                                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                                  <Mail size={12} className="text-gray-400 shrink-0" />
                                  <span className="truncate">{brand.supportEmail}</span>
                                </div>
                              ) : null}
                              {brand.tollfree ? (
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                  <Phone size={12} className="text-gray-400 shrink-0" />
                                  <span>{brand.tollfree}</span>
                                </div>
                              ) : null}
                              {!brand.supportEmail && !brand.tollfree && (
                                <span className="text-gray-400 italic">No contact info</span>
                              )}
                            </div>
                          </td>

                          {/* Doc API Status */}
                          <td className="py-3.5 px-4">
                            {brand.docTemplateId || brand.docRole ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40">
                                <FileCheck2 size={12} />
                                <span>{brand.isDocAPILive ? 'Doc Live' : 'Doc Test'}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not configured</span>
                            )}
                          </td>

                          {/* Status Toggle (Optimistic Update, iOS Toggle) */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center scale-90">
                              <IosToggle
                                checked={Boolean(brand.isActive)}
                                onCheckedChange={() => handleToggleActive(brand)}
                                disabled={!permissions.canUpdate}
                                title={brand.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open Details Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEmail(brand.brandId)}
                                className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                                title="Manage Brand Email"
                              >
                                <ExternalLink size={15} />
                              </button>

                              {/* Edit Button */}
                              {permissions.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Brand"
                                  onClick={() => {
                                    setEditingBrand(brand);
                                    setEditorModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Delete Button */}
                              {permissions.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Brand"
                                  onClick={() => {
                                    setDeleteTarget(brand);
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
                {/* Left: Records summary & Page size selector */}
                <div className="flex items-center gap-3">
                  <span>
                    Showing {(pageNumber - 1) * pageSize + 1} to{' '}
                    {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} records
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
        isOpen={editorModalOpen}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingBrand(null);
        }}
        brand={editingBrand}
        onSaved={() => {
          setEditorModalOpen(false);
          setEditingBrand(null);
          fetchBrands();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Brand"
        message={
          deleteTarget ? (
            <span>
              Are you sure you want to delete brand{' '}
              <strong className="text-gray-900 dark:text-white">
                &quot;{deleteTarget.brandName}&quot;
              </strong>{' '}
              (ID: {deleteTarget.brandId})? This action cannot be undone and may affect associated
              emails, payment gateways, and templates.
            </span>
          ) : (
            'Are you sure you want to delete this brand?'
          )
        }
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default BrandListPage;
