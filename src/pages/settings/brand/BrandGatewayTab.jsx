import brandService from '@/services/brandService';
import React from 'react';
import { CreditCard, Search, X, Pencil, Trash2, Layers, Lock, ShieldCheck } from 'lucide-react';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

const BrandGatewayTab = ({
  gatewayError,
  gateways,
  gatewayTotal,
  gatewaySearch,
  setGatewaySearch,
  setGatewayPage,
  fetchGateways,
  gatewaySortProp,
  setGatewaySortDesc,
  gatewaySortDesc,
  setGatewaySortProp,
  renderSortIndicator,
  gatewayLoading,
  gatewayPerms,
  pendingStatus,
  setEditingGateway,
  setGatewayModalOpen,
  gatewayPage,
  gatewayPageSize,
  setGatewayPageSize,
  GATEWAY_TYPE_NAMES,
  handleToggleGatewayActive,
  setSelectedGatewayForPaymentTypes,
  setPaymentTypeModalOpen,
  setDeleteConfig,
  setDeleteModalOpen
}) => (
  <div className="space-y-4">
    {gatewayError && (
      <div role="alert" className="p-3 text-red-600">
        {gatewayError}
      </div>
    )}
    {/* Toolbar */}
    <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="font-medium text-sm text-gray-700 dark:text-white">
          Showing {gateways.length} of {gatewayTotal} Configured Gateways
        </h3>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
            <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
            <input
              type="text"
              placeholder="Search gateways..."
              value={gatewaySearch}
              onChange={(e) => {
                setGatewaySearch(e.target.value);
                setGatewayPage(1);
              }}
              className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
            />
            {gatewaySearch && (
              <button
                type="button"
                onClick={() => {
                  setGatewaySearch('');
                  setGatewayPage(1);
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
              fetchGateways();
            }}
            className="shrink-0"
          />
        </div>
      </div>
    </div>

    {/* Gateways Table */}
    <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
              <th className="py-3.5 px-4 text-center w-14">#</th>
              <th
                onClick={() => {
                  if (gatewaySortProp === 'gatewayName') setGatewaySortDesc(!gatewaySortDesc);
                  else {
                    setGatewaySortProp('gatewayName');
                    setGatewaySortDesc(true);
                  }
                }}
                className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
              >
                Gateway Name {renderSortIndicator(gatewaySortProp, 'gatewayName', gatewaySortDesc)}
              </th>
              <th className="py-3.5 px-4 min-w-[150px]">Provider / Type</th>
              <th className="py-3.5 px-4 min-w-[130px]">Mode</th>
              <th className="py-3.5 px-4 min-w-[160px]">Credentials</th>
              <th className="py-3.5 px-4 min-w-[150px]">Last Sync</th>
              <th className="py-3.5 px-4 text-center w-28">Status</th>
              <th className="py-3.5 px-4 text-right min-w-[170px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
            {gatewayLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-gw-${i}`} className="animate-pulse">
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-36" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-5 w-10 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-28 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!gatewayLoading && !gatewayError && gateways.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                      <CreditCard size={28} className="opacity-80" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No payment gateways configured</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Connect Authorize.Net, NMI, or Nuvei merchant accounts for this brand.
                    </p>
                    {gatewayPerms.canAdd && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGateway(null);
                          setGatewayModalOpen(true);
                        }}
                        className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                      >
                        Add Payment Gateway
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!gatewayLoading &&
              gateways.map((gw, idx) => {
                const rowNum = (gatewayPage - 1) * gatewayPageSize + idx + 1;
                const providerName = GATEWAY_TYPE_NAMES[gw.gatewayType] || `Type ${gw.gatewayType}`;
                return (
                  <tr key={gw.gatewayId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">{rowNum}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{gw.gatewayName}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                          #{gw.gatewayId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                        {providerName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          gw.isSandbox
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                        }`}
                      >
                        {gw.isSandbox ? 'Sandbox' : 'Production'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {gw.hasCredentials ? (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck size={14} />
                          <span>Configured</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Lock size={14} />
                          <span>Missing</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                      {gw.lastSyncedAtUtc ? new Date(gw.lastSyncedAtUtc).toLocaleString() : <span className="italic">Never synced</span>}
                    </td>

                    {/* Status Toggle (iOS Toggle) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center justify-center scale-90">
                        <IosToggle
                          checked={Boolean(gw.isActive)}
                          onCheckedChange={() => handleToggleGatewayActive(gw)}
                          disabled={!gatewayPerms.canUpdate || pendingStatus.has(`gateway:${gw.gatewayId}`)}
                          title={gw.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Manage Payment Types */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGatewayForPaymentTypes(gw);
                            setPaymentTypeModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                          disabled={!gatewayPerms.canAdd && !gatewayPerms.canDelete}
                          title="Configure Assigned Payment Types"
                        >
                          <Layers size={15} />
                        </button>

                        {gatewayPerms.canUpdate && (
                          <ActionIconButton
                            icon={Pencil}
                            variant="edit"
                            tooltip="Edit Gateway"
                            onClick={() => {
                              setEditingGateway(gw);
                              setGatewayModalOpen(true);
                            }}
                          />
                        )}

                        {gatewayPerms.canDelete && (
                          <ActionIconButton
                            icon={Trash2}
                            variant="delete"
                            tooltip="Delete Gateway"
                            onClick={() => {
                              setDeleteConfig({
                                type: 'gateway',
                                id: gw.gatewayId,
                                name: gw.gatewayName
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

      {/* Gateway Pagination */}
      {!gatewayLoading && !gatewayError && gatewayTotal > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              Showing {(gatewayPage - 1) * gatewayPageSize + 1} to {Math.min(gatewayPage * gatewayPageSize, gatewayTotal)} of {gatewayTotal}
            </span>
            <label className="flex items-center gap-1">
              <span>Rows:</span>
              <select
                aria-label="Rows per page"
                value={gatewayPageSize}
                onChange={(e) => {
                  setGatewayPageSize(Number(e.target.value));
                  setGatewayPage(1);
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
            currentPage={gatewayPage}
            totalPages={Math.max(1, Math.ceil(gatewayTotal / gatewayPageSize))}
            onPageChange={(p) => setGatewayPage(p)}
            disabled={gatewayLoading}
          />
        </div>
      )}
    </div>
  </div>
);

export default BrandGatewayTab;
