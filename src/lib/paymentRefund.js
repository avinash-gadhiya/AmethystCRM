export const isRefundPayment = (payment) => /refund/i.test(String(payment?.saleType || ''));

export const buildRefundPayment = ({ payment, original, availableAmount, draft, userId, saleType = 'Refund', now = new Date() }) => {
  const editing = isRefundPayment(payment);
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || Math.round(amount * 100) <= 0) throw new Error('Refund amount must be greater than 0.');
  if (Math.round(amount * 100) > Math.round(availableAmount * 100))
    throw new Error(`Refund amount cannot exceed the remaining ${availableAmount.toFixed(2)}.`);
  const date = String(draft.paymentDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Refund date is required.');
  const paymentDate = new Date(`${date}T00:00:00`);
  if (
    Number.isNaN(paymentDate.getTime()) ||
    paymentDate.getFullYear() !== Number(date.slice(0, 4)) ||
    paymentDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
    paymentDate.getDate() !== Number(date.slice(8, 10))
  )
    throw new Error('Enter a valid refund date.');
  const flags = ['isChargeBack', 'isRetrieval', 'isAlert'].filter((key) => draft[key] === true);
  if (flags.length > 1) throw new Error('Select only one refund flag.');
  return {
    paymentId: editing ? Number(payment.paymentId) : 0,
    refundPaymentId: Number(original.paymentId),
    orderId: Number(original.orderId),
    paymentType: original.paymentType || payment.paymentType || '',
    cardType: original.cardType || '',
    cardNumber: original.cardNumber || '',
    cardExpiryDate: original.cardExpiryDate || '',
    cvv: '',
    nameOnCard: original.nameOnCard || '',
    transactionId: String(draft.transactionId || '').trim(),
    authCode: String(draft.authCode || '').trim(),
    brandId: Number(original.brandId) || null,
    brandName: original.brandName || '',
    gatewayId: Number(original.gatewayId) || null,
    gatewayName: original.gatewayName || '',
    amount: Math.round(amount * 100) / 100,
    saleType: /refund/i.test(saleType) ? saleType : 'Refund',
    paymentDate: paymentDate.toISOString(),
    createdAt: editing ? payment.createdAt || now.toISOString() : now.toISOString(),
    createdBy: editing ? Number(payment.createdBy) || userId || null : userId || null,
    updatedAt: now.toISOString(),
    updatedBy: userId || null,
    isVoid: false,
    isDeleted: false,
    isChargeBack: !!draft.isChargeBack,
    isRetrieval: !!draft.isRetrieval,
    isAlert: !!draft.isAlert,
    isChequeCleared: !!original.isChequeCleared,
    chequeRoutingNo: original.chequeRoutingNo ?? null,
    chequeNo: original.chequeNo ?? null,
    chequeTrackingNo: original.chequeTrackingNo || '',
    zelleId: original.zelleId || '',
    entIp: editing ? payment.entIp || null : null,
    udpIp: null
  };
};
