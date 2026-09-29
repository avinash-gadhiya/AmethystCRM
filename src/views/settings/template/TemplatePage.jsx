import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';

import templateService from '@/services/templateService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveTemplatePermissions } from '@/utils/templatePermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';

import TemplateModal from '@/components/template/TemplateModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TemplatePage = () => {
  // Fail-closed permission resolution
  const perms = useMemo(() => resolveTemplatePermissions('template'), []);

  // Shared Reference Data: Email Types and Configurable Placeholders
  const [emailTypes, setEmailTypes] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);

  const emailTypeMap = useMemo(() => {
    const map = new Map();
    emailTypes.forEach((et) => {
      map.set(Number(et.id), et.name);
    });
    return map;
  }, [emailTypes]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([templateService.getEmailTypes(), templateService.getPlaceholders()])
      .then(([types, phs]) => {
        if (!isMounted) return;
        setEmailTypes(types);
        setPlaceholders(phs);
      })
      .catch((err) => {
        console.warn('Failed to load email types or placeholders:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Template List State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('templateId');
  const [isDescending, setIsDescending] = useState(true);

  // Status updating tracking (Set of templateIds)
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal States
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

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

  // Fetch Templates
  const abortControllerRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    if (!perms.canView) {
      setTemplates([]);
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
      const res = await templateService.getTemplates(
        {
          Text: debouncedSearch,
          PageNumber: currentPage,
          PageSize: pageSize,
          SortProperty: sortProperty,
          IsDescending: isDescending
        },
        controller.signal
      );

      setTemplates(res.data);
      setTotalCount(res.totalCount);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      const msg = getApiErrorMessage(err, 'Failed to fetch templates.');
      toast.error(msg);
      setTemplates([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [perms.canView, debouncedSearch, currentPage, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchTemplates();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTemplates]);

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
    if (!perms.canUpdate || updatingStatusIds.has(item.templateId)) return;

    const previousStatus = item.isActive;
    const nextStatus = !previousStatus;

    // Optimistic UI update
    setTemplates((prev) =>
      prev.map((t) => (t.templateId === item.templateId ? { ...t, isActive: nextStatus } : t))
    );

    setUpdatingStatusIds((prev) => new Set(prev).add(item.templateId));

    try {
      await templateService.updateTemplate({
        templateId: item.templateId,
        templateName: item.templateName,
        emailTypeId: item.emailTypeId,
        body: item.body,
        isActive: nextStatus,
        createdById: item.createdById,
        createdDate: item.createdDate
      });

      toast.success('Template status updated');
    } catch (err) {
      // Revert optimistic update
      setTemplates((prev) =>
        prev.map((t) => (t.templateId === item.templateId ? { ...t, isActive: previousStatus } : t))
      );
      const msg = getApiErrorMessage(err, 'Failed to update template status.');
      toast.error(msg);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(item.templateId);
        return next;
      });
    }
  };

  // Delete Handler with page clamping
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !perms.canDelete) return;

    try {
      setDeleting(true);
      await templateService.deleteTemplate(deleteTarget.templateId);
      toast.success('Template deleted successfully');
      setDeleteModalOpen(false);
      setDeleteTarget(null);

      // Clamp current page if deleting final item on last page
      if (templates.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        fetchTemplates();
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete template.');
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
              Template
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage templates from Template API
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {perms.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingTemplate(null);
              setTemplateModalOpen(true);
            }}
            className="flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>Add Template</span>
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
              You don't have permission to view templates.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Frosted / Glass Responsive Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                {templates.length} of {totalCount} Templates
              </h3>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Search Box */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Template"
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
                <TableRefreshButton onClick={fetchTemplates} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    {/* 1. # */}
                    <th
                      onClick={() => handleSort('templateId')}
                      className="py-3.5 px-4 text-center w-16 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      # {renderSortIndicator('templateId')}
                    </th>

                    {/* 2. Template Name */}
                    <th
                      onClick={() => handleSort('templateName')}
                      className="py-3.5 px-4 min-w-[220px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Template Name {renderSortIndicator('templateName')}
                    </th>

                    {/* 3. Email Type */}
                    <th
                      onClick={() => handleSort('emailTypeId')}
                      className="py-3.5 px-4 min-w-[180px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Email Type {renderSortIndicator('emailTypeId')}
                    </th>

                    {/* 4. Status */}
                    <th className="py-3.5 px-4 text-center w-28 select-none">
                      Status
                    </th>

                    {/* 5. Action */}
                    <th className="py-3.5 px-4 text-center w-24 sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {/* Loading State */}
                  {loading && (
                    <>
                      {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                        <tr key={`skel-t-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-44" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-14 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center sticky right-0 bg-white dark:bg-[#17132a]">
                            <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {!loading && templates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <FileText size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No templates found.
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            {searchTerm
                              ? 'Try adjusting your search criteria.'
                              : 'Get started by creating your first system email template.'}
                          </p>
                          {perms.canAdd && !searchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(null);
                                setTemplateModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Template
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    templates.map((item, index) => {
                      const rowNumber = (currentPage - 1) * pageSize + index + 1;
                      const isUpdating = updatingStatusIds.has(item.templateId);
                      const resolvedTypeName =
                        emailTypeMap.get(Number(item.emailTypeId)) || (item.emailTypeId ? `Type #${item.emailTypeId}` : 'General / Default');

                      return (
                        <tr
                          key={item.templateId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* 1. # */}
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>

                          {/* 2. Template Name */}
                          <td className="py-3.5 px-4 font-semibold text-purple-700 dark:text-purple-300">
                            <span className="truncate block max-w-md" title={item.templateName}>
                              {item.templateName || 'N/A'}
                            </span>
                          </td>

                          {/* 3. Email Type */}
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 font-medium">
                              {resolvedTypeName}
                            </span>
                          </td>

                          {/* 4. Status: Reusable iOS-style toggle */}
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

                          {/* 5. Action: Sticky right column */}
                          <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Violet edit icon button: Edit Template */}
                              {perms.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Template"
                                  onClick={() => {
                                    setEditingTemplate(item);
                                    setTemplateModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Red delete icon button: Delete Template */}
                              {perms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Template"
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
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount} Templates
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

                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-2 font-medium text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Template Form Modal */}
      <TemplateModal
        open={templateModalOpen}
        template={editingTemplate}
        emailTypes={emailTypes}
        placeholders={placeholders}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={fetchTemplates}
        canAdd={perms.canAdd}
        canUpdate={perms.canUpdate}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Template"
        targetName={deleteTarget?.templateName || 'Template'}
        targetId={deleteTarget?.templateId ? `#${deleteTarget.templateId}` : ''}
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

export default TemplatePage;
