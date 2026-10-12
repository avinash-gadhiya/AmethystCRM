import PropTypes from 'prop-types';

const TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
  red: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
  gray: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  purple: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300'
};

export const getPaymentStatus = (record) => {
  if (record?.isChargeBack) return 'Chargeback';
  if (record?.isRetrieval) return 'Retrieval';
  if (record?.isAlert) return 'Review';
  if (record?.isVoid) return 'Void';
  return String(record?.paymentStatus || record?.orderStatus || record?.saleType || record?.status || 'Pending');
};

const toneFor = (status) => {
  const value = String(status || '').toLowerCase();
  if (/refund|chargeback|fail|declin|error/.test(value)) return 'red';
  if (/void|cancel/.test(value)) return 'gray';
  if (/retrieval/.test(value)) return 'purple';
  if (/pending|process|alert|review/.test(value)) return 'amber';
  if (/sale|success|paid|complete|cleared|approved/.test(value)) return 'green';
  return 'gray';
};

export default function PaymentStatusBadge({ status, record }) {
  const label = status || getPaymentStatus(record);
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONES[toneFor(label)]}`}>
      {label || '-'}
    </span>
  );
}

PaymentStatusBadge.propTypes = {
  status: PropTypes.string,
  record: PropTypes.object
};
