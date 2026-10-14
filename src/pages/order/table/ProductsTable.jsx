import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Edit2, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import { productService } from '@/services';
import { toAbsoluteUrl } from '@/utils/Assets';
import { toast } from 'sonner';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import { usePagePermissionCodes } from '@/hooks/usePagePermissionCodes';
import { resolveDynamicPaths } from '@/lib/dynamicPaths';
import permissionService from '@/services/permissionService';
import { IosToggle } from '@/components/ui/ios-toggle';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import { TableCard, PageHeader, ModalPortal } from '@/components/common/page-card';
import TableSearchField from '@/components/common/TableSearchField';

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

const Toolbar = ({
  searchInput,
  onSearchChange,
  onClearSearch,
  total,
  shown,
  onRefresh,
}) => {
  return (
    <div className="tbl-glass-toolbar">
      <h3 className="font-medium text-sm">
        Showing {shown} of {total} Products
      </h3>
      <div className="flex items-center gap-2 sm:gap-3">
        <TableSearchField
          placeholder="Search Products"
          value={searchInput}
          onChange={onSearchChange}
          onClear={onClearSearch}
        />
        <TableRefreshButton
          className="shrink-0 w-10 h-10 dark:text-slate-200 dark:bg-slate-800"
          title="Refresh"
          onClick={onRefresh}
        />
      </div>
    </div>
  );
};

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
    () => permissionService.getUserPermissionCodes().includes('view_product'),
    [],
  );

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [searchText, pageNumber, pageSize]);

  useEffect(() => {
    if (permissionsLoading && codesLoading) return;
    if (!canView && !canViewByCode && !hasGlobalViewProduct) {
      setProducts([]);
      setTotalCount(0);
      return;
    }

    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageNumber,
    pageSize,
    searchText,
    permissionsLoading,
    codesLoading,
    canView,
    canViewByCode,
    hasGlobalViewProduct,
  ]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setSearchText(e.target.value);
    setPageNumber(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchText('');
    setPageNumber(1);
  }, []);

  const handleCreate = () => {
    if (permissionsLoading) {
      toast.error('Permissions are still loading. Please try again.');
      return;
    }
    if (!canAdd) {
      toast.error("You don't have permission to add products.");
      return;
    }

    const userId = Number(localStorage.getItem('userId') || 0);
    const userName = localStorage.getItem('userName') || '';

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
    if (permissionsLoading) {
      toast.error('Permissions are still loading. Please try again.');
      return;
    }
    if (!canUpdate) {
      toast.error("You don't have permission to update products.");
      return;
    }

    const userId = Number(localStorage.getItem('userId') || 0);
    const userName = localStorage.getItem('userName') || '';

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
    if (permissionsLoading) {
      toast.error('Permissions are still loading. Please try again.');
      return;
    }
    if (!canDelete) {
      toast.error("You don't have permission to delete products.");
      return;
    }

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

    try {
      if (permissionsLoading) {
        toast.error('Permissions are still loading. Please try again.');
        return;
      }
      if (!canDelete) {
        toast.error("You don't have permission to delete products.");
        return;
      }

      setIsDeleting(true);
      await productService.deleteProduct(productId);
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

  const handleView = (product) => {
    setDetailProduct(product);
    setShowDetail(true);
  };

  const handlePageChange = (page) => {
    setPageNumber(page);
  };

  const hasNextPage = pageNumber * pageSize < totalCount;
  const hasPrevPage = pageNumber > 1;

  const formatPrice = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value));
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <>
      <PageHeader title="Products" description="Browse available products like an e-commerce catalog.">
        {!permissionsLoading && canAdd ? (
          <LiquidGlassButton
            type="button"
            onClick={handleCreate}
            className="w-full sm:w-auto text-center"
          >
            <Plus className="w-4 h-4 liquid-glass-btn__icon" />
            Add New Product
          </LiquidGlassButton>
        ) : null}
      </PageHeader>

      <TableCard>

        <Toolbar
          searchInput={searchTerm}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          total={totalCount}
          shown={products.length}
          onRefresh={fetchProducts}
        />

        <div className="p-4">
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col rounded-xl border border-gray-200 bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-pulse">
                  <div className="h-40 bg-gray-200" />
                  <div className="flex flex-col flex-1 p-3 gap-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-5/6" />
                    <div className="mt-2 flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-16" />
                      <div className="h-6 bg-gray-200 rounded-full w-14" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">No products found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div
                  key={product.productId}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white dark:bg-slate-900 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative"
                >
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {!permissionsLoading && canUpdate ? (
                      <ActionIconButton
                        label="Edit product"
                        onClick={() => handleEdit(product)}
                        className="w-8 h-8 bg-white/90 dark:bg-slate-800/90 shadow hover:bg-white dark:hover:bg-slate-800 text-gray-700 border-transparent"
                      >
                        <Edit2 size={14} />
                      </ActionIconButton>
                    ) : null}
                    {!permissionsLoading && canDelete ? (
                      <ActionIconButton
                        variant="delete"
                        label="Delete product"
                        onClick={() => handleDelete(product)}
                        className="w-8 h-8 bg-white/90 dark:bg-slate-800/90 shadow hover:bg-white dark:hover:bg-slate-800 text-red-600 dark:text-red-400 border-transparent"
                      >
                        <Trash2 size={14} />
                      </ActionIconButton>
                    ) : null}
                  </div>
                  <div className="relative h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {product.photo ? (
                      <img
                        src={toAbsoluteUrl(product.photo)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-4xl font-semibold text-gray-400">
                        {product.name?.charAt(0)?.toUpperCase() || 'P'}
                      </span>
                    )}
                    {product.productType && (
                      <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                        {product.productType}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3 line-clamp-3 min-h-[3.5rem]">
                      {product.description || 'No description provided.'}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-base font-semibold text-gray-900">
                        {formatPrice(product.price)}
                      </span>
                      {product.isActive === false ? (
                        <span className="text-[11px] font-medium text-red-500 dark:text-red-400">Unavailable</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleView(product)}
                          className="inline-flex items-center rounded-full bg-[#2e1065] dark:bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
              <span>
                Page {pageNumber} of {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => hasPrevPage && handlePageChange(pageNumber - 1)}
                  disabled={!hasPrevPage}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${hasPrevPage
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => hasNextPage && handlePageChange(pageNumber + 1)}
                  disabled={!hasNextPage}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${hasNextPage
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

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
          confirmText={isDeleting ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          loading={isDeleting}
        />

        {showDetail && detailProduct && (
          <ModalPortal>
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                      {detailProduct.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {detailProduct.productType || 'Product detail'}
                    </p>
                  </div>
                  <GlassCloseButton
                    onClick={() => {
                      setShowDetail(false);
                      setDetailProduct(null);
                    }}
                    label="Close details"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-6 p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                  <div className="md:w-1/2 w-full">
                    <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center aspect-[4/3]">
                      {detailProduct.photo ? (
                        <img
                          src={toAbsoluteUrl(detailProduct.photo)}
                          alt={detailProduct.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl font-semibold text-gray-400">
                          {detailProduct.name?.charAt(0)?.toUpperCase() || 'P'}
                        </span>
                      )}
                      {detailProduct.productType && (
                        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-black/70 px-3 py-1 text-[11px] font-medium text-white">
                          {detailProduct.productType}
                        </span>
                      )}
                      {detailProduct.isActive === false && (
                        <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-[11px] font-medium text-white">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="md:w-1/2 w-full flex flex-col gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                        {detailProduct.name}
                      </h4>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {formatPrice(detailProduct.price)}
                        </span>
                        {detailProduct.productType && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
                            Type: {detailProduct.productType}
                          </span>
                        )}
                        {detailProduct.isActive === false && (
                          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-500/15 px-3 py-1 text-[11px] font-medium text-red-600 dark:text-red-300">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">Description</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {detailProduct.description || 'No description provided for this product.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-slate-300 mt-1">
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold">Product ID: </span>
                          <span>{detailProduct.productId ?? '-'}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Created By: </span>
                          <span>{detailProduct.createdByName || detailProduct.createdBy || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold">Created Date: </span>
                          <span>{formatDateTime(detailProduct.createdDate)}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Active: </span>
                          <span>{detailProduct.isActive ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <Button
                        type="button"
                        onClick={() => {
                          setShowDetail(false);
                          if (detailProduct) {
                            handleEdit(detailProduct);
                          }
                        }}
                        disabled={permissionsLoading || !canUpdate}
                      >
                        Edit Product
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDetail(false);
                          setDetailProduct(null);
                        }}
                        className="sm:ml-auto"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {showModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {editingId ? 'Edit Product' : 'Add Product'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Provide product details below.</p>
                  </div>
                  <GlassCloseButton
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData(emptyForm);
                    }}
                  />
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const isEdit = Boolean(editingId);

                      if (permissionsLoading) {
                        toast.error('Permissions are still loading. Please try again.');
                        return;
                      }
                      if (isEdit && !canUpdate) {
                        toast.error("You don't have permission to update products.");
                        return;
                      }
                      if (!isEdit && !canAdd) {
                        toast.error("You don't have permission to add products.");
                        return;
                      }

                      const payload = {
                        ...formData,
                        price: Number(formData.price) || 0,
                        createdDate: formData.createdDate || new Date().toISOString(),
                      };

                      if (isEdit) {
                        await productService.updateProduct(payload);
                        toast.success('Product updated');
                      } else {
                        await productService.createProduct(payload);
                        toast.success('Product created');
                      }

                      setShowModal(false);
                      setEditingId(null);
                      setFormData(emptyForm);
                      fetchProducts();
                    } catch (error) {
                      console.error('Failed to save product:', error, error?.response?.data);
                      toast.error(error?.message || 'Failed to save product');
                    }
                  }}
                  className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]"
                >
                  <fieldset
                    disabled={
                      permissionsLoading ||
                      (editingId ? !canUpdate : !canAdd)
                    }
                    className="contents"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
                        <input
                          name="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Price</label>
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Product Type</label>
                        <input
                          name="productType"
                          value={formData.productType}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              productType: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Photo URL</label>
                        <input
                          name="photo"
                          value={formData.photo}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              photo: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Status
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {formData.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <IosToggle
                            checked={!!formData.isActive}
                            onCheckedChange={(nextChecked) =>
                              setFormData((prev) => ({ ...prev, isActive: !!nextChecked }))
                            }
                            title={formData.isActive ? 'Active' : 'Inactive'}
                          />
                        </div>
                      </div>
                    </div>

                  </fieldset>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowModal(false);
                        setEditingId(null);
                        setFormData(emptyForm);
                      }}
                    >
                      Cancel
                    </Button>
                    <LiquidGlassButton type="submit" className="sm:ml-auto text-center">
                      Save
                    </LiquidGlassButton>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
        )}
      </TableCard>
    </>
  );
};

export { ProductsTable };


