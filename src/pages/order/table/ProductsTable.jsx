import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, CalendarDays, Hash, Package, Plus, UserRound } from 'lucide-react';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AppModal from '@/components/common/AppModal';
import ActionIconButton from '@/components/common/ActionIconButton';
import AnchorPagination from '@/components/common/AnchorPagination';
import CommonTable from '@/components/common/CommonTable';
import GlassSegmentedControl from '@/components/common/GlassSegmentedControl';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ListToolbar from '@/components/common/ListToolbar';
import { DetailFields, StatusPill } from '@/components/common/TableCells';
import { productService } from '@/services';
import { toAbsoluteUrl } from '@/utils/Assets';
import { toast } from 'sonner';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import { usePagePermissionCodes } from '@/hooks/usePagePermissionCodes';
import { resolveDynamicPaths } from '@/lib/dynamicPaths';
import authService from '@/services/authService';
import permissionService from '@/services/permissionService';
import { IosToggle } from '@/components/ui/ios-toggle';
import { TableCard, PageHeader } from '@/components/common/page-card';

const emptyForm = {
  productId: 0,
  name: '',
  description: '',
  price: 0,
  productType: '',
  photo: '',
  isActive: true,
  createdBy: 0,
  createdByName: '',
  createdDate: '',
};

const VIEW_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'table', label: 'Table' },
];

const FORM_FIELDS = [
  { name: 'name', label: 'Product Name', required: true, wide: true, placeholder: 'e.g. Premium Support Plan' },
  { name: 'description', label: 'Description', wide: true, multiline: true, placeholder: 'What does this product include?' },
  // No type="number": the global stylesheet shrinks number inputs; Number() conversion happens on save.
  { name: 'price', label: 'Price (USD)', inputMode: 'decimal', pattern: '[0-9]*[.]?[0-9]{0,2}', title: 'Enter a price like 49.99', placeholder: '0.00' },
  { name: 'productType', label: 'Product Type', placeholder: 'e.g. Subscription' },
  { name: 'photo', label: 'Photo URL', wide: true, placeholder: 'https://… or /media/…' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition-all ' +
  'placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 ' +
  'dark:border-slate-700 dark:bg-slate-800 dark:text-white';

// Logged-in user for createdBy / createdByName (login stores the profile as JSON under 'user').
const currentUserInfo = () => {
  const user = authService.getUser() || {};
  const userName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.userName || '';
  return { userId: Number(user.userId ?? localStorage.getItem('userId')) || 0, userName };
};

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value));
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

// Full URLs and data URIs are used as-is; only app-relative paths get the base path prefix.
const resolvePhotoUrl = (photo) => {
  const value = String(photo || '').trim();
  if (!value) return '';
  return /^(https?:)?\/\/|^data:|^blob:/i.test(value) ? value : toAbsoluteUrl(value);
};

