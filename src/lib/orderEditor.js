const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), normalizeFields(item)])
  );
};

export const normalizeOrderForEditor = (payload) => {
  const normalized = normalizeFields(payload);
  const order = normalized?.data ?? normalized;
  if (!order || !Number(order.orderId)) throw new Error('The saved order could not be loaded.');
  const items = Array.isArray(order.orderItems) ? order.orderItems : Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(order.subtotal) || items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  return {
    order,
    customer: {
      customerId: Number(order.customerId) || 0,
      name: order.customerName || '',
      customerName: order.customerName || '',
      ...(order.customer || {})
    },
    items: items
      .filter((item) => !item.isDeleted)
      .map((item, index) => ({
        ...item,
        id: `saved-${item.orderItemId || index}`,
        orderItemId: Number(item.orderItemId) || 0,
        productId: Number(item.productId) || 0,
        name: item.productName || item.name || '',
        price: Number(item.unitPrice ?? item.price) || 0,
        quantity: Number(item.quantity) || 1,
        subscriptionMonths: Number(item.subscriptionMonths) || 0,
        isCustom: true,
        imageUrl: item.imageUrl || ''
      })),
    subscriptionMonths: Math.max(0, ...items.map((item) => Number(item.subscriptionMonths) || 0)),
    discountPercent: /percent|%/i.test(order.discountType || '') && subtotal > 0 ? (Number(order.discountAmount || 0) / subtotal) * 100 : 0
  };
};

export const buildOrderUpdatePayload = (original, editor) => {
  const orderId = Number(original.orderId);
  if (!orderId) throw new Error('Order ID is required.');
  const orderItems = editor.lines.map((line) => ({
    orderItemId: Number(line.orderItemId) || 0,
    orderId,
    productId: Number(line.productId) || null,
    productName: line.name || '',
    productType: line.productType || '',
    quantity: Number(line.quantity),
    unitPrice: Number(line.price),
    totalPrice: Number(line.totalPrice),
    subscriptionMonths: Number(line.subscriptionMonths) || 0,
    isDeleted: false
  }));
  const retainedIds = new Set(orderItems.map((item) => item.orderItemId).filter(Boolean));
  for (const item of original.orderItems || original.items || []) {
    if (Number(item.orderItemId) && !retainedIds.has(Number(item.orderItemId))) {
      orderItems.push({
        orderItemId: Number(item.orderItemId),
        orderId,
        productId: Number(item.productId) || null,
        productName: item.productName || '',
        productType: item.productType || '',
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        totalPrice: Number(item.totalPrice) || 0,
        subscriptionMonths: Number(item.subscriptionMonths) || 0,
        isDeleted: true
      });
    }
  }
  return {
    orderId,
    customerId: Number(editor.customerId) || null,
    salesPersonId: Number(editor.salesPersonId) || null,
    saleDate: original.saleDate || original.orderDate || original.createdAt,
    subtotal: editor.summary.subtotal,
    discountAmount: editor.summary.discount,
    discountType: editor.discountType || '',
    discountCode: editor.discountCode || '',
    totalAmount: editor.summary.total,
    isFulfilled: original.isFulfilled === true,
    notes: editor.notes || '',
    shareTypeId: original.shareTypeId ?? null,
    orderItems
  };
};
