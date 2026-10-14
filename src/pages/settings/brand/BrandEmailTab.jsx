import brandService from '@/services/brandService';
import React from 'react';
import { Mail, Search, X, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

const BrandEmailTab = ({
  emailError,
  emails,
  emailTotal,
  emailSearch,
  setEmailSearch,
  setEmailPage,
  fetchEmails,
  emailSortProp,
  setEmailSortDesc,
  emailSortDesc,
  setEmailSortProp,
  renderSortIndicator,
  emailLoading,
  emailPerms,
  setEditingEmail,
  setEmailModalOpen,
  emailPage,
  emailPageSize,
  setEmailPageSize,
  visiblePasswords,
  togglePasswordVisibility,
  handleToggleEmailActive,
  updatingEmailIds,
  setDeleteConfig,
  setDeleteModalOpen
}) => (
  <div className="space-y-4">
    {emailError && (
      <div role="alert" className="p-3 text-red-600">
        {emailError}
      </div>
    )}
    {/* Toolbar */}
    <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="font-medium text-sm text-gray-700 dark:text-white">
          Showing {emails.length} of {emailTotal} Outbound Brand Emails
        </h3>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
            <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
            <input
              type="text"
              placeholder="Search by email, username, host..."
              value={emailSearch}
              onChange={(e) => {
                setEmailSearch(e.target.value);
                setEmailPage(1);
              }}
              className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
            />
            {emailSearch && (
              <button
                type="button"
                onClick={() => {
                  setEmailSearch('');
                  setEmailPage(1);
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
              fetchEmails();
            }}
            className="shrink-0"
          />
        </div>
      </div>
    </div>

    {/* Email Table */}
    <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
              <th className="py-3.5 px-4 text-center w-14">#</th>
              <th
                onClick={() => {
                  if (emailSortProp === 'email') setEmailSortDesc(!emailSortDesc);
                  else {
                    setEmailSortProp('email');
                    setEmailSortDesc(true);
                  }
                }}
                className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
              >
                Email Address {renderSortIndicator(emailSortProp, 'email', emailSortDesc)}
              </th>
              <th className="py-3.5 px-4 min-w-[150px]">Username</th>
              <th className="py-3.5 px-4 min-w-[220px]">SMTP Server & Port</th>
              <th className="py-3.5 px-4 min-w-[120px]">Credential</th>
              <th className="py-3.5 px-4 text-center w-28">Status</th>
              <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
            {emailLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-email-${i}`} className="animate-pulse">
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
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

            {!emailLoading && !emailError && emails.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                      <Mail size={28} className="opacity-80" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No brand emails configured</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Add SMTP credentials for this brand to enable outgoing notifications and e-sign communications.
                    </p>
                    {emailPerms.canAdd && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmail(null);
                          setEmailModalOpen(true);
                        }}
                        className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                      >
                        Add Email Account
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!emailLoading &&
              emails.map((eItem, idx) => {
                const rowNum = (emailPage - 1) * emailPageSize + idx + 1;
                const isPwdVisible = visiblePasswords[eItem.brandEmailId];
                return (
                  <tr key={eItem.brandEmailId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">{rowNum}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{eItem.email}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                          #{eItem.brandEmailId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                      {eItem.userName || <span className="text-gray-400 italic">None</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <span>
                          {eItem.host}:{eItem.port}
                        </span>
                        {eItem.sslEnable && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                            SSL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span>{isPwdVisible ? eItem.password || '(not set)' : '••••••••'}</span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(eItem.brandEmailId)}
                          className="hidden"
                          title={isPwdVisible ? 'Hide password' : 'Show password'}
                        >
                          {isPwdVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>

                    {/* Status Toggle (iOS Toggle) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center justify-center scale-90">
                        <IosToggle
                          checked={Boolean(eItem.isActive)}
                          onCheckedChange={() => handleToggleEmailActive(eItem)}
                          disabled={!emailPerms.canUpdate || updatingEmailIds.has(eItem.brandEmailId)}
                          loading={updatingEmailIds.has(eItem.brandEmailId)}
                          title={eItem.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {emailPerms.canUpdate && (
                          <ActionIconButton
                            icon={Pencil}
                            variant="edit"
                            tooltip="Edit Email"
                            onClick={() => {
                              setEditingEmail(eItem);
                              setEmailModalOpen(true);
                            }}
                          />
                        )}
                        {emailPerms.canDelete && (
                          <ActionIconButton
                            icon={Trash2}
                            variant="delete"
                            tooltip="Delete Email"
                            onClick={() => {
                              setDeleteConfig({
                                type: 'email',
                                id: eItem.brandEmailId,
                                name: eItem.email
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

      {/* Email Pagination */}
      {!emailLoading && !emailError && emailTotal > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              Showing {(emailPage - 1) * emailPageSize + 1} to {Math.min(emailPage * emailPageSize, emailTotal)} of {emailTotal}
            </span>
            <label className="flex items-center gap-1">
              <span>Rows:</span>
              <select
                aria-label="Rows per page"
                value={emailPageSize}
                onChange={(e) => {
                  setEmailPageSize(Number(e.target.value));
                  setEmailPage(1);
                }}
                className="rounded border border-gray-300 dark:border-white/10 dark:bg-[#17132a] px-2 py-0.5"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <AnchorPagination
            currentPage={emailPage}
            totalPages={Math.max(1, Math.ceil(emailTotal / emailPageSize))}
            onPageChange={(p) => setEmailPage(p)}
            disabled={emailLoading}
          />
        </div>
      )}
    </div>
  </div>
);

export default BrandEmailTab;