// Product photo with a lettered placeholder when there is no photo or it fails to load.
function ProductImage({ product, className = '', letterClassName = 'text-4xl' }) {
  const src = resolvePhotoUrl(product?.photo);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-500/10 dark:to-indigo-500/10 ${className}`}>
      {src && !failed ? (
        <img src={src} alt={product?.name || 'Product'} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className={`font-bold text-violet-400/80 dark:text-violet-300/60 ${letterClassName}`}>
          {product?.name?.charAt(0)?.toUpperCase() || <Package className="h-8 w-8" />}
        </span>
      )}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="h-40 bg-slate-100 dark:bg-slate-800" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-3 flex items-center justify-between">
          <div className="h-5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

const ProductsTable = () => {
  const [paths, setPaths] = useState({
    products: '/Orders/Products',
  });

  useEffect(() => {
    let mounted = true;

    const loadPaths = async () => {
      const resolved = await resolveDynamicPaths({
        products: '/Orders/Products',
      });
      if (!mounted) return;
      setPaths(resolved);
    };

    loadPaths();
    return () => {
      mounted = false;
    };
  }, []);

  const {
    loading: permissionsLoading,
    canView,
    canAdd,
    canUpdate,
    canDelete,
  } = usePageCrudPermissions({ path: paths.products, includeLocationFallback: true });

  const {
    loading: codesLoading,
    has: hasCode,
  } = usePagePermissionCodes({ path: paths.products });

  const canViewByCode = !codesLoading && hasCode('View_Product');
  const hasGlobalViewProduct = useMemo(
    () => permissionService.getUserPermissionCodes().some((code) => String(code || '').trim().toLowerCase() === 'view_product'),
    [],
  );
  const canSeeProducts = canView || canViewByCode || hasGlobalViewProduct;

  const [products, setProducts] = useState([]);
  // Starts true so the first paint shows skeletons, not a flash of "No products found".
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(12);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const result = await productService.getProducts({
        Text: searchText,
        PageNumber: pageNumber,
        PageSize: pageSize,
        // Use default sorting on the API side (no custom sort UI)
        SortProperty: 'productId',
        IsDescending: false,
      });

      setProducts(result.data || []);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setLoadError(error?.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [searchText, pageNumber, pageSize]);

  useEffect(() => {
    if (permissionsLoading || codesLoading) return;
    if (!canSeeProducts) {
      setProducts([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize, searchText, permissionsLoading, codesLoading, canSeeProducts]);

  // Search waits for a short pause in typing instead of calling the API on every keystroke.
  useEffect(() => {
    const next = searchTerm.trim();
    if (next === searchText) return undefined;
    const timer = window.setTimeout(() => {
      setPageNumber(1);
      setSearchText(next);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchTerm, searchText]);

  const applySearchNow = () => {
    setPageNumber(1);
    setSearchText(searchTerm.trim());
  };

  const ensurePermission = (allowed, action) => {
    if (permissionsLoading) {
      toast.error('Permissions are still loading. Please try again.');
      return false;
    }
    if (!allowed) {
      toast.error(`You don't have permission to ${action} products.`);
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!ensurePermission(canAdd, 'add')) return;

    const { userId, userName } = currentUserInfo();

    setEditingId(null);
    setFormData({
      ...emptyForm,
      createdBy: userId,
      createdByName: userName,
      createdDate: new Date().toISOString(),
    });
    setShowModal(true);
  };

  const handleEdit = (product) => {
    if (!ensurePermission(canUpdate, 'update')) return;

    const { userId, userName } = currentUserInfo();

    setEditingId(product.productId);
    setFormData({
      productId: product.productId || 0,
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? 0,
      productType: product.productType || '',
      photo: product.photo || '',
      isActive: product.isActive !== false,
      createdBy: product.createdBy || userId,
      createdByName: product.createdByName || userName,
      createdDate: product.createdDate || new Date().toISOString(),
    });
    setShowModal(true);
  };

  const handleDelete = (product) => {
    if (!ensurePermission(canDelete, 'delete')) return;

    const productId = product?.productId;
    if (!productId) return;

    setDeleteContext({
      id: productId,
      name: product?.name || 'this product',
    });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    const productId = deleteContext?.id;
    if (!productId) return;
    if (!ensurePermission(canDelete, 'delete')) return;

    try {
      setIsDeleting(true);
      await productService.deleteProduct(productId);
      toast.success('Product deleted');
      setDeleteConfirmOpen(false);
      setDeleteContext(null);
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error(error?.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const closeForm = () => {
    if (saving) return;
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const isEdit = Boolean(editingId);
    if (!ensurePermission(isEdit ? canUpdate : canAdd, isEdit ? 'update' : 'add')) return;

    const name = String(formData.name || '').trim();
    const price = Number(formData.price);
    if (!name) {
      toast.error('Product name is required.');
      return;
    }
    if (String(formData.price ?? '').trim() !== '' && (!Number.isFinite(price) || price < 0)) {
      toast.error('Price must be a positive number, e.g. 49.99.');
      return;
    }

    try {
      setSaving(true);
      const { userId, userName } = currentUserInfo();
      const payload = {
        ...formData,
        name,
        price: Number.isFinite(price) ? price : 0,
        createdBy: Number(formData.createdBy) || userId,
        createdByName: formData.createdByName || userName,
        createdDate: formData.createdDate || new Date().toISOString(),
      };

      if (isEdit) {
        // PUT /api/Product with the same ProductDTO fields, keeping the product's own productId.
        await productService.updateProduct(payload);
        toast.success(`Product "${name}" updated`);
      } else {
        // POST /api/Product (productService sends exactly the ProductDTO fields, productId 0).
        await productService.createProduct(payload);
        toast.success(`Product "${name}" created`);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      // Products are listed by productId ascending, so a new one lands on the last page.
      const lastPage = Math.max(1, Math.ceil((totalCount + (isEdit ? 0 : 1)) / pageSize));
      if (!isEdit && !searchText && lastPage !== pageNumber) setPageNumber(lastPage);
      else fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error, error?.response?.data);
      toast.error(error?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const productActions = (product) =>
    [
      { key: 'view', show: true, label: 'View product', variant: 'view', onClick: () => setDetailProduct(product) },
      { key: 'edit', show: !permissionsLoading && canUpdate, label: 'Edit product', variant: 'edit', onClick: () => handleEdit(product) },
      { key: 'delete', show: !permissionsLoading && canDelete, label: 'Delete product', variant: 'delete', onClick: () => handleDelete(product) },
    ].filter((action) => action.show);

  const renderActions = (product, className = '') => (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {productActions(product).map((action) => (
        <ActionIconButton key={action.key} label={action.label} variant={action.variant} onClick={action.onClick} />
      ))}
    </div>
  );

  const statusPill = (product) =>
    product.isActive === false ? <StatusPill tone="danger">Inactive</StatusPill> : <StatusPill tone="success">Active</StatusPill>;

  const tableColumns = [
    {
      id: 'product',
      header: 'Product',
      cell: (product) => (
        <button type="button" onClick={() => setDetailProduct(product)} className="flex min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left">
          <ProductImage product={product} className="h-11 w-11 shrink-0 rounded-xl" letterClassName="text-base" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-900 hover:text-indigo-600 dark:text-white">{product.name || '-'}</span>
            <span className="block text-xs text-gray-500">#{product.productId}</span>
          </span>
        </button>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (product) => (
        <span className="block max-w-[320px] truncate text-sm text-gray-600 dark:text-gray-300" title={product.description}>
          {product.description || '—'}
        </span>
      ),
    },
    { id: 'type', header: 'Type', cell: (product) => (product.productType ? <StatusPill tone="primary">{product.productType}</StatusPill> : '—') },
    { id: 'price', header: 'Price', align: 'right', cell: (product) => <span className="font-semibold tabular-nums">{formatPrice(product.price)}</span> },
    { id: 'status', header: 'Status', cell: statusPill },
    { id: 'actions', header: 'Actions', align: 'center', sticky: 'right', cell: (product) => renderActions(product, 'justify-center') },
  ];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const isFormLocked = permissionsLoading || (editingId ? !canUpdate : !canAdd);

  return (
    <>
      <PageHeader title="Products" description="Browse and manage the products sold on orders.">
        {!permissionsLoading && canAdd ? (
          <LiquidGlassButton type="button" onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add New Product
          </LiquidGlassButton>
        ) : null}
      </PageHeader>

      <TableCard>
        <ListToolbar
          shown={products.length}
          total={totalCount}
          itemName="Products"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClear={() => setSearchTerm('')}
          onSearchSubmit={applySearchNow}
          searchPlaceholder="Search products..."
          onRefresh={fetchProducts}
          loading={loading}
        />

        <div className="flex items-center justify-end border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <GlassSegmentedControl
            ariaLabel="Product layout"
            value={viewMode}
            onChange={setViewMode}
            options={VIEW_OPTIONS}
          />
        </div>

        {loadError && (
          <div className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{loadError}</span>
            <button type="button" onClick={fetchProducts} className="font-semibold underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {!permissionsLoading && !codesLoading && !canSeeProducts ? (
          <div className="px-4 py-16 text-center text-sm text-gray-500">You don&apos;t have permission to view products.</div>
        ) : viewMode === 'table' ? (
          <div className="grid">
            <CommonTable
              columns={tableColumns}
              data={products}
              isLoading={loading}
              rowKey="productId"
              emptyState={{ icon: <Package size={28} />, title: 'No products found', description: 'Try a different search term.' }}
              pagination={{ pageNumber, pageSize, totalCount, itemName: 'Products', showPageSize: false, onPageChange: setPageNumber }}
            />
          </div>
        ) : (
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" role="status" aria-label="Loading products">
                {Array.from({ length: Math.min(pageSize, products.length || 8) }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="mx-auto flex max-w-sm flex-col items-center py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                  <Package size={28} />
                </div>
                <h4 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">No products found</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {searchText ? 'Try a different search term.' : 'Products you add will appear here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {products.map((product) => (
                  <article
                    key={product.productId}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button type="button" onClick={() => setDetailProduct(product)} className="relative block border-0 bg-transparent p-0 text-left" aria-label={`View ${product.name}`}>
                      <ProductImage product={product} className="h-40 w-full" />
                      {product.productType && (
                        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/80 dark:text-slate-200">
                          {product.productType}
                        </span>
                      )}
                      <span className="absolute right-3 top-3">{statusPill(product)}</span>
                    </button>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                      <p className="mb-4 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{product.description || 'No description provided.'}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{formatPrice(product.price)}</span>
                        {renderActions(product)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {totalCount > pageSize && (
              <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-gray-500 dark:border-white/10 sm:flex-row">
                <span>
                  Page <strong className="text-gray-800 dark:text-gray-200">{pageNumber}</strong> of{' '}
                  <strong className="text-gray-800 dark:text-gray-200">{totalPages}</strong> · {totalCount} products
                </span>
                <AnchorPagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} disabled={loading} />
              </div>
            )}
          </div>
        )}

        <DeleteConfirmModal
          open={deleteConfirmOpen}
          onCancel={() => {
            if (isDeleting) return;
            setDeleteConfirmOpen(false);
            setDeleteContext(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Product"
          itemName={deleteContext?.name || 'this product'}
          confirmText="Delete"
          cancelText="Cancel"
          loading={isDeleting}
        />

        <AppModal
          open={Boolean(detailProduct)}
          onClose={() => setDetailProduct(null)}
          icon={Package}
          title={detailProduct?.name}
          description={detailProduct ? `Product #${detailProduct.productId}` : ''}
          size="lg"
          footer={(
            <>
              <LiquidGlassButton variant="secondary" onClick={() => setDetailProduct(null)}>
                Close
              </LiquidGlassButton>
              {!permissionsLoading && canUpdate && (
                <LiquidGlassButton
                  onClick={() => {
                    const product = detailProduct;
                    setDetailProduct(null);
                    handleEdit(product);
                  }}
                >
                  Edit Product
                </LiquidGlassButton>
              )}
            </>
          )}
        >
          {detailProduct && (
            <div className="grid gap-6 md:grid-cols-2">
              <ProductImage product={detailProduct} className="aspect-[4/3] w-full rounded-2xl" letterClassName="text-6xl" />
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{formatPrice(detailProduct.price)}</span>
                  {statusPill(detailProduct)}
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                  {detailProduct.description || 'No description provided for this product.'}
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-white/[0.03]">
                  <DetailFields
                    fields={[
                      { label: 'Product ID', value: <span className="inline-flex items-center gap-1"><Hash size={13} />{detailProduct.productId ?? '-'}</span> },
                      { label: 'Type', value: detailProduct.productType },
                      { label: 'Created By', value: <span className="inline-flex items-center gap-1"><UserRound size={13} />{detailProduct.createdByName || detailProduct.createdBy || '-'}</span> },
                      { label: 'Created', value: <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatDateTime(detailProduct.createdDate)}</span> },
                    ]}
                  />
                </div>
              </div>
            </div>
          )}
        </AppModal>

        <AppModal
          open={showModal}
          onClose={closeForm}
          onSubmit={handleSave}
          busy={saving}
          icon={Package}
          title={editingId ? 'Edit Product' : 'Add Product'}
          description="Provide product details below."
          size="lg"
          footer={(
            <>
              <LiquidGlassButton variant="secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </LiquidGlassButton>
              <LiquidGlassButton type="submit" loading={saving} disabled={isFormLocked}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
              </LiquidGlassButton>
            </>
          )}
        >
          <fieldset disabled={isFormLocked || saving} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FORM_FIELDS.map(({ name, label, required, wide, multiline, ...inputProps }) => (
                <label key={name} className={`block ${wide ? 'md:col-span-2' : ''}`}>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                    {required && <span className="ml-0.5 text-rose-500">*</span>}
                  </span>
                  {multiline ? (
                    <textarea
                      name={name}
                      rows={3}
                      value={formData[name]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder={inputProps.placeholder}
                      className={`${inputClass} resize-y`}
                    />
                  ) : (
                    <input
                      name={name}
                      value={formData[name]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [name]: e.target.value }))}
                      required={required}
                      {...inputProps}
                      className={`${inputClass} h-11`}
                    />
                  )}
                </label>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700 md:col-span-2">
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</div>
                  <div className="text-xs text-slate-500">{formData.isActive ? 'Active' : 'Inactive'}</div>
                </div>
                <IosToggle
                  checked={!!formData.isActive}
                  onCheckedChange={(nextChecked) => setFormData((prev) => ({ ...prev, isActive: !!nextChecked }))}
                  title={formData.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
            <div className="hidden md:block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Preview</span>
              <ProductImage product={formData} className="aspect-square w-full rounded-2xl border border-slate-200 dark:border-slate-700" letterClassName="text-5xl" />
              <div className="mt-2 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{formData.name || 'Product name'}</div>
              <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatPrice(Number(formData.price) || 0)}</div>
            </div>
          </fieldset>
        </AppModal>
      </TableCard>
    </>
  );
};

export { ProductsTable };
