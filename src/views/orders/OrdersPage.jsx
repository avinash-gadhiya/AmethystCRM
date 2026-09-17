import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import {
  Calendar,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  User
} from 'lucide-react';

import orderService from 'services/orderService';
import authService from 'services/authService';

const PAGE_SIZES = [10, 25, 50, 100];
const SEARCH_FIELDS = [
  { value: '', label: 'All Fields' },
  { value: 'CustomerName', label: 'Customer Name' },
  { value: 'BrandName', label: 'Brand Name' },
  { value: 'GatewayName', label: 'Gateway Name' },
  { value: 'SalesPersonName', label: 'Sales Person' },
  { value: 'OrderId', label: 'Order ID' }
];

const EMPTY_ITEM = {
  orderItemId: 0,
  orderId: 0,
  productId: null,
  productName: '',
  productType: 'Service',
  quantity: 1,
  unitPrice: 0,
  totalPrice: 0,
  subscriptionMonths: 0,
  isDeleted: false
};

const EMPTY_ORDER_FORM = {
  orderId: 0,
  customerId: '',
  salesPersonId: '',
  saleDate: new Date().toISOString().slice(0, 10),
  subtotal: 0,
  discountAmount: 0,
  discountType: 'Fixed',
  discountCode: '',
  totalAmount: 0,
  orderStatus: 'Pending',
  isFulfilled: false,
  notes: '',
  shareTypeId: null,
  orderItems: []
};

const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadge = (status) => {
  const norm = String(status || '').trim().toLowerCase();
  if (norm.includes('complete') || norm.includes('paid') || norm === 'success') {
    return <Badge bg="success">Completed</Badge>;
  }
  if (norm.includes('pend') || norm.includes('process')) {
    return <Badge bg="warning" text="dark">Pending</Badge>;
  }
  if (norm.includes('refund') || norm.includes('chargeback') || norm.includes('void')) {
    return <Badge bg="danger">Refunded</Badge>;
  }
  if (norm.includes('cancel')) {
    return <Badge bg="secondary">Cancelled</Badge>;
  }
  return <Badge bg="info" text="white">{status || 'Open'}</Badge>;
};

