import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  FileText,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import brandTemplateService from '@/services/brandTemplateService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandTemplatePermissions } from '@/utils/brandTemplatePermissions';
import ActionIconButton from '@/components/common/ActionIconButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import StandaloneBrandTemplateModal from '@/components/brand/StandaloneBrandTemplateModal';

const PAGE_SIZES = [10, 25, 50, 100];

const BrandTemplatePage = () => {
  const permissions = useMemo(() => resolveBrandTemplatePermissions(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBrandId = Number(searchParams.get('brandId')) || 0;
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('brandEmailTemplateId');
  const [isDescending, setIsDescending] = useState(true);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!(permissions.canView || permissions.canAdd || permissions.canUpdate)) {
      setBrands([]);
      return undefined;
    }

    let active = true;
    setBrandsLoading(true);
    brandTemplateService
      .getBrands()
      .then((items) => {
        if (active) setBrands(items);
      })
      .catch((error) => {
        if (active) toast.error(getApiErrorMessage(error, 'Failed to load brands.'));
      })
      .finally(() => {
        if (active) setBrandsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [permissions.canAdd, permissions.canUpdate, permissions.canView]);

  const fetchTemplates = useCallback(
    async (forceFresh = false) => {
      if (!permissions.canView) {
        setRows([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const requestId = ++latestRequestRef.current;
      setLoading(true);
      try {
        const response = await brandTemplateService.getBrandTemplates(
          {
            Text: debouncedSearch,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: sortProperty,
            IsDescending: isDescending,
            ...(selectedBrandId ? { BrandId: selectedBrandId } : {})
          },
          forceFresh
        );
        if (requestId !== latestRequestRef.current) return;
        setRows(response.data || []);
        setTotalCount(Number(response.totalCount) || 0);
      } catch (error) {
        if (requestId !== latestRequestRef.current) return;
        setRows([]);
        setTotalCount(0);
        toast.error(getApiErrorMessage(error, 'Failed to fetch Brand Templates.'));
      } finally {
        if (requestId === latestRequestRef.current) setLoading(false);
      }
    },
    [debouncedSearch, isDescending, page, pageSize, permissions.canView, selectedBrandId, sortProperty]
  );

  useEffect(() => {
    fetchTemplates();
    return () => {
      latestRequestRef.current += 1;
    };
  }, [fetchTemplates]);

  const setBrandFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('brandId', String(value));
    else next.delete('brandId');
    setSearchParams(next);
    setPage(1);
  };

  const handleSort = (property) => {
    if (sortProperty === property) setIsDescending((current) => !current);
    else {
      setSortProperty(property);
      setIsDescending(false);
    }
    setPage(1);
  };

  const sortIcon = (property) => {
    if (sortProperty !== property) return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />;
    return isDescending ? (
      <ArrowDown size={12} className="inline ml-1 text-purple-600 dark:text-purple-400" />
    ) : (
      <ArrowUp size={12} className="inline ml-1 text-purple-600 dark:text-purple-400" />
    );
  };

  const refreshTemplates = async () => {
    brandTemplateService.clearTemplateCache();
    await fetchTemplates(true);
  };

  const toggleStatus = async (record) => {
    if (!permissions.canUpdate || updatingIds.has(record.brandEmailTemplateId)) return;
    const previousStatus = record.isActive;
    const nextStatus = !previousStatus;
    setRows((current) =>
      current.map((item) =>
        item.brandEmailTemplateId === record.brandEmailTemplateId ? { ...item, isActive: nextStatus } : item
      )
    );
    setUpdatingIds((current) => new Set(current).add(record.brandEmailTemplateId));

    try {
      await brandTemplateService.updateBrandTemplate({ ...record, isActive: nextStatus });
      toast.success('Template status updated');
      await fetchTemplates(true);
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.brandEmailTemplateId === record.brandEmailTemplateId ? { ...item, isActive: previousStatus } : item
        )
      );
      toast.error(getApiErrorMessage(error, 'Failed to update template status.'));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(record.brandEmailTemplateId);
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !permissions.canDelete) return;
    setDeleting(true);
    try {
      await brandTemplateService.deleteBrandTemplate(deleteTarget.brandEmailTemplateId);
      toast.success('Template deleted successfully');
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setPage((current) => Math.max(1, current - 1));
      else await fetchTemplates(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete template.'));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="w-full space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Templates</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage email templates for transactional and marketing emails
            </p>
          </div>
        </div>
        {permissions.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingTemplate(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Template
          </LiquidGlassButton>
        )}
      </div>

      {!permissions.canView ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] p-12 text-center">
          <ShieldAlert size={32} className="mx-auto text-amber-500 mb-3" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You do not have permission to view Brand Templates.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#17132a]/90 backdrop-blur p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                  {rows.length} of {totalCount} Templates
                </span>
                <div className="lg:hidden"><TableRefreshButton onClick={refreshTemplates} loading={loading} /></div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full lg:w-auto">
                <label className="w-full sm:w-48">
                  <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Brand</span>
                  <select
                    value={selectedBrandId || ''}
                    onChange={(event) => setBrandFilter(Number(event.target.value) || 0)}
                    disabled={brandsLoading}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  >
                    <option value="">All Brands</option>
                    {brands.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.brandName}</option>)}
                  </select>
                </label>

                <div className="relative flex items-center w-full sm:w-64 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] focus-within:border-purple-500 sm:mb-0">
                  <Search size={16} className="ml-3 text-gray-400 shrink-0" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search Templates"
                    className="w-full px-2 py-2 pr-8 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400"
                  />
                  {search && (
                    <button type="button" onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} aria-label="Clear search" className="absolute right-2 text-gray-400 hover:text-purple-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="hidden lg:block"><TableRefreshButton onClick={refreshTemplates} loading={loading} /></div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-gray-50/90 dark:bg-[#1d1733] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <tr>
                    <th onClick={() => handleSort('subject')} className="px-4 py-3.5 min-w-[250px] cursor-pointer select-none hover:text-purple-600">Subject {sortIcon('subject')}</th>
                    <th onClick={() => handleSort('templateName')} className="px-4 py-3.5 min-w-[190px] cursor-pointer select-none hover:text-purple-600">Template Name {sortIcon('templateName')}</th>
                    <th onClick={() => handleSort('fromEmail')} className="px-4 py-3.5 min-w-[240px] cursor-pointer select-none hover:text-purple-600">Email ID {sortIcon('fromEmail')}</th>
                    <th onClick={() => handleSort('brandName')} className="px-4 py-3.5 min-w-[150px] cursor-pointer select-none hover:text-purple-600">Brand {sortIcon('brandName')}</th>
                    <th onClick={() => handleSort('isActive')} className="px-4 py-3.5 text-center min-w-[150px] cursor-pointer select-none hover:text-purple-600">Status {sortIcon('isActive')}</th>
                    <th className="px-4 py-3.5 text-center min-w-[110px] sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {loading && Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
                    <tr key={`brand-template-skeleton-${index}`} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-gray-200 dark:bg-white/10" /></td>)}
                    </tr>
                  ))}

                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-500 dark:text-gray-400">No templates found. Try adjusting your search criteria.</td></tr>
                  )}

                  {!loading && rows.map((record) => {
                    const updating = updatingIds.has(record.brandEmailTemplateId);
                    const brandName = record.brandName || brands.find((brand) => brand.brandId === record.brandId)?.brandName || '-';
                    return (
                      <tr key={record.brandEmailTemplateId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 group">
                        <td className="px-4 py-3.5 max-w-[300px]"><span className="block truncate font-medium text-gray-900 dark:text-white" title={record.subject || '-'}>{record.subject || '-'}</span></td>
                        <td className="px-4 py-3.5 text-gray-700 dark:text-gray-200">{record.templateName || '-'}</td>
                        <td className="px-4 py-3.5">
                          <span className="block text-gray-800 dark:text-gray-100">{record.fromEmail || '-'}</span>
                          {record.ccEmail && <span className="block mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">CC: {record.ccEmail}</span>}
                          {record.bccEmail && <span className="block text-[11px] text-gray-500 dark:text-gray-400">BCC: {record.bccEmail}</span>}
                        </td>
                        <td className="px-4 py-3.5"><span className="inline-flex max-w-[180px] truncate rounded-full bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">{brandName}</span></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <IosToggle checked={record.isActive} disabled={!permissions.canUpdate || updating} loading={updating} onCheckedChange={() => toggleStatus(record)} title={record.isActive ? 'Active' : 'Inactive'} aria-label={record.isActive ? 'Active' : 'Inactive'} />
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[48px]">{record.isActive ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90">
                          <div className="flex justify-center gap-1.5">
                            {permissions.canUpdate && <ActionIconButton icon={Edit} variant="edit" tooltip="Edit Template" onClick={() => { setEditingTemplate(record); setModalOpen(true); }} />}
                            {permissions.canDelete && <ActionIconButton icon={Trash2} variant="delete" tooltip="Delete Template" onClick={() => setDeleteTarget(record)} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && totalCount > 0 && (
              <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                  <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} Templates</span>
                  <div className="flex items-center gap-1.5">
                    <span>Rows:</span>
                    <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-gray-300 dark:border-white/10 bg-transparent px-2 py-1 text-gray-900 dark:text-white">
                      {PAGE_SIZES.map((size) => <option key={size} value={size} className="dark:bg-[#17132a]">{size}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="p-1 rounded-lg border border-gray-300 dark:border-white/10 disabled:opacity-40"><ChevronLeft size={16} /></button>
                  <span className="px-2 font-medium text-gray-700 dark:text-gray-300">Page {page} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" className="p-1 rounded-lg border border-gray-300 dark:border-white/10 disabled:opacity-40"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <StandaloneBrandTemplateModal
        open={modalOpen}
        template={editingTemplate}
        brands={brands}
        initialBrandId={selectedBrandId}
        canAdd={permissions.canAdd}
        canUpdate={permissions.canUpdate}
        onClose={() => {
          setModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={() => fetchTemplates(true)}
      />

      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Template"
        description="Are you sure you want to delete"
        itemName={deleteTarget?.templateName || deleteTarget?.subject || 'this template'}
        details={[{ label: 'Subject', value: deleteTarget?.subject || '-' }]}
        confirmText="Delete"
        loadingText="Deleting..."
        cancelText="Cancel"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default BrandTemplatePage;
