import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import {
  CheckCircle2,
  DollarSign,
  Grid,
  Image as ImageIcon,
  Layers,
  List,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  XCircle
} from 'lucide-react';

import productService from 'services/productService';
import authService from 'services/authService';

const PAGE_SIZES = [10, 25, 50, 100];
const STANDARD_TYPES = ['Service', 'Software', 'Subscription', 'Physical', 'Consulting', 'Custom'];

const EMPTY_PRODUCT_FORM = {
  productId: 0,
  name: '',
  description: '',
  price: '',
  productType: 'Service',
  photo: '',
  isActive: true,
  createdBy: null,
  createdByName: ''
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

const Pagination = ({ page, pageSize, total, onPage, onPageSize }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
      <span className="small text-muted">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total} products
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

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Editor Modal
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorForm, setEditorForm] = useState(EMPTY_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);

  // Load Products
  const loadProducts = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await productService.getProducts(
          {
            Text: searchText,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'productId',
            IsDescending: true
          },
          signal
        );

        setProducts(response.data);
        setTotalCount(response.totalCount);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setProducts([]);
        setTotalCount(0);
        setError(err.message || 'Unable to load products.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [searchText, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts, refreshKey]);

  // Client-side quick filter for type and status if API Text search covers global terms
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (typeFilter && String(p.productType || '').toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter === 'active' && p.isActive === false) return false;
      if (statusFilter === 'inactive' && p.isActive !== false) return false;
      return true;
    });
  }, [products, typeFilter, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = totalCount || products.length;
    let active = 0;
    let inactive = 0;
    const types = new Set();

    products.forEach((p) => {
      if (p.isActive !== false) active += 1;
      else inactive += 1;
      if (p.productType) types.add(p.productType);
    });

    return {
      total,
      active,
      inactive,
      typesCount: types.size
    };
  }, [products, totalCount]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const handleOpenEditor = (product = null) => {
    if (product) {
      setEditorForm({
        productId: product.productId || 0,
        name: product.name || '',
        description: product.description || '',
        price: product.price ?? '',
        productType: product.productType || 'Service',
        photo: product.photo || '',
        isActive: product.isActive !== false,
        createdBy: product.createdBy || null,
        createdByName: product.createdByName || ''
      });
    } else {
      const user = authService.getUser();
      setEditorForm({
        ...EMPTY_PRODUCT_FORM,
        createdBy: user?.userId || null,
        createdByName: user?.displayName || user?.userName || ''
      });
    }
    setShowEditorModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editorForm.name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (editorForm.price === '' || isNaN(Number(editorForm.price))) {
      setError('A valid price is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const user = authService.getUser();
      const payload = {
        productId: Number(editorForm.productId) || 0,
        name: editorForm.name.trim(),
        description: editorForm.description?.trim() || '',
        price: Number(editorForm.price) || 0,
        productType: editorForm.productType?.trim() || 'Service',
        photo: editorForm.photo?.trim() || '',
        isActive: Boolean(editorForm.isActive),
        createdBy: editorForm.createdBy || user?.userId || null,
        createdByName: editorForm.createdByName || user?.displayName || null,
        createdDate: new Date().toISOString()
      };

      if (payload.productId) {
        await productService.updateProduct(payload);
        setSuccess(`Product “${payload.name}” updated successfully.`);
      } else {
        await productService.createProduct(payload);
        setSuccess(`Product “${payload.name}” created successfully.`);
      }

      setShowEditorModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete product “${product.name}”?`)) return;
    try {
      await productService.deleteProduct(product.productId);
      setSuccess(`Product “${product.name}” deleted successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  return (
    <div className="products-page-container">
      {/* Metric Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Catalog</span>
                <h4 className="fw-bold mb-0 mt-1">{metrics.total.toLocaleString()}</h4>
              </div>
              <div className="rounded-circle p-3 bg-primary bg-opacity-10 text-primary">
                <Package size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Active Products</span>
                <h4 className="fw-bold mb-0 mt-1 text-success">{metrics.active.toLocaleString()}</h4>
              </div>
              <div className="rounded-circle p-3 bg-success bg-opacity-10 text-success">
                <CheckCircle2 size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Inactive / Draft</span>
                <h4 className="fw-bold mb-0 mt-1 text-secondary">{metrics.inactive.toLocaleString()}</h4>
              </div>
              <div className="rounded-circle p-3 bg-secondary bg-opacity-10 text-secondary">
                <XCircle size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} xl={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center justify-content-between p-3">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Categories / Types</span>
                <h4 className="fw-bold mb-0 mt-1 text-indigo-600">{metrics.typesCount} Types</h4>
              </div>
              <div className="rounded-circle p-3 bg-indigo-50 text-indigo-600">
                <Layers size={22} />
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

      {/* Main Catalog Card */}
      <Card className="border-0 shadow-sm">
        {/* Header & Controls */}
        <Card.Header className="bg-transparent py-3 border-bottom">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h5 className="mb-1 fw-bold text-gray-800">Product Catalog</h5>
              <span className="text-muted small">Manage items, pricing, service packages, and digital subscriptions</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="light" text="dark" className="border px-3 py-2">
                /api/Product
              </Badge>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                title="Refresh Products"
              >
                <RefreshCw size={15} />
              </Button>
              <Button size="sm" onClick={() => handleOpenEditor(null)}>
                <Plus size={16} className="me-1.5" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <Row className="g-2 align-items-center">
            {/* Search Input */}
            <Col xs={12} md={5} lg={4}>
              <Form onSubmit={applySearch}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-white">
                    <Search size={14} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Search products by name or details..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <Button type="submit" variant="outline-secondary">
                    Search
                  </Button>
                </InputGroup>
              </Form>
            </Col>

            {/* Type Filter */}
            <Col xs={6} md={3} lg={3}>
              <Form.Select
                size="sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Product Types</option>
                {STANDARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Col>

            {/* Status Filter */}
            <Col xs={6} md={2} lg={2}>
              <Form.Select
                size="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Form.Select>
            </Col>

            {/* View Toggle & Reset */}
            <Col xs={12} md={2} lg={3} className="d-flex align-items-center justify-content-end gap-1">
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'primary' : 'outline-secondary'}
                className="p-1 px-2"
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <List size={15} />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'primary' : 'outline-secondary'}
                className="p-1 px-2"
                onClick={() => setViewMode('grid')}
                title="Grid / Cards View"
              >
                <Grid size={15} />
              </Button>
              <Button
                size="sm"
                variant="light"
                className="border text-xs py-1 ms-1"
                onClick={() => {
                  setSearchInput('');
                  setSearchText('');
                  setTypeFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </Col>
          </Row>
        </Card.Header>

        {/* Content Body */}
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner size="sm" className="me-2 text-primary" />
              Loading product catalog...
            </div>
          ) : !filteredProducts.length ? (
            <div className="text-center text-muted py-5">
              <Package size={40} className="text-muted mb-2 opacity-50 d-block mx-auto" />
              No products found matching the criteria.
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => (
                    <tr key={prod.productId}>
                      {/* Name & Photo */}
                      <td className="px-3">
                        <div className="d-flex align-items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl bg-light border flex-shrink-0 flex items-center justify-center overflow-hidden text-muted"
                            style={{ minWidth: 40, minHeight: 40 }}
                          >
                            {prod.photo ? (
                              <img
                                src={prod.photo}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package size={18} />
                            )}
                          </div>
                          <div>
                            <div className="fw-semibold text-primary">{prod.name}</div>
                            <div className="text-muted text-xs line-clamp-1" style={{ maxWidth: 300 }}>
                              {prod.description || 'No description provided.'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td>
                        <Badge bg="light" text="dark" className="border fw-normal">
                          <Tag size={11} className="me-1 opacity-70" />
                          {prod.productType || 'Service'}
                        </Badge>
                      </td>

                      {/* Price */}
                      <td className="fw-bold font-mono text-dark">
                        {formatCurrency(prod.price)}
                      </td>

                      {/* Status */}
                      <td>
                        <Badge bg={prod.isActive !== false ? 'success' : 'secondary'}>
                          {prod.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Created By */}
                      <td>
                        <span className="small text-muted">{prod.createdByName || prod.createdBy || '—'}</span>
                      </td>

                      {/* Date */}
                      <td>
                        <span className="small text-muted">{formatDate(prod.createdDate)}</span>
                      </td>

                      {/* Actions */}
                      <td className="text-center text-nowrap">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="me-1.5 p-1"
                          onClick={() => handleOpenEditor(prod)}
                          title="Edit Product"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="p-1"
                          onClick={() => handleDeleteProduct(prod)}
                          title="Delete Product"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            /* Grid / Cards View */
            <div className="p-3">
              <Row className="g-3">
                {filteredProducts.map((prod) => (
                  <Col key={prod.productId} xs={12} sm={6} md={4} xl={3}>
                    <Card className="border h-100 shadow-sm hover-shadow transition-all">
                      {prod.photo ? (
                        <div style={{ height: 140, overflow: 'hidden' }} className="bg-light border-bottom">
                          <img
                            src={prod.photo}
                            alt={prod.name}
                            className="w-100 h-100"
                            style={{ objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{ height: 100 }}
                          className="bg-light border-bottom d-flex align-items-center justify-content-center text-muted"
                        >
                          <Package size={32} className="opacity-40" />
                        </div>
                      )}
                      <Card.Body className="p-3 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex align-items-center justify-content-between mb-1.5">
                            <Badge bg="light" text="dark" className="border text-xs">
                              {prod.productType || 'Service'}
                            </Badge>
                            <Badge bg={prod.isActive !== false ? 'success' : 'secondary'} className="text-xs">
                              {prod.isActive !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <h6 className="fw-bold mb-1 text-primary">{prod.name}</h6>
                          <p className="text-muted text-xs mb-3 line-clamp-2" style={{ minHeight: 32 }}>
                            {prod.description || 'No description provided.'}
                          </p>
                        </div>
                        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                          <span className="h6 fw-bold font-mono text-dark mb-0">
                            {formatCurrency(prod.price)}
                          </span>
                          <div className="d-flex gap-1">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="p-1"
                              onClick={() => handleOpenEditor(prod)}
                              title="Edit Product"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="p-1"
                              onClick={() => handleDeleteProduct(prod)}
                              title="Delete Product"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
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

      {/* Create / Edit Modal */}
      <Modal
        show={showEditorModal}
        onHide={() => !saving && setShowEditorModal(false)}
        centered
      >
        <Form onSubmit={handleSaveProduct}>
          <Modal.Header closeButton={!saving} className="bg-light border-bottom">
            <Modal.Title className="h5 mb-0">
              {editorForm.productId ? `Edit Product #${editorForm.productId}` : 'Add New Product'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label className="small fw-semibold">
                  Product Name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  placeholder="e.g. Premium CRM Subscription, Setup Service"
                  value={editorForm.name}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">Product Type</Form.Label>
                <Form.Select
                  value={editorForm.productType}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, productType: e.target.value }))}
                >
                  {STANDARD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={6}>
                <Form.Label className="small fw-semibold">
                  Price ($) <span className="text-danger">*</span>
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text className="bg-light text-muted">
                    <DollarSign size={14} />
                  </InputGroup.Text>
                  <Form.Control
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={editorForm.price}
                    onChange={(e) => setEditorForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </InputGroup>
              </Col>

              <Col xs={12}>
                <Form.Label className="small fw-semibold">Photo URL</Form.Label>
                <InputGroup>
                  <InputGroup.Text className="bg-light text-muted">
                    <ImageIcon size={14} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="https://example.com/photo.png"
                    value={editorForm.photo}
                    onChange={(e) => setEditorForm((prev) => ({ ...prev, photo: e.target.value }))}
                  />
                </InputGroup>
              </Col>

              <Col xs={12}>
                <Form.Check
                  id="product-is-active"
                  label="Active in catalog"
                  checked={editorForm.isActive}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
              </Col>

              <Col xs={12}>
                <Form.Label className="small fw-semibold">Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Detailed product features, deliverables, or specifications..."
                  value={editorForm.description}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="bg-light border-top">
            <Button variant="outline-secondary" onClick={() => setShowEditorModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editorForm.productId ? 'Save Changes' : 'Create Product'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
