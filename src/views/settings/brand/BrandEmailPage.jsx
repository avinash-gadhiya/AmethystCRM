import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Mail, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandPermissions } from '@/utils/brandPermissions';
import ActionIconButton from '@/components/common/ActionIconButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import BrandEmailModal from '@/components/brand/BrandEmailModal';

const PAGE_SIZES = [10, 25, 50, 100];

const BrandEmailPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useMemo(() => resolveBrandPermissions(location.pathname), [location.pathname]);
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
  const [sortProperty, setSortProperty] = useState('brandEmailId');
  const [isDescending, setIsDescending] = useState(true);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [selectedBrandId]);

  useEffect(() => {
    if (!(permissions.canView || permissions.canAdd || permissions.canUpdate)) {
      setBrands([]);
      return undefined;
    }
    let active = true;
    setBrandsLoading(true);
    brandService
      .getBrands({ PageNumber: 1, PageSize: 500, SortProperty: 'brandName', IsDescending: false })
      .then((response) => {
        if (!active) return;
        setBrands((response.data || []).map((item) => ({ id: item.brandId, name: item.brandName })));
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

  const fetchEmails = useCallback(async (forceFresh = false) => {
    if (!permissions.canView) {
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const response = await brandService.getBrandEmails(
        {
          Text: debouncedSearch,
          PageNumber: page,
          PageSize: pageSize,
          SortProperty: sortProperty,
          IsDescending: isDescending,
          ...(selectedBrandId ? { BrandId: selectedBrandId } : {})
        },
        undefined,
        forceFresh
      );
      if (requestId !== latestRequestRef.current) return;
      const data = (response.data || []).filter(
        (item) => !selectedBrandId || Number(item.brandId) === selectedBrandId
      );
      setRows(data);
      setTotalCount(Number(response.totalCount) || 0);
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      setRows([]);
      setTotalCount(0);
      toast.error(getApiErrorMessage(error, 'Failed to fetch brand emails.'));
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [debouncedSearch, isDescending, page, pageSize, permissions.canView, selectedBrandId, sortProperty]);

  useEffect(() => {
    fetchEmails();
    return () => {
      latestRequestRef.current += 1;
    };
  }, [fetchEmails]);

  const setBrandFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('brandId', String(value));
    else next.delete('brandId');
    next.set('tab', 'email');
    setSearchParams(next);
    setPage(1);
  };

  const handleSort = (property) => {
    if (sortProperty === property) setIsDescending((value) => !value);
    else {
      setSortProperty(property);
      setIsDescending(false);
    }
    setPage(1);
  };

  const sortIcon = (property) => {
    if (sortProperty !== property) return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />;
    return isDescending ? <ArrowDown size={12} className="inline ml-1 text-purple-600" /> : <ArrowUp size={12} className="inline ml-1 text-purple-600" />;
  };

  const toggleStatus = async (record) => {
    if (!permissions.canUpdate || updatingIds.has(record.brandEmailId)) return;
    const nextStatus = !record.isActive;
    setRows((current) => current.map((item) => item.brandEmailId === record.brandEmailId ? { ...item, isActive: nextStatus } : item));
    setUpdatingIds((current) => new Set(current).add(record.brandEmailId));
    try {
      await brandService.updateBrandEmail({ ...record, isActive: nextStatus });
      toast.success('Brand email status updated');
      await fetchEmails(true);
    } catch (error) {
      setRows((current) => current.map((item) => item.brandEmailId === record.brandEmailId ? { ...item, isActive: record.isActive } : item));
      toast.error(getApiErrorMessage(error, 'Failed to update brand email status.'));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(record.brandEmailId);
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !permissions.canDelete) return;
    setDeleting(true);
    try {
      await brandService.deleteBrandEmail(deleteTarget.brandEmailId);
      toast.success('Brand email deleted successfully');
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setPage((value) => Math.max(1, value - 1));
      else await fetchEmails(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete brand email.'));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const selectedBrand = brands.find((item) => item.id === selectedBrandId);

  return (
    <div className="w-full space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30"><Mail size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Emails</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{selectedBrand ? `SMTP senders for ${selectedBrand.name}` : 'Manage SMTP sender configurations across brands'}</p>
          </div>
        </div>
        {permissions.canAdd && <LiquidGlassButton onClick={() => { setEditingRecord(null); setModalOpen(true); }} className="flex items-center justify-center gap-2 text-sm"><Plus size={16} /> Add Brand Email</LiquidGlassButton>}
      </div>

      {!permissions.canView ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] p-12 text-center">
          <ShieldAlert size={32} className="mx-auto text-amber-500 mb-3" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view Brand Emails.</p>
        </div>
      ) : <>
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#17132a]/90 backdrop-blur p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-700 dark:text-gray-200">{rows.length} of {totalCount} results</span><div className="sm:hidden"><TableRefreshButton onClick={() => fetchEmails(true)} /></div></div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <select value={selectedBrandId || ''} onChange={(e) => setBrandFilter(Number(e.target.value || 0))} disabled={brandsLoading} aria-label="Filter by brand" className="w-full sm:w-48 px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500"><option value="">All Brands</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <div className="relative flex items-center w-full sm:w-64 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] focus-within:border-purple-500">
                <Search size={16} className="ml-3 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Brand Email" className="w-full px-2 py-2 pr-8 bg-transparent text-sm text-gray-900 dark:text-white outline-none" />
                {search && <button type="button" onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} aria-label="Clear search" className="absolute right-2 text-gray-400"><X size={14} /></button>}
              </div>
              <div className="hidden sm:block"><TableRefreshButton onClick={() => fetchEmails(true)} /></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-50/90 dark:bg-[#1d1733] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                <tr>{[['brandEmailId', '#'], ['email', 'Email'], ['userName', 'User Name'], ['host', 'Host'], ['port', 'Port'], ['brandName', 'Brand']].map(([property, label]) => <th key={property} onClick={() => handleSort(property)} className="px-4 py-3.5 cursor-pointer select-none hover:text-purple-600">{label}{sortIcon(property)}</th>)}<th className="px-4 py-3.5 text-center">SSL</th><th className="px-4 py-3.5 text-center">Status</th><th className="px-4 py-3.5 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading && Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => <tr key={index} className="animate-pulse">{Array.from({ length: 9 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-gray-200 dark:bg-white/10" /></td>)}</tr>)}
                {!loading && !rows.length && <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-500 dark:text-gray-400">No brand emails found. Try adjusting your search criteria.</td></tr>}
                {!loading && rows.map((record, index) => {
                  const updating = updatingIds.has(record.brandEmailId);
                  return <tr key={record.brandEmailId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10">
                    <td className="px-4 py-3.5 text-xs text-gray-400 font-mono">{(page - 1) * pageSize + index + 1}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-white">{record.email || '-'}</td><td className="px-4 py-3.5">{record.userName || '-'}</td><td className="px-4 py-3.5 font-mono text-xs">{record.host || '-'}</td><td className="px-4 py-3.5 font-mono">{record.port || '-'}</td><td className="px-4 py-3.5">{record.brandName || brands.find((item) => item.id === record.brandId)?.name || '-'}</td>
                    <td className="px-4 py-3.5 text-center"><span className={record.sslEnable ? 'text-emerald-600' : 'text-gray-400'}>{record.sslEnable ? 'Enabled' : 'Disabled'}</span></td>
                    <td className="px-4 py-3.5"><div className="flex items-center justify-center gap-2"><IosToggle checked={record.isActive} disabled={!permissions.canUpdate || updating} loading={updating} onCheckedChange={() => toggleStatus(record)} title={record.isActive ? 'Active' : 'Inactive'} /><span className="text-xs font-semibold min-w-[45px]">{record.isActive ? 'Active' : 'Inactive'}</span></div></td>
                    <td className="px-4 py-3.5"><div className="flex justify-center gap-1.5">{permissions.canUpdate && <ActionIconButton icon={Edit} variant="edit" tooltip="Edit Brand Email" onClick={() => { setEditingRecord(record); setModalOpen(true); }} />}{permissions.canDelete && <ActionIconButton icon={Trash2} variant="delete" tooltip="Delete Brand Email" onClick={() => setDeleteTarget(record)} />}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!loading && totalCount > 0 && <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400"><div className="flex items-center gap-3"><span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-gray-300 dark:border-white/10 bg-transparent px-2 py-1">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></div><div className="flex items-center gap-1 self-end sm:self-auto"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page" className="p-1 rounded border disabled:opacity-40"><ChevronLeft size={16} /></button><span className="px-2">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page" className="p-1 rounded border disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
        </div>
      </>}

      <BrandEmailModal open={modalOpen} brands={brands} initialBrandId={selectedBrandId} emailRecord={editingRecord} canAdd={permissions.canAdd} canUpdate={permissions.canUpdate} onClose={() => { setModalOpen(false); setEditingRecord(null); }} onSuccess={() => fetchEmails(true)} />
      <DeleteConfirmModal open={Boolean(deleteTarget)} title="Delete Brand Email" description="Are you sure you want to delete" itemName={deleteTarget?.email || 'this brand email'} details={[{ label: 'Email address', value: deleteTarget?.email || '-' }, { label: 'Brand', value: deleteTarget?.brandName || brands.find((item) => item.id === deleteTarget?.brandId)?.name || '-' }]} loading={deleting} confirmText="Delete" cancelText="Cancel" loadingText="Deleting..." onCancel={() => { if (!deleting) setDeleteTarget(null); }} onConfirm={confirmDelete} />
    </div>
  );
};

export default BrandEmailPage;
