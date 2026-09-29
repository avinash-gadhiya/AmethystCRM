import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Award,
  Mail,
  CreditCard,
  FileText,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Server,
  Layers,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Settings2,
  Lock,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandPermissions } from '@/utils/brandPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';

import BrandEmailModal from '@/components/brand/BrandEmailModal';
import GatewayModal from '@/components/brand/GatewayModal';
import GatewayPaymentTypeModal from '@/components/brand/GatewayPaymentTypeModal';
import BrandTemplateModal from '@/components/brand/BrandTemplateModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const GATEWAY_TYPE_NAMES = {
  0: 'Unknown',
  1: 'Authorize.Net',
  2: 'NMI',
  3: 'Nuvei'
};

const BrandDetailsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const brandIdParam = searchParams.get('brandId');
  const selectedBrandId = Number(brandIdParam) || 0;
  const requestedTab = (searchParams.get('tab') || 'email').toLowerCase();

  // Tab permissions
  const emailPerms = useMemo(() => resolveBrandPermissions('brandemail'), []);
  const gatewayPerms = useMemo(() => resolveBrandPermissions('gateway'), []);
  const templatePerms = useMemo(() => resolveBrandPermissions('template'), []);

  // Compute accessible tabs
  const accessibleTabs = useMemo(() => {
    const tabs = [];
    if (emailPerms.canView) {
      tabs.push({ id: 'email', label: 'Brand Emails', icon: Mail, perms: emailPerms });
    }
    if (gatewayPerms.canView) {
      tabs.push({ id: 'gateway', label: 'Payment Gateways', icon: CreditCard, perms: gatewayPerms });
    }
    if (templatePerms.canView) {
      tabs.push({ id: 'templates', label: 'Email Templates', icon: FileText, perms: templatePerms });
    }
    return tabs;
  }, [emailPerms, gatewayPerms, templatePerms]);

  // Active tab selection with fallback to first accessible tab
  const activeTab = useMemo(() => {
    if (accessibleTabs.some((t) => t.id === requestedTab)) {
      return requestedTab;
    }
    return accessibleTabs[0]?.id || 'email';
  }, [accessibleTabs, requestedTab]);

  // Sync activeTab to URL search params if needed
  const handleTabChange = (newTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', newTab);
    if (selectedBrandId) {
      nextParams.set('brandId', String(selectedBrandId));
    }
    setSearchParams(nextParams);
  };

  // Brand Metadata
  const [brand, setBrand] = useState(null);
  const [brandLoading, setBrandLoading] = useState(true);

  // Load Brand Info
  useEffect(() => {
    let isSubscribed = true;
    const loadBrandInfo = async () => {
      if (!selectedBrandId) {
        setBrandLoading(false);
        return;
      }
      try {
        setBrandLoading(true);
        const b = await brandService.getBrandById(selectedBrandId);
        if (isSubscribed) {
          setBrand(b);
        }
      } catch (err) {
        console.error('Failed to load brand details:', err);
      } finally {
        if (isSubscribed) {
          setBrandLoading(false);
        }
      }
    };

    loadBrandInfo();
    return () => {
      isSubscribed = false;
    };
  }, [selectedBrandId]);

  // =========================================================================
  // TAB 1: Brand Emails State & Logic
  // =========================================================================
  const [emails, setEmails] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailTotal, setEmailTotal] = useState(0);
  const [emailSearch, setEmailSearch] = useState('');
  const [emailPage, setEmailPage] = useState(1);
  const [emailPageSize, setEmailPageSize] = useState(10);
  const [emailSortProp, setEmailSortProp] = useState('brandEmailId');
  const [emailSortDesc, setEmailSortDesc] = useState(true);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [updatingEmailIds, setUpdatingEmailIds] = useState(new Set());
  // Existing SMTP secrets are deliberately never made visible in list views.
  const visiblePasswords = {};
  const togglePasswordVisibility = () => {};

  const fetchEmails = useCallback(async () => {
    if (!emailPerms.canView || !selectedBrandId) return;
    try {
      setEmailLoading(true);
      const res = await brandService.getBrandEmails({
        BrandId: selectedBrandId,
        Text: emailSearch.trim(),
        PageNumber: emailPage,
        PageSize: emailPageSize,
        SortProperty: emailSortProp,
        IsDescending: emailSortDesc
      });
      setEmails(res.data || []);
      setEmailTotal(res.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch brand emails:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch brand emails'));
      setEmails([]);
      setEmailTotal(0);
    } finally {
      setEmailLoading(false);
    }
  }, [emailPerms.canView, selectedBrandId, emailSearch, emailPage, emailPageSize, emailSortProp, emailSortDesc]);

  // Optimistic Toggle Email Active
  const handleToggleEmailActive = async (emailItem) => {
    if (!emailPerms.canUpdate || updatingEmailIds.has(emailItem.brandEmailId)) {
      toast.error('You do not have permission to edit email configurations.');
      return;
    }

    const previousStatus = emailItem.isActive;
    const newStatus = !previousStatus;

    setEmails((prev) =>
      prev.map((e) => (e.brandEmailId === emailItem.brandEmailId ? { ...e, isActive: newStatus } : e))
    );
    setUpdatingEmailIds((current) => new Set(current).add(emailItem.brandEmailId));

    try {
      await brandService.updateBrandEmail({
        ...emailItem,
        isActive: newStatus
      });
      toast.success('Brand email status updated');
      await fetchEmails();
    } catch (err) {
      console.error('Failed to update email status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update email status'));
      setEmails((prev) =>
        prev.map((e) => (e.brandEmailId === emailItem.brandEmailId ? { ...e, isActive: previousStatus } : e))
      );
    } finally {
      setUpdatingEmailIds((current) => {
        const next = new Set(current);
        next.delete(emailItem.brandEmailId);
        return next;
      });
    }
  };

  // =========================================================================
  // TAB 2: Gateways State & Logic
  // =========================================================================
  const [gateways, setGateways] = useState([]);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayTotal, setGatewayTotal] = useState(0);
  const [gatewaySearch, setGatewaySearch] = useState('');
  const [gatewayPage, setGatewayPage] = useState(1);
  const [gatewayPageSize, setGatewayPageSize] = useState(10);
  const [gatewaySortProp, setGatewaySortProp] = useState('gatewayId');
  const [gatewaySortDesc, setGatewaySortDesc] = useState(true);

  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);

  const [paymentTypeModalOpen, setPaymentTypeModalOpen] = useState(false);
  const [selectedGatewayForPaymentTypes, setSelectedGatewayForPaymentTypes] = useState(null);

  const fetchGateways = useCallback(async () => {
    if (!gatewayPerms.canView || !selectedBrandId) return;
    try {
      setGatewayLoading(true);
      const res = await brandService.getGateways({
        BrandId: selectedBrandId,
        Text: gatewaySearch.trim(),
        PageNumber: gatewayPage,
        PageSize: gatewayPageSize,
        SortProperty: gatewaySortProp,
        IsDescending: gatewaySortDesc
      });
      setGateways(res.data || []);
      setGatewayTotal(res.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch gateways:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch gateways'));
      setGateways([]);
      setGatewayTotal(0);
    } finally {
      setGatewayLoading(false);
    }
  }, [gatewayPerms.canView, selectedBrandId, gatewaySearch, gatewayPage, gatewayPageSize, gatewaySortProp, gatewaySortDesc]);

  // Optimistic Toggle Gateway Active
  const handleToggleGatewayActive = async (gw) => {
    if (!gatewayPerms.canUpdate) {
      toast.error('You do not have permission to edit gateways.');
      return;
    }

    const previousStatus = gw.isActive;
    const newStatus = !previousStatus;

    setGateways((prev) =>
      prev.map((g) => (g.gatewayId === gw.gatewayId ? { ...g, isActive: newStatus } : g))
    );

    try {
      await brandService.updateGateway({
        ...gw,
        isActive: newStatus
      });
      toast.success(`Gateway "${gw.gatewayName}" is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('Failed to update gateway status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update gateway status'));
      setGateways((prev) =>
        prev.map((g) => (g.gatewayId === gw.gatewayId ? { ...g, isActive: previousStatus } : g))
      );
    }
  };

  // =========================================================================
  // TAB 3: Templates State & Logic
  // =========================================================================
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState(10);
  const [templateSortProp, setTemplateSortProp] = useState('brandEmailTemplateId');
  const [templateSortDesc, setTemplateSortDesc] = useState(true);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const fetchTemplates = useCallback(async () => {
    if (!templatePerms.canView || !selectedBrandId) return;
    try {
      setTemplateLoading(true);
      const res = await brandService.getBrandEmailTemplates({
        BrandId: selectedBrandId,
        Text: templateSearch.trim(),
        PageNumber: templatePage,
        PageSize: templatePageSize,
        SortProperty: templateSortProp,
        IsDescending: templateSortDesc
      });
      setTemplates(res.data || []);
      setTemplateTotal(res.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch email templates'));
      setTemplates([]);
      setTemplateTotal(0);
    } finally {
      setTemplateLoading(false);
    }
  }, [templatePerms.canView, selectedBrandId, templateSearch, templatePage, templatePageSize, templateSortProp, templateSortDesc]);

  // Optimistic Toggle Template Active
  const handleToggleTemplateActive = async (tpl) => {
    if (!templatePerms.canUpdate) {
      toast.error('You do not have permission to edit email templates.');
      return;
    }

    const previousStatus = tpl.isActive;
    const newStatus = !previousStatus;

    setTemplates((prev) =>
      prev.map((t) => (t.brandEmailTemplateId === tpl.brandEmailTemplateId ? { ...t, isActive: newStatus } : t))
    );

    try {
      await brandService.updateBrandEmailTemplate({
        ...tpl,
        isActive: newStatus
      });
      toast.success(`Template "${tpl.templateName}" is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('Failed to update template status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update template status'));
      setTemplates((prev) =>
        prev.map((t) => (t.brandEmailTemplateId === tpl.brandEmailTemplateId ? { ...t, isActive: previousStatus } : t))
      );
    }
  };

  // Trigger data fetching depending on the currently selected tab
  useEffect(() => {
    if (!selectedBrandId) return;

    if (activeTab === 'email') {
      fetchEmails();
    } else if (activeTab === 'gateway') {
      fetchGateways();
    } else if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab, selectedBrandId, fetchEmails, fetchGateways, fetchTemplates]);

  // =========================================================================
  // Unified Delete Confirmation State
  // =========================================================================
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteConfig) return;
    setIsDeleting(true);
    try {
      if (deleteConfig.type === 'email') {
        await brandService.deleteBrandEmail(deleteConfig.id);
        toast.success(`Brand email "${deleteConfig.name}" was deleted.`);
        fetchEmails();
      } else if (deleteConfig.type === 'gateway') {
        await brandService.deleteGateway(deleteConfig.id);
        toast.success(`Gateway "${deleteConfig.name}" was deleted.`);
        fetchGateways();
      } else if (deleteConfig.type === 'template') {
        await brandService.deleteBrandEmailTemplate(deleteConfig.id);
        toast.success(`Template "${deleteConfig.name}" was deleted.`);
        fetchTemplates();
      }
      setDeleteModalOpen(false);
      setDeleteConfig(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      toast.error(getApiErrorMessage(err, `Failed to delete ${deleteConfig.type}`));
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper sort icon
  const renderSortIndicator = (currentProp, targetProp, isDesc) => {
    if (currentProp !== targetProp) {
      return <ArrowUpDown size={12} className="text-gray-400 opacity-60 inline ml-1" />;
    }
    return isDesc ? (
      <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    ) : (
      <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <button
            type="button"
            onClick={() => navigate('/settings/brand')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            <span>Back to Brands</span>
          </button>

          <div className="flex items-center gap-3">
            {/* Brand Logo thumbnail in header */}
            <div className="w-11 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden shadow-2xs">
              {brand?.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.brandName}
                  className="w-full h-full object-contain p-0.5"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <span
                style={{ display: brand?.logoUrl ? 'none' : 'flex' }}
                className="text-base font-bold text-purple-600 dark:text-purple-400 items-center justify-center w-full h-full uppercase"
              >
                {brand?.brandName?.charAt(0) || 'B'}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {brandLoading ? 'Loading brand...' : brand?.brandName || `Brand #${selectedBrandId}`}
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
                  ID: #{selectedBrandId}
                </span>
                {brand && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      brand.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {brand.isActive ? 'Active Brand' : 'Inactive Brand'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {brand?.brandDisplayName ? `${brand.brandDisplayName} • ` : ''}
                {brand?.supportEmail ? `Support: ${brand.supportEmail} • ` : ''}
                {brand?.tollfree ? `Toll-Free: ${brand.tollfree}` : 'Brand configurations and integration settings'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab-specific primary action button */}
        <div className="flex items-center gap-2">
          {activeTab === 'email' && emailPerms.canAdd && (
            <LiquidGlassButton
              onClick={() => {
                setEditingEmail(null);
                setEmailModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Brand Email</span>
            </LiquidGlassButton>
          )}

          {activeTab === 'gateway' && gatewayPerms.canAdd && (
            <LiquidGlassButton
              onClick={() => {
                setEditingGateway(null);
                setGatewayModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Gateway</span>
            </LiquidGlassButton>
          )}

          {activeTab === 'templates' && templatePerms.canAdd && (
            <LiquidGlassButton
              onClick={() => {
                setEditingTemplate(null);
                setTemplateModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Template</span>
            </LiquidGlassButton>
          )}
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-px">
        {accessibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                isActive
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Brand Email Table & Actions                                        */}
      {/* ========================================================================= */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                Showing {emails.length} of {emailTotal} Outbound Brand Emails
              </h3>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by email, username, host..."
                    value={emailSearch}
                    onChange={(e) => {
                      setEmailSearch(e.target.value);
                      setEmailPage(1);
                    }}
                    className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                  />
                  {emailSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSearch('');
                        setEmailPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={14} className="text-gray-500 dark:text-gray-300" />
                    </button>
                  )}
                </div>

                <TableRefreshButton onClick={fetchEmails} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Email Table */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    <th className="py-3.5 px-4 text-center w-14">#</th>
                    <th
                      onClick={() => {
                        if (emailSortProp === 'email') setEmailSortDesc(!emailSortDesc);
                        else {
                          setEmailSortProp('email');
                          setEmailSortDesc(true);
                        }
                      }}
                      className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Email Address {renderSortIndicator(emailSortProp, 'email', emailSortDesc)}
                    </th>
                    <th className="py-3.5 px-4 min-w-[150px]">Username</th>
                    <th className="py-3.5 px-4 min-w-[220px]">SMTP Server & Port</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Credential</th>
                    <th className="py-3.5 px-4 text-center w-28">Status</th>
                    <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {emailLoading && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <tr key={`skel-email-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-5 w-10 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {!emailLoading && emails.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <Mail size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No brand emails configured
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Add SMTP credentials for this brand to enable outgoing notifications and e-sign communications.
                          </p>
                          {emailPerms.canAdd && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmail(null);
                                setEmailModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Email Account
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!emailLoading &&
                    emails.map((eItem, idx) => {
                      const rowNum = (emailPage - 1) * emailPageSize + idx + 1;
                      const isPwdVisible = visiblePasswords[eItem.brandEmailId];
                      return (
                        <tr
                          key={eItem.brandEmailId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNum}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{eItem.email}</span>
                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                                #{eItem.brandEmailId}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            {eItem.userName || <span className="text-gray-400 italic">None</span>}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <span>{eItem.host}:{eItem.port}</span>
                              {eItem.sslEnable && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                  SSL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span>
                                {isPwdVisible
                                  ? eItem.password || '(not set)'
                                  : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(eItem.brandEmailId)}
                                className="hidden"
                                title={isPwdVisible ? 'Hide password' : 'Show password'}
                              >
                                {isPwdVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* Status Toggle (iOS Toggle) */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center scale-90">
                              <IosToggle
                                checked={Boolean(eItem.isActive)}
                                onCheckedChange={() => handleToggleEmailActive(eItem)}
                                disabled={!emailPerms.canUpdate || updatingEmailIds.has(eItem.brandEmailId)}
                                loading={updatingEmailIds.has(eItem.brandEmailId)}
                                title={eItem.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {emailPerms.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Email"
                                  onClick={() => {
                                    setEditingEmail(eItem);
                                    setEmailModalOpen(true);
                                  }}
                                />
                              )}
                              {emailPerms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Email"
                                  onClick={() => {
                                    setDeleteConfig({
                                      type: 'email',
                                      id: eItem.brandEmailId,
                                      name: eItem.email
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

            {/* Email Pagination */}
            {!emailLoading && emailTotal > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Showing {(emailPage - 1) * emailPageSize + 1} to{' '}
                  {Math.min(emailPage * emailPageSize, emailTotal)} of {emailTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={emailPage <= 1}
                    onClick={() => setEmailPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 font-medium">Page {emailPage}</span>
                  <button
                    type="button"
                    disabled={emailPage * emailPageSize >= emailTotal}
                    onClick={() => setEmailPage((p) => p + 1)}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Payment Gateways Table & Actions                                   */}
      {/* ========================================================================= */}
      {activeTab === 'gateway' && (
        <div className="space-y-4">
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

                <TableRefreshButton onClick={fetchGateways} className="shrink-0" />
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

                  {!gatewayLoading && gateways.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <CreditCard size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No payment gateways configured
                          </h4>
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
                        <tr
                          key={gw.gatewayId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNum}
                          </td>
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
                            {gw.lastSyncedAtUtc ? (
                              new Date(gw.lastSyncedAtUtc).toLocaleString()
                            ) : (
                              <span className="italic">Never synced</span>
                            )}
                          </td>

                          {/* Status Toggle (iOS Toggle) */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center scale-90">
                              <IosToggle
                                checked={Boolean(gw.isActive)}
                                onCheckedChange={() => handleToggleGatewayActive(gw)}
                                disabled={!gatewayPerms.canUpdate}
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
            {!gatewayLoading && gatewayTotal > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Showing {(gatewayPage - 1) * gatewayPageSize + 1} to{' '}
                  {Math.min(gatewayPage * gatewayPageSize, gatewayTotal)} of {gatewayTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={gatewayPage <= 1}
                    onClick={() => setGatewayPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 font-medium">Page {gatewayPage}</span>
                  <button
                    type="button"
                    disabled={gatewayPage * gatewayPageSize >= gatewayTotal}
                    onClick={() => setGatewayPage((p) => p + 1)}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Templates Table & Actions                                          */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                Showing {templates.length} of {templateTotal} Email Templates
              </h3>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search templates by name, subject..."
                    value={templateSearch}
                    onChange={(e) => {
                      setTemplateSearch(e.target.value);
                      setTemplatePage(1);
                    }}
                    className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateSearch('');
                        setTemplatePage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={14} className="text-gray-500 dark:text-gray-300" />
                    </button>
                  )}
                </div>

                <TableRefreshButton onClick={fetchTemplates} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Templates Table */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    <th className="py-3.5 px-4 text-center w-14">#</th>
                    <th
                      onClick={() => {
                        if (templateSortProp === 'templateName') setTemplateSortDesc(!templateSortDesc);
                        else {
                          setTemplateSortProp('templateName');
                          setTemplateSortDesc(true);
                        }
                      }}
                      className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Template Name {renderSortIndicator(templateSortProp, 'templateName', templateSortDesc)}
                    </th>
                    <th className="py-3.5 px-4 min-w-[180px]">Subject</th>
                    <th className="py-3.5 px-4 min-w-[180px]">From Sender Email</th>
                    <th className="py-3.5 px-4 min-w-[100px]">Master ID</th>
                    <th className="py-3.5 px-4 text-center w-28">Status</th>
                    <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {templateLoading && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <tr key={`skel-tpl-${i}`} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-5 w-10 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {!templateLoading && templates.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <FileText size={28} className="opacity-80" />
                          </div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            No brand templates configured
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Associate system templates with this brand and specify sender emails.
                          </p>
                          {templatePerms.canAdd && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(null);
                                setTemplateModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Email Template
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!templateLoading &&
                    templates.map((tpl, idx) => {
                      const rowNum = (templatePage - 1) * templatePageSize + idx + 1;
                      return (
                        <tr
                          key={tpl.brandEmailTemplateId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                            {rowNum}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{tpl.templateName}</span>
                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                                #{tpl.brandEmailTemplateId}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            {tpl.subject || <span className="text-gray-400 italic">No subject</span>}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            {tpl.fromEmail ? (
                              <div className="flex items-center gap-1">
                                <Mail size={12} className="text-gray-400 shrink-0" />
                                <span>{tpl.fromEmail}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">ID #{tpl.fromEmailId}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-gray-500">
                            #{tpl.templateId}
                          </td>

                          {/* Status Toggle (iOS Toggle) */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center scale-90">
                              <IosToggle
                                checked={Boolean(tpl.isActive)}
                                onCheckedChange={() => handleToggleTemplateActive(tpl)}
                                disabled={!templatePerms.canUpdate}
                                title={tpl.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {templatePerms.canUpdate && (
                                <ActionIconButton
                                  icon={Pencil}
                                  variant="edit"
                                  tooltip="Edit Template"
                                  onClick={() => {
                                    setEditingTemplate(tpl);
                                    setTemplateModalOpen(true);
                                  }}
                                />
                              )}
                              {templatePerms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Template"
                                  onClick={() => {
                                    setDeleteConfig({
                                      type: 'template',
                                      id: tpl.brandEmailTemplateId,
                                      name: tpl.templateName
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

            {/* Template Pagination */}
            {!templateLoading && templateTotal > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Showing {(templatePage - 1) * templatePageSize + 1} to{' '}
                  {Math.min(templatePage * templatePageSize, templateTotal)} of {templateTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={templatePage <= 1}
                    onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 font-medium">Page {templatePage}</span>
                  <button
                    type="button"
                    disabled={templatePage * templatePageSize >= templateTotal}
                    onClick={() => setTemplatePage((p) => p + 1)}
                    className="p-1 rounded-lg border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modals                                                                    */}
      {/* ========================================================================= */}

      {/* Brand Email Modal */}
      <BrandEmailModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEditingEmail(null);
        }}
        brand={brand}
        brandId={selectedBrandId}
        brandEmail={editingEmail}
        canAdd={emailPerms.canAdd}
        canUpdate={emailPerms.canUpdate}
        onSaved={() => {
          setEmailModalOpen(false);
          setEditingEmail(null);
          fetchEmails();
        }}
      />

      {/* Gateway Modal */}
      <GatewayModal
        isOpen={gatewayModalOpen}
        onClose={() => {
          setGatewayModalOpen(false);
          setEditingGateway(null);
        }}
        brandId={selectedBrandId}
        gateway={editingGateway}
        onSaved={() => {
          setGatewayModalOpen(false);
          setEditingGateway(null);
          fetchGateways();
        }}
      />

      {/* Gateway Payment Types Bulk Modal */}
      <GatewayPaymentTypeModal
        isOpen={paymentTypeModalOpen}
        onClose={() => {
          setPaymentTypeModalOpen(false);
          setSelectedGatewayForPaymentTypes(null);
        }}
        gateway={selectedGatewayForPaymentTypes}
        brandId={selectedBrandId}
        onSaved={() => {
          setPaymentTypeModalOpen(false);
          setSelectedGatewayForPaymentTypes(null);
          fetchGateways();
        }}
      />

      {/* Brand Template Modal */}
      <BrandTemplateModal
        isOpen={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        brandId={selectedBrandId}
        template={editingTemplate}
        onSaved={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
          fetchTemplates();
        }}
      />

      {/* Unified Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setDeleteConfig(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete ${
          deleteConfig?.type === 'email'
            ? 'Brand Email'
            : deleteConfig?.type === 'gateway'
            ? 'Payment Gateway'
            : 'Email Template'
        }`}
        description="Are you sure you want to delete"
        itemName={deleteConfig?.name || 'this record'}
        details={deleteConfig ? [{ label: 'Record ID', value: deleteConfig.id }] : []}
        loading={isDeleting}
      />
    </div>
  );
};

export default BrandDetailsPage;
