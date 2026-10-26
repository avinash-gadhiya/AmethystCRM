export const paymentTypeFromTab = (tab) =>
  ({
    card: 'Card',
    bank: 'Bank',
    cheque: 'Cheque',
    zelle: 'Zelle',
    paypal: 'PayPal'
  })[tab] || 'Card';

export const isCardPayment = (paymentType) => /card|credit|debit/i.test(String(paymentType || ''));

// Used when saving as well as switching tabs, so old non-card records cannot
// carry a gateway into a new payment or an edit.
export const normalizePaymentGateway = (payment) => {
  if (!payment || !payment.paymentType || isCardPayment(payment.paymentType)) return payment;
  return { ...payment, gatewayId: null, gatewayName: '' };
};

export const getOrderGatewayName = (order) => {
  const cardPayments = (Array.isArray(order.payments) ? order.payments : []).filter((payment) => isCardPayment(payment.paymentType));
  const names = [...new Set(cardPayments.map((payment) => payment.gatewayName).filter(Boolean))];
  if (names.length) return names.join(', ');
  if (
    isCardPayment(order.paymentType) ||
    cardPayments.some((payment) => Number(payment.gatewayId) > 0 && Number(payment.gatewayId) === Number(order.gatewayId))
  )
    return order.gatewayName || '';
  return '';
};

export const changePaymentMethod = (payment, tab) => {
  const paymentType = paymentTypeFromTab(tab);
  const next =
    payment.paymentType === paymentType
      ? payment
      : {
          ...payment,
          paymentType,
          cardType: '',
          cardNumber: '',
          cardExpiryDate: '',
          cvv: '',
          nameOnCard: '',
          authCode: '',
          transactionId: '',
          chequeRoutingNo: 0,
          chequeNo: 0,
          chequeTrackingNo: '',
          isChequeCleared: false,
          zelleId: ''
        };
  return isCardPayment(paymentType) ? next : { ...next, gatewayId: 0, gatewayName: '' };
};
