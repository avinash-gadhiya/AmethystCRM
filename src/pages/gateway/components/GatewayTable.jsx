import { CreditCard, KeyRound, Pencil, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { TableSkeletonRows } from '@/components/common/skeleton-loader';
import { formatDateTime, formatMoney, getGatewayType, getNormalizedStatus, statusVariant } from '../gatewayUtils';
import { GatewayBadge, GatewayButton, GatewayEmptyState } from './GatewayUI';

function RowActions({ name, onEdit, onDelete, permissions }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {permissions.canUpdate && (
        <GatewayButton variant="icon" onClick={onEdit} title={`Edit ${name}`} aria-label={`Edit ${name}`}>
          <Pencil size={15} />
        </GatewayButton>
      )}
      {permissions.canDelete && (
        <GatewayButton variant="danger-icon" onClick={onDelete} title={`Delete ${name}`} aria-label={`Delete ${name}`}>
          <Trash2 size={15} />
        </GatewayButton>
      )}
      {!permissions.canUpdate && !permissions.canDelete && <span className="text-slate-400">-</span>}
    </div>
  );
}

function Identity({ name, detail, icon: Icon = Server }) {
  return (
    <div className="flex items-center gap-3">
      <span className="gateway-row-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="gateway-cell-title">{name}</div>
        <div className="gateway-cell-detail">{detail}</div>
      </div>
    </div>
  );
}

export default function GatewayTable({
  section,
  columns,
  rows,
  loading,
  permissions,
  onEditGateway,
  onDeleteGateway,
  onEditMapping,
  onDeleteMapping,
  filtered,
  onReset,
  emptyAction
}) {
  if (!loading && !rows.length) {
    return <GatewayEmptyState section={section.label} filtered={filtered} onReset={onReset} action={emptyAction} />;
  }
  return (
    <div className="gateway-table-scroll" role="region" aria-label={`${section.label} table`} tabIndex={0}>
      <table className="gateway-table" aria-busy={loading}>
        <caption className="sr-only">{section.label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className={column === 'Actions' || column === 'Amount' ? 'text-right' : ''}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeletonRows rows={6} columns={columns.length} cellClassName="px-5 py-6" />
          ) : section.id === 'gateways' ? (
            rows.map((gateway) => (
              <tr key={gateway.gatewayId}>
                <td>
                  <Identity name={gateway.gatewayName || '-'} detail={`ID ${gateway.gatewayId}`} />
                </td>
                <td>{gateway.brandName || gateway.brandId || '-'}</td>
                <td>
                  <span className="gateway-cell-title">{getGatewayType(gateway.gatewayType)}</span>
                  <div className="mt-1.5">
                    <GatewayBadge tone={gateway.isSandbox ? 'warning' : 'info'}>
                      {gateway.isSandbox ? 'Sandbox' : 'Production'}
                    </GatewayBadge>
                  </div>
                </td>
                <td>
                  <div className="max-w-[260px] truncate text-xs" title={gateway.apiBaseUrl || ''}>
                    {gateway.apiBaseUrl || '-'}
                  </div>
                  <div
                    className={`mt-1.5 flex items-center gap-1.5 text-xs ${gateway.hasCredentials ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}
                  >
                    {gateway.hasCredentials ? <ShieldCheck size={13} /> : <KeyRound size={13} />}
                    {gateway.hasCredentials ? 'Configured' : 'Not configured'}
                  </div>
                </td>
                <td>
                  <GatewayBadge tone={gateway.isActive ? 'success' : 'secondary'}>{gateway.isActive ? 'Active' : 'Inactive'}</GatewayBadge>
                </td>
                <td>
                  <RowActions
                    name={gateway.gatewayName || 'gateway'}
                    onEdit={() => onEditGateway(gateway)}
                    onDelete={() => onDeleteGateway(gateway)}
                    permissions={permissions}
                  />
                </td>
              </tr>
            ))
          ) : section.id === 'paymentTypes' ? (
            rows.map((mapping, index) => (
              <tr key={mapping.gatewayPaymentTypeId || `${mapping.gatewayId}-${index}`}>
                <td>
                  <Identity name={mapping.gatewayName || `Gateway ${mapping.gatewayId}`} detail={`ID ${mapping.gatewayId}`} />
                </td>
                <td>{mapping.brandName || mapping.brandId || '-'}</td>
                <td>
                  <span className="gateway-payment-type">
                    {mapping.paymentTypeName ||
                      (Array.isArray(mapping.paymentTypeIds) ? mapping.paymentTypeIds.join(', ') : mapping.paymentTypeId) ||
                      '-'}
                  </span>
                </td>
                <td>
                  <GatewayBadge tone={mapping.isActive !== false ? 'success' : 'secondary'}>
                    {mapping.isActive !== false ? 'Active' : 'Inactive'}
                  </GatewayBadge>
                </td>
                <td>
                  <RowActions
                    name={mapping.gatewayName || 'mapping'}
                    onEdit={() => onEditMapping(mapping)}
                    onDelete={() => onDeleteMapping(mapping)}
                    permissions={permissions}
                  />
                </td>
              </tr>
            ))
          ) : section.id === 'transactions' ? (
            rows.map((transaction, index) => {
              const customerName =
                transaction.customerName || [transaction.customerFirstName, transaction.customerLastName].filter(Boolean).join(' ');
              const status = getNormalizedStatus(transaction);
              return (
                <tr key={transaction.gatewayTransactionId || index}>
                  <td>
                    <Identity
                      icon={CreditCard}
                      name={transaction.gatewayTransactionRef || '-'}
                      detail={`Order ${transaction.orderId || '-'}`}
                    />
                  </td>
                  <td>
                    <div className="gateway-cell-title">{transaction.gatewayName || `Gateway ${transaction.gatewayId}`}</div>
                    <div className="gateway-cell-detail">Brand {transaction.brandId || '-'}</div>
                  </td>
                  <td>{customerName || '-'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">
                    {transaction.cardLast4 ? `\u2022\u2022\u2022\u2022 ${transaction.cardLast4}` : '-'}
                  </td>
                  <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatMoney(transaction.amount, transaction.currency)}
                  </td>
                  <td>
                    <GatewayBadge tone={statusVariant(status)}>{status}</GatewayBadge>
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(transaction.transactionDateUtc)}</td>
                </tr>
              );
            })
          ) : (
            rows.map((log, index) => (
              <tr key={log.gatewaySyncLogId || index}>
                <td>
                  <Identity name={log.gatewayName || `Gateway ${log.gatewayId}`} detail={`Brand ${log.brandName || log.brandId || '-'}`} />
                </td>
                <td className="whitespace-nowrap text-xs">
                  <div>{formatDateTime(log.fromDateUtc)}</div>
                  <div className="gateway-cell-detail">to {formatDateTime(log.toDateUtc)}</div>
                </td>
                <td className="whitespace-nowrap text-xs">
                  <div>{formatDateTime(log.startedAtUtc)}</div>
                  <div className="gateway-cell-detail">Completed {formatDateTime(log.completedAtUtc)}</div>
                </td>
                <td>
                  <GatewayBadge tone={statusVariant(log.status)}>{log.status || 'Unknown'}</GatewayBadge>
                </td>
                <td>
                  <div className="gateway-cell-title">{Number(log.fetchedCount) || 0} fetched</div>
                  <div className="gateway-cell-detail whitespace-nowrap">
                    {Number(log.insertedCount) || 0} new / {Number(log.updatedCount) || 0} updated
                  </div>
                </td>
                <td>
                  <span className="block max-w-[280px] break-words text-xs text-rose-600 dark:text-rose-400">
                    {log.errorMessage || '-'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
