import brandService from '@/services/brandService';
import React from 'react';
import { Mail, FileText, Search, X, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import IosToggle from '@/components/common/IosToggle';

const BrandTemplatesTab = ({
  templateError,
  templates,
  templateTotal,
  templateSearch,
  setTemplateSearch,
  setTemplatePage,
  fetchTemplates,
  templateSortProp,
  setTemplateSortDesc,
  templateSortDesc,
  setTemplateSortProp,
  renderSortIndicator,
  templateLoading,
  templatePerms,
  pendingStatus,
  setEditingTemplate,
  setTemplateModalOpen,
  templatePage,
  templatePageSize,
  setTemplatePageSize,
  handleToggleTemplateActive,
  setDeleteConfig,
  setDeleteModalOpen
}) => (
  <div className="space-y-4">
    {templateError && (
      <div role="alert" className="p-3 text-red-600">
        {templateError}
      </div>
    )}
    {/* Toolbar */}
    <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="font-medium text-sm text-gray-700 dark:text-white">
          Showing {templates.length} of {templateTotal} Email Templates
        </h3>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
            <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
            <input
              type="text"
              placeholder="Search templates by name, subject..."
              value={templateSearch}
              onChange={(e) => {
                setTemplateSearch(e.target.value);
                setTemplatePage(1);
              }}
              className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
            />
            {templateSearch && (
              <button
                type="button"
                onClick={() => {
                  setTemplateSearch('');
                  setTemplatePage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                aria-label="Clear search"
              >
                <X size={14} className="text-gray-500 dark:text-gray-300" />
              </button>
            )}
          </div>

          <TableRefreshButton
            onClick={() => {
              brandService.clearAllCache();
              fetchTemplates();
            }}
            className="shrink-0"
          />
        </div>
      </div>
    </div>

    {/* Templates Table */}
    <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
              <th className="py-3.5 px-4 text-center w-14">#</th>
              <th
                onClick={() => {
                  if (templateSortProp === 'templateName') setTemplateSortDesc(!templateSortDesc);
                  else {
                    setTemplateSortProp('templateName');
                    setTemplateSortDesc(true);
                  }
                }}
                className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
              >
                Template Name {renderSortIndicator(templateSortProp, 'templateName', templateSortDesc)}
              </th>
              <th className="py-3.5 px-4 min-w-[180px]">Subject</th>
              <th className="py-3.5 px-4 min-w-[180px]">From Sender Email</th>
              <th className="py-3.5 px-4 min-w-[100px]">Master ID</th>
              <th className="py-3.5 px-4 text-center w-28">Status</th>
              <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
            {templateLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-tpl-${i}`} className="animate-pulse">
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-5 w-10 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!templateLoading && !templateError && templates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                      <FileText size={28} className="opacity-80" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No brand templates configured</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Associate system templates with this brand and specify sender emails.
                    </p>
                    {templatePerms.canAdd && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplate(null);
                          setTemplateModalOpen(true);
                        }}
                        className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                      >
                        Add Email Template
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!templateLoading &&
              templates.map((tpl, idx) => {
                const rowNum = (templatePage - 1) * templatePageSize + idx + 1;
                return (
                  <tr key={tpl.brandEmailTemplateId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">{rowNum}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{tpl.templateName}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                          #{tpl.brandEmailTemplateId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                      {tpl.subject || <span className="text-gray-400 italic">No subject</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                      {tpl.fromEmail ? (
                        <div className="flex items-center gap-1">
                          <Mail size={12} className="text-gray-400 shrink-0" />
                          <span>{tpl.fromEmail}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">ID #{tpl.fromEmailId}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-gray-500">#{tpl.templateId}</td>

                    {/* Status Toggle (iOS Toggle) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center justify-center scale-90">
                        <IosToggle
                          checked={Boolean(tpl.isActive)}
                          onCheckedChange={() => handleToggleTemplateActive(tpl)}
                          disabled={!templatePerms.canUpdate || pendingStatus.has(`template:${tpl.brandEmailTemplateId}`)}
                          title={tpl.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {templatePerms.canUpdate && (
                          <ActionIconButton
                            icon={Pencil}
                            variant="edit"
                            tooltip="Edit Template"
                            onClick={() => {
                              setEditingTemplate(tpl);
                              setTemplateModalOpen(true);
                            }}
                          />
                        )}
                        {templatePerms.canDelete && (
                          <ActionIconButton
                            icon={Trash2}
                            variant="delete"
                            tooltip="Delete Template"
                            onClick={() => {
                              setDeleteConfig({
                                type: 'template',
                                id: tpl.brandEmailTemplateId,
                                name: tpl.templateName
                              });
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

      {/* Template Pagination */}
      {!templateLoading && !templateError && templateTotal > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing {(templatePage - 1) * templatePageSize + 1} to {Math.min(templatePage * templatePageSize, templateTotal)} of{' '}
            {templateTotal}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={templatePage <= 1}
              onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <label>
              Rows{' '}
              <select
                aria-label="Rows per page"
                value={templatePageSize}
                onChange={(e) => {
                  setTemplatePageSize(Number(e.target.value));
                  setTemplatePage(1);
                }}
                className="rounded border dark:bg-[#17132a]"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="px-2 font-medium">
              Page {templatePage} of {Math.max(1, Math.ceil(templateTotal / templatePageSize))}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={templatePage * templatePageSize >= templateTotal}
              onClick={() => setTemplatePage((p) => p + 1)}
              className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default BrandTemplatesTab;
