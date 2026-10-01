import React from 'react';
import { Pencil, Trash2, ExternalLink, Building2, Mail, Phone, FileCheck2 } from 'lucide-react';
import ActionIconButton from '@/components/common/ActionIconButton';
import IosToggle from '@/components/common/IosToggle';

const BrandTable = ({
  handleToggleSort,
  renderSortIcon,
  loading,
  pageSize,
  loadError,
  brands,
  searchText,
  permissions,
  setEditingBrand,
  setEditorModalOpen,
  pageNumber,
  handleOpenDetails,
  handleToggleActive,
  pendingIds,
  handleOpenEmail,
  setDeleteTarget,
  setDeleteModalOpen
}) => (
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
          <th className="py-3.5 px-4 min-w-[220px]">Contact Information</th>
          <th className="py-3.5 px-4 min-w-[140px]">Doc Signing</th>
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
        {!loading && !loadError && brands.length === 0 && (
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
              <tr key={brand.brandId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group">
                {/* Row Number */}
                <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">{rowNumber}</td>

                {/* Logo Preview */}
                <td className="py-3.5 px-4 text-center">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden mx-auto shadow-2xs">
                    {brand.logoUrl ? (
                      <img
                        key={brand.logoUrl}
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
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{brand.brandDisplayName}</span>
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
                    {!brand.supportEmail && !brand.tollfree && <span className="text-gray-400 italic">No contact info</span>}
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
                      disabled={!permissions.canUpdate || pendingIds.has(brand.brandId)}
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
);

export default BrandTable;