const Pagination = ({ page, pageSize, total, onPage, onPageSize }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
      <span className="small text-muted">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total} orders
      </span>
      <div className="d-flex align-items-center gap-2">
        <Form.Select
          size="sm"
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          style={{ width: 85 }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Form.Select>
        <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="small text-nowrap">
          {page} / {pages}
        </span>
        <Button size="sm" variant="outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </Card.Footer>
  );
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters & Search
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorForm, setEditorForm] = useState(EMPTY_ORDER_FORM);
  const [saving, setSaving] = useState(false);

  // Summary Metrics
  const [summaryData, setSummaryData] = useState(null);

  // Fetch Orders
  const loadOrders = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await orderService.getOrders(
          {
            SearchField: searchField,
            Text: searchText,
            fromDate,
            toDate,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'orderId',
            IsDescending: true
          },
          signal
        );

        setOrders(response.data);
        setTotalCount(response.totalCount);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setOrders([]);
        setTotalCount(0);
        setError(err.message || 'Unable to load orders.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [searchField, searchText, fromDate, toDate, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders, refreshKey]);

  // Load Order Summary
  useEffect(() => {
    const controller = new AbortController();
    orderService
      .getOrderSummary(fromDate, toDate, controller.signal)
      .then((res) => {
        if (res) setSummaryData(res);
      })
      .catch(() => {
        // Fallback to aggregation
      });
    return () => controller.abort();
  }, [fromDate, toDate, refreshKey]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const handleDatePreset = (preset) => {
    const today = new Date();
    const format = (d) => d.toISOString().slice(0, 10);

    if (preset === 'today') {
      const todayStr = format(today);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setFromDate(format(past));
      setToDate(format(today));
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(format(firstDay));
      setToDate(format(today));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
    setPage(1);
  };

  // View Details
  const handleViewOrder = async (orderItem) => {
    setSelectedOrder(orderItem);
    setShowDetailsModal(true);
    setLoadingDetails(true);
    try {
      const details = await orderService.getOrderById(orderItem.orderId);
      if (details) {
        setSelectedOrder((prev) => ({ ...prev, ...details }));
      }
    } catch (err) {
      console.error('Failed to fetch full order details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Editor
  const handleOpenEditor = async (orderItem = null) => {
    if (orderItem) {
      setSaving(false);
      try {
        const details = await orderService.getOrderById(orderItem.orderId);
        const data = details || orderItem;
        setEditorForm({
          orderId: data.orderId || orderItem.orderId,
          customerId: data.customerId || '',
          salesPersonId: data.salesPersonId || '',
          saleDate: data.saleDate ? data.saleDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
          subtotal: Number(data.subtotal) || Number(data.totalAmount) || 0,
          discountAmount: Number(data.discountAmount) || 0,
          discountType: data.discountType || 'Fixed',
          discountCode: data.discountCode || '',
          totalAmount: Number(data.totalAmount) || 0,
          orderStatus: data.orderStatus || orderItem.orderStatus || 'Pending',
          isFulfilled: Boolean(data.isFulfilled),
          notes: data.notes || '',
          shareTypeId: data.shareTypeId || null,
          orderItems: Array.isArray(data.orderItems) && data.orderItems.length > 0 ? data.orderItems : []
        });
      } catch {
        setEditorForm({
          ...EMPTY_ORDER_FORM,
          orderId: orderItem.orderId,
          totalAmount: orderItem.totalAmount || 0,
          orderStatus: orderItem.orderStatus || 'Pending'
        });
      }
    } else {
      const currentUser = authService.getUser();
      setEditorForm({
        ...EMPTY_ORDER_FORM,
        salesPersonId: currentUser?.userId || '',
        orderItems: [{ ...EMPTY_ITEM, productName: 'General Service', unitPrice: 0, totalPrice: 0 }]
      });
    }
    setShowEditorModal(true);
  };

  // Dynamic Item Row Management
  const handleAddItemRow = () => {
    setEditorForm((prev) => ({
      ...prev,
      orderItems: [...prev.orderItems, { ...EMPTY_ITEM }]
    }));
  };

  const handleRemoveItemRow = (index) => {
    setEditorForm((prev) => {
      const updated = prev.orderItems.filter((_, i) => i !== index);
      const subtotal = updated.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
      const totalAmount = Math.max(0, subtotal - (Number(prev.discountAmount) || 0));
      return {
        ...prev,
        orderItems: updated,
        subtotal,
        totalAmount
      };
    });
  };

  const handleItemChange = (index, field, value) => {
    setEditorForm((prev) => {
      const items = [...prev.orderItems];
      const item = { ...items[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : item.unitPrice) || 0;
        item.totalPrice = qty * price;
      }

      items[index] = item;
      const subtotal = items.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);
      const totalAmount = Math.max(0, subtotal - (Number(prev.discountAmount) || 0));

      return {
        ...prev,
        orderItems: items,
        subtotal,
        totalAmount
      };
    });
  };

  const handleDiscountChange = (val) => {
    const discount = Number(val) || 0;
    setEditorForm((prev) => ({
      ...prev,
      discountAmount: discount,
      totalAmount: Math.max(0, Number(prev.subtotal) - discount)
    }));
  };

  // Save Order
  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!editorForm.customerId && !editorForm.orderId) {
      setError('Customer ID is required to create an order.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editorForm.orderId) {
        // PUT /api/Order (EditOrderDTO)
        const payload = {
          orderId: Number(editorForm.orderId),
          customerId: Number(editorForm.customerId) || null,
          salesPersonId: Number(editorForm.salesPersonId) || null,
          saleDate: new Date(editorForm.saleDate).toISOString(),
          subtotal: Number(editorForm.subtotal) || 0,
          discountAmount: Number(editorForm.discountAmount) || 0,
          discountType: editorForm.discountType || 'Fixed',
          discountCode: editorForm.discountCode || '',
          totalAmount: Number(editorForm.totalAmount) || 0,
          isFulfilled: Boolean(editorForm.isFulfilled),
          notes: editorForm.notes || '',
          shareTypeId: editorForm.shareTypeId || null,
          orderItems: editorForm.orderItems.map((item) => ({
            orderItemId: Number(item.orderItemId) || 0,
            orderId: Number(editorForm.orderId),
            productId: item.productId ? Number(item.productId) : null,
            productName: item.productName || 'Item',
            productType: item.productType || 'Service',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            subscriptionMonths: Number(item.subscriptionMonths) || 0,
            isDeleted: Boolean(item.isDeleted)
          }))
        };
        await orderService.updateOrder(payload);
        setSuccess(`Order #${editorForm.orderId} updated successfully.`);
      } else {
        // POST /api/Order (OrderDTO)
        const currentUser = authService.getUser();
        const payload = {
          orderId: 0,
          customerId: Number(editorForm.customerId) || null,
          salesPersonId: Number(editorForm.salesPersonId) || null,
          saleDate: new Date(editorForm.saleDate).toISOString(),
          subtotal: Number(editorForm.subtotal) || 0,
          discountAmount: Number(editorForm.discountAmount) || 0,
          discountType: editorForm.discountType || 'Fixed',
          discountCode: editorForm.discountCode || '',
          totalAmount: Number(editorForm.totalAmount) || 0,
          orderStatus: editorForm.orderStatus || 'Pending',
          isFulfilled: Boolean(editorForm.isFulfilled),
          notes: editorForm.notes || '',
          createdBy: currentUser?.userId || null,
          isDeleted: false,
          shareTypeId: editorForm.shareTypeId || null,
          orderItems: editorForm.orderItems.map((item) => ({
            orderItemId: 0,
            orderId: 0,
            productId: item.productId ? Number(item.productId) : null,
            productName: item.productName || 'Item',
            productType: item.productType || 'Service',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            subscriptionMonths: Number(item.subscriptionMonths) || 0,
            isDeleted: false
          }))
        };
        await orderService.createOrder(payload);
        setSuccess('New order created successfully.');
      }

      setShowEditorModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderItem) => {
    if (!window.confirm(`Are you sure you want to delete order #${orderItem.orderId}?`)) return;
    try {
      await orderService.deleteOrder(orderItem.orderId);
      setSuccess(`Order #${orderItem.orderId} deleted successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete order.');
    }
  };

  // Aggregated KPI numbers
  const calculatedMetrics = useMemo(() => {
    const totalOrdersCount = totalCount || orders.length;
    let totalRev = 0;
    let totalPaid = 0;
    let totalRefund = 0;

    orders.forEach((o) => {
      totalRev += Number(o.totalAmount) || 0;
      totalPaid += Number(o.paidAmount) || 0;
      totalRefund += Number(o.refundAmount) || 0;
    });

    return {
      count: totalOrdersCount,
      revenue: summaryData?.totalRevenue ?? totalRev,
      paid: summaryData?.totalPaid ?? totalPaid,
      refund: summaryData?.totalRefund ?? totalRefund
    };
  }, [orders, totalCount, summaryData]);

  return (
    <div className="orders-page-container">
      {/* Top Banner / Metrics Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Orders</span>
                <h4 className="fw-bold mb-0 mt-1">{calculatedMetrics.count.toLocaleString()}</h4>
              </div>
              <div className="rounded-circle p-3 bg-primary bg-opacity-10 text-primary">
                <ShoppingCart size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Volume</span>
                <h4 className="fw-bold mb-0 mt-1 text-dark">{formatCurrency(calculatedMetrics.revenue)}</h4>
              </div>
              <div className="rounded-circle p-3 bg-indigo-50 text-indigo-600">
                <DollarSign size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Paid / Collected</span>
                <h4 className="fw-bold mb-0 mt-1 text-success">{formatCurrency(calculatedMetrics.paid)}</h4>
              </div>
              <div className="rounded-circle p-3 bg-success bg-opacity-10 text-success">
                <TrendingUp size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Refunds / Void</span>
                <h4 className="fw-bold mb-0 mt-1 text-danger">{formatCurrency(calculatedMetrics.refund)}</h4>
              </div>
              <div className="rounded-circle p-3 bg-danger bg-opacity-10 text-danger">
                <CreditCard size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-3">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')} className="mb-3">
          {success}
        </Alert>
      )}

      {/* Orders Main Card */}
      <Card className="border-0 shadow-sm">
        {/* Header & Controls */}
        <Card.Header className="bg-transparent py-3 border-bottom">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h5 className="mb-1 fw-bold text-gray-800">Orders Management</h5>
              <span className="text-muted small">Manage customer orders, transactions, payments, and fulfillment</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="light" text="dark" className="border px-3 py-2">
                /api/Order
              </Badge>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                title="Refresh Orders"
              >
                <RefreshCw size={15} />
              </Button>
              <Button size="sm" onClick={() => handleOpenEditor(null)}>
                <Plus size={16} className="me-1.5" />
                Create Order
              </Button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <Row className="g-2 align-items-center">
            {/* Search Field & Text */}
            <Col xs={12} md={4} lg={3}>
              <Form.Select
                size="sm"
                value={searchField}
                onChange={(e) => {
                  setSearchField(e.target.value);
                  setPage(1);
                }}
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={5} lg={4}>
              <Form onSubmit={applySearch}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-white">
                    <Search size={14} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Search by customer, brand, gateway..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <Button type="submit" variant="outline-secondary">
                    Search
                  </Button>
                </InputGroup>
              </Form>
            </Col>

            {/* Date Filters */}
            <Col xs={6} md={3} lg={2}>
              <Form.Control
                type="date"
                size="sm"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                title="From Date"
              />
            </Col>

            <Col xs={6} md={3} lg={2}>
              <Form.Control
                type="date"
                size="sm"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                title="To Date"
              />
            </Col>

            {/* Quick Presets */}
            <Col xs={12} lg={1} className="d-flex gap-1 justify-content-end">
              <Button size="sm" variant="light" className="border px-2 text-xs" onClick={() => handleDatePreset('all')}>
                Reset
              </Button>
            </Col>
          </Row>

          {/* Quick Filter Pill Buttons */}
          <div className="d-flex flex-wrap gap-2 mt-2 pt-2 border-top">
            <span className="text-muted text-xs align-self-center me-1">Presets:</span>
            <Button size="sm" variant="outline-secondary" className="text-xs py-0.5 px-2" onClick={() => handleDatePreset('today')}>
              Today
            </Button>
            <Button size="sm" variant="outline-secondary" className="text-xs py-0.5 px-2" onClick={() => handleDatePreset('7days')}>
              Last 7 Days
            </Button>
            <Button size="sm" variant="outline-secondary" className="text-xs py-0.5 px-2" onClick={() => handleDatePreset('month')}>
              This Month
            </Button>
          </div>
        </Card.Header>

        {/* Table Content */}
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="px-3 py-3">Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Brand / Gateway</th>
                  <th>Salesperson</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Paid</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      <Spinner size="sm" className="me-2 text-primary" />
                      Loading orders...
                    </td>
                  </tr>
                ) : !orders.length ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-5">
                      <ShoppingCart size={36} className="text-muted mb-2 opacity-50 d-block mx-auto" />
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.orderId}>
                      {/* ID */}
                      <td className="px-3">
                        <span className="badge bg-light text-dark border fw-semibold">
                          #{order.orderId}
                        </span>
                      </td>

                      {/* Date */}
                      <td>
                        <div className="small fw-semibold">{formatDate(order.orderDate || order.paymentDate)}</div>
                        <div className="text-muted text-xs">
                          {order.paymentDate ? `Paid: ${formatDate(order.paymentDate)}` : 'Unpaid'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                            {(order.customerName || 'C')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-semibold text-primary">{order.customerName || 'Unknown Customer'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Brand & Gateway */}
                      <td>
                        <div className="small text-dark font-medium">{order.brandName || '—'}</div>
                        <div className="text-muted text-xs">{order.gatewayName || 'No Gateway'}</div>
                      </td>

                      {/* Sales Person */}
                      <td>
                        <span className="small text-muted">{order.salesPersonName || '—'}</span>
                      </td>

                      {/* Total Amount */}
                      <td className="text-end fw-semibold text-dark">
                        {formatCurrency(order.totalAmount)}
                      </td>

                      {/* Paid Amount */}
                      <td className="text-end">
                        <span className="text-success fw-semibold font-mono">
                          {formatCurrency(order.paidAmount)}
                        </span>
                        {Number(order.refundAmount) > 0 && (
                          <div className="text-danger text-xs">
                            -{formatCurrency(order.refundAmount)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(order.orderStatus)}</td>

                      {/* Actions */}
                      <td className="text-center text-nowrap">
                        <Button
                          size="sm"
                          variant="outline-info"
                          className="me-1.5 p-1"
                          onClick={() => handleViewOrder(order)}
                          title="View Order Details"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="me-1.5 p-1"
                          onClick={() => handleOpenEditor(order)}
                          title="Edit Order"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="p-1"
                          onClick={() => handleDeleteOrder(order)}
                          title="Delete Order"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        {/* Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={totalCount}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="border-bottom bg-light">
          <Modal.Title className="h5 mb-0 d-flex align-items-center gap-2">
            <Package size={18} className="text-primary" />
            Order #{selectedOrder?.orderId} Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {loadingDetails ? (
            <div className="text-center py-5">
              <Spinner size="sm" className="me-2" />
              Loading order details...
            </div>
          ) : selectedOrder ? (
            <div>
              {/* Top Overview Cards */}
              <Row className="g-3 mb-4">
                <Col md={4}>
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted text-xs text-uppercase fw-semibold">Customer</span>
                    <h6 className="mt-1 mb-0 fw-bold text-primary">{selectedOrder.customerName || `Customer #${selectedOrder.customerId}`}</h6>
                    <span className="text-muted text-xs">Customer ID: {selectedOrder.customerId || '—'}</span>
                  </div>
                </Col>

                <Col md={4}>
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted text-xs text-uppercase fw-semibold">Order Status</span>
                    <div className="mt-1 mb-0">{getStatusBadge(selectedOrder.orderStatus)}</div>
                    <span className="text-muted text-xs">
                      {selectedOrder.isFulfilled ? 'Fulfilled ✓' : 'Unfulfilled'}
                    </span>
                  </div>
                </Col>

                <Col md={4}>
                  <div className="p-3 bg-light rounded-3 border">
                    <span className="text-muted text-xs text-uppercase fw-semibold">Total Amount</span>
                    <h6 className="mt-1 mb-0 fw-bold text-success font-mono">{formatCurrency(selectedOrder.totalAmount)}</h6>
                    <span className="text-muted text-xs">Subtotal: {formatCurrency(selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                  </div>
                </Col>
              </Row>

              {/* Order Info Details */}
              <div className="mb-4">
                <h6 className="fw-bold mb-2 pb-1 border-bottom text-gray-700">Order Information</h6>
                <Row className="g-2 small">
                  <Col sm={6}>
                    <span className="text-muted">Sale Date:</span>{' '}
                    <span className="fw-medium">{formatDateTime(selectedOrder.saleDate || selectedOrder.orderDate)}</span>
                  </Col>
                  <Col sm={6}>
                    <span className="text-muted">Salesperson:</span>{' '}
                    <span className="fw-medium">{selectedOrder.salesPersonName || selectedOrder.salesPersonId || '—'}</span>
                  </Col>
                  <Col sm={6}>
                    <span className="text-muted">Discount:</span>{' '}
                    <span className="fw-medium">
                      {formatCurrency(selectedOrder.discountAmount)} {selectedOrder.discountCode ? `(${selectedOrder.discountCode})` : ''}
                    </span>
                  </Col>
                  <Col sm={6}>
                    <span className="text-muted">Gateway / Brand:</span>{' '}
                    <span className="fw-medium">{selectedOrder.gatewayName || selectedOrder.brandName || '—'}</span>
                  </Col>
                  {selectedOrder.notes && (
                    <Col xs={12} className="mt-2">
                      <span className="text-muted d-block mb-1">Notes:</span>
                      <div className="p-2 bg-light border rounded text-xs text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedOrder.notes}
                      </div>
                    </Col>
                  )}
                </Row>
              </div>

              {/* Order Items */}
              <div className="mb-4">
                <h6 className="fw-bold mb-2 pb-1 border-bottom text-gray-700 d-flex align-items-center justify-content-between">
                  <span>Order Items</span>
                  <Badge bg="secondary" className="fw-normal">
                    {Array.isArray(selectedOrder.orderItems) ? selectedOrder.orderItems.length : 0} items
                  </Badge>
                </h6>
                <div className="table-responsive border rounded-3">
                  <Table size="sm" className="mb-0">
                    <thead className="table-light text-xs">
                      <tr>
                        <th>Product / Item</th>
                        <th>Type</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Unit Price</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {Array.isArray(selectedOrder.orderItems) && selectedOrder.orderItems.length > 0 ? (
                        selectedOrder.orderItems.map((item, idx) => (
                          <tr key={item.orderItemId || idx}>
                            <td className="fw-medium">{item.productName || `Item #${item.productId || idx + 1}`}</td>
                            <td><span className="badge bg-light text-dark border text-xs">{item.productType || 'Service'}</span></td>
                            <td className="text-center">{item.quantity || 1}</td>
                            <td className="text-end font-mono">{formatCurrency(item.unitPrice)}</td>
                            <td className="text-end font-mono fw-semibold">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-3">
                            No item breakdown available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>

              {/* Payments Breakdown */}
              {Array.isArray(selectedOrder.payments) && selectedOrder.payments.length > 0 && (
                <div>
                  <h6 className="fw-bold mb-2 pb-1 border-bottom text-gray-700">Payment Transactions</h6>
                  <div className="table-responsive border rounded-3">
                    <Table size="sm" className="mb-0 text-xs">
                      <thead className="table-light">
                        <tr>
                          <th>Payment Date</th>
                          <th>Gateway / Brand</th>
                          <th>Card / Method</th>
                          <th>Txn ID</th>
                          <th className="text-end">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.payments.map((p, idx) => (
                          <tr key={p.paymentId || idx}>
                            <td>{formatDateTime(p.paymentDate)}</td>
                            <td>{p.gatewayName || p.brandName || '—'}</td>
                            <td>{p.cardType || p.paymentType || 'Credit Card'} {p.cardNumber ? `(**** ${p.cardNumber.slice(-4)})` : ''}</td>
                            <td><code>{p.transactionId || '—'}</code></td>
                            <td className="text-end font-mono fw-semibold text-success">{formatCurrency(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="bg-light border-top">
          <Button variant="outline-secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowDetailsModal(false);
              handleOpenEditor(selectedOrder);
            }}
          >
            Edit Order
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        show={showEditorModal}
        onHide={() => !saving && setShowEditorModal(false)}
        size="lg"
        centered
      >
        <Form onSubmit={handleSaveOrder}>
          <Modal.Header closeButton={!saving} className="bg-light border-bottom">
            <Modal.Title className="h5 mb-0">
              {editorForm.orderId ? `Edit Order #${editorForm.orderId}` : 'Create New Order'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Label className="small fw-semibold">
                  Customer ID <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="number"
                  placeholder="Enter Customer ID"
                  value={editorForm.customerId}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, customerId: e.target.value }))}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">Sales Person ID</Form.Label>
                <Form.Control
                  type="number"
                  placeholder="Sales Rep User ID"
                  value={editorForm.salesPersonId}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, salesPersonId: e.target.value }))}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">Sale Date</Form.Label>
                <Form.Control
                  type="date"
                  value={editorForm.saleDate}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, saleDate: e.target.value }))}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">Order Status</Form.Label>
                <Form.Select
                  value={editorForm.orderStatus}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, orderStatus: e.target.value }))}
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Processing">Processing</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </Form.Select>
              </Col>
            </Row>

            {/* Line Items Section */}
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="small fw-bold text-gray-700">Order Items</span>
                <Button size="sm" variant="outline-primary" type="button" onClick={handleAddItemRow}>
                  <Plus size={14} className="me-1" /> Add Item
                </Button>
              </div>

              <div className="border rounded-3 p-3 bg-light">
                {editorForm.orderItems.map((item, idx) => (
                  <Row key={idx} className="g-2 align-items-end mb-2">
                    <Col md={5}>
                      {idx === 0 && <Form.Label className="text-xs text-muted mb-1">Product / Service</Form.Label>}
                      <Form.Control
                        size="sm"
                        placeholder="Product name"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                        required
                      />
                    </Col>
                    <Col md={2}>
                      {idx === 0 && <Form.Label className="text-xs text-muted mb-1">Qty</Form.Label>}
                      <Form.Control
                        size="sm"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                      />
                    </Col>
                    <Col md={2}>
                      {idx === 0 && <Form.Label className="text-xs text-muted mb-1">Price ($)</Form.Label>}
                      <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        required
                      />
                    </Col>
                    <Col md={2}>
                      {idx === 0 && <Form.Label className="text-xs text-muted mb-1">Total</Form.Label>}
                      <Form.Control
                        size="sm"
                        readOnly
                        disabled
                        value={formatCurrency(item.totalPrice)}
                        className="bg-white font-mono"
                      />
                    </Col>
                    <Col md={1} className="text-center">
                      <Button
                        size="sm"
                        variant="outline-danger"
                        type="button"
                        className="p-1"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={editorForm.orderItems.length <= 1}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Col>
                  </Row>
                ))}
              </div>
            </div>

            {/* Financial Calculations */}
            <Row className="g-3 mb-3">
              <Col md={4}>
                <Form.Label className="small fw-semibold">Subtotal ($)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={editorForm.subtotal}
                  onChange={(e) => {
                    const sub = Number(e.target.value) || 0;
                    setEditorForm((prev) => ({
                      ...prev,
                      subtotal: sub,
                      totalAmount: Math.max(0, sub - (Number(prev.discountAmount) || 0))
                    }));
                  }}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="small fw-semibold">Discount Amount ($)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  value={editorForm.discountAmount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="small fw-semibold">Total Amount ($)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={editorForm.totalAmount}
                  readOnly
                  className="bg-light fw-bold font-mono text-success"
                />
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">Discount Code</Form.Label>
                <Form.Control
                  placeholder="e.g. SUMMER25"
                  value={editorForm.discountCode || ''}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, discountCode: e.target.value }))}
                />
              </Col>

              <Col md={6} className="d-flex align-items-center pt-3">
                <Form.Check
                  id="order-fulfilled-check"
                  label="Order Fulfilled"
                  checked={editorForm.isFulfilled}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, isFulfilled: e.target.checked }))}
                />
              </Col>

              <Col xs={12}>
                <Form.Label className="small fw-semibold">Notes / Special Instructions</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Internal notes or customer requests"
                  value={editorForm.notes || ''}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="bg-light border-top">
            <Button variant="outline-secondary" onClick={() => setShowEditorModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editorForm.orderId ? 'Save Changes' : 'Create Order'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
