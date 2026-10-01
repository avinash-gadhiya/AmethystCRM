import BrandTemplatesTab from './BrandTemplatesTab';
import BrandGatewayTab from './BrandGatewayTab';
import BrandEmailTab from './BrandEmailTab';
import { Plus } from 'lucide-react';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CreditCard, FileText, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast, Toaster } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveBrandPermissions } from '@/utils/brandPermissions';

import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';

import BrandEmailModal from '@/components/brand/BrandEmailModal';
import GatewayModal from '@/components/brand/GatewayModal';
import GatewayPaymentTypeModal from '@/components/brand/GatewayPaymentTypeModal';
import BrandTemplateModal from '@/components/brand/BrandTemplateModal';

const GATEWAY_TYPE_NAMES = {
  0: 'Unknown',
  1: 'Authorize.Net',
  2: 'NMI',
  3: 'Nuvei'
};

const BrandTabsPage = () => {
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
      tabs.push({ id: 'email', label: 'Email', icon: Mail, perms: emailPerms });
    }
    if (gatewayPerms.canView) {
      tabs.push({ id: 'gateway', label: 'Gateway', icon: CreditCard, perms: gatewayPerms });
    }
    if (templatePerms.canView) {
      tabs.push({ id: 'templates', label: 'Templates', icon: FileText, perms: templatePerms });
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

  useEffect(() => {
    if (accessibleTabs.length && requestedTab !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, requestedTab, accessibleTabs.length, searchParams, setSearchParams]);

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

  const emailRequestRef = useRef(0);
  const [emailError, setEmailsError] = useState('');
  const fetchEmails = useCallback(async () => {
    if (!emailPerms.canView || !selectedBrandId) return;
    const requestId = ++emailRequestRef.current;
    try {
      setEmailsError('');
      setEmailLoading(true);
      const res = await brandService.getBrandEmails({
        BrandId: selectedBrandId,
        Text: emailSearch.trim(),
        PageNumber: emailPage,
        PageSize: emailPageSize,
        SortProperty: emailSortProp,
        IsDescending: emailSortDesc
      });
      if (requestId !== emailRequestRef.current) return;
      setEmails(res.data || []);
      setEmailTotal(res.totalCount || 0);
      if (emailPage > 1 && emailPage > Math.max(1, Math.ceil(res.totalCount / emailPageSize)))
        setEmailPage(Math.max(1, Math.ceil(res.totalCount / emailPageSize)));
    } catch (err) {
      if (requestId !== emailRequestRef.current) return;
      setEmailsError(getApiErrorMessage(err, 'Failed to load records'));
      console.error('Failed to fetch brand emails:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch brand emails'));
      setEmails([]);
      setEmailTotal(0);
    } finally {
      if (requestId === emailRequestRef.current) setEmailLoading(false);
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

    setEmails((prev) => prev.map((e) => (e.brandEmailId === emailItem.brandEmailId ? { ...e, isActive: newStatus } : e)));
    setUpdatingEmailIds((current) => new Set(current).add(emailItem.brandEmailId));

    try {
      await brandService.updateBrandEmail({
        ...emailItem,
        password: undefined,
        isActive: newStatus
      });
      toast.success('Brand email status updated');
      await fetchEmails();
    } catch (err) {
      console.error('Failed to update email status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update email status'));
      setEmails((prev) => prev.map((e) => (e.brandEmailId === emailItem.brandEmailId ? { ...e, isActive: previousStatus } : e)));
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
  const [pendingStatus, setPendingStatus] = useState(new Set());
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

  const gatewayRequestRef = useRef(0);
  const [gatewayError, setGatewaysError] = useState('');
  const fetchGateways = useCallback(async () => {
    if (!gatewayPerms.canView || !selectedBrandId) return;
    const requestId = ++gatewayRequestRef.current;
    try {
      setGatewaysError('');
      setGatewayLoading(true);
      const res = await brandService.getGateways({
        BrandId: selectedBrandId,
        Text: gatewaySearch.trim(),
        PageNumber: gatewayPage,
        PageSize: gatewayPageSize,
        SortProperty: gatewaySortProp,
        IsDescending: gatewaySortDesc
      });
      if (requestId !== gatewayRequestRef.current) return;
      setGateways(res.data || []);
      setGatewayTotal(res.totalCount || 0);
      if (gatewayPage > 1 && gatewayPage > Math.max(1, Math.ceil(res.totalCount / gatewayPageSize)))
        setGatewayPage(Math.max(1, Math.ceil(res.totalCount / gatewayPageSize)));
    } catch (err) {
      if (requestId !== gatewayRequestRef.current) return;
      setGatewaysError(getApiErrorMessage(err, 'Failed to load records'));
      console.error('Failed to fetch gateways:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch gateways'));
      setGateways([]);
      setGatewayTotal(0);
    } finally {
      if (requestId === gatewayRequestRef.current) setGatewayLoading(false);
    }
  }, [gatewayPerms.canView, selectedBrandId, gatewaySearch, gatewayPage, gatewayPageSize, gatewaySortProp, gatewaySortDesc]);

  // Optimistic Toggle Gateway Active
  const handleToggleGatewayActive = async (gw) => {
    if (!gatewayPerms.canUpdate || pendingStatus.has(`gateway:${gw.gatewayId}`)) {
      toast.error('You do not have permission to edit gateways.');
      return;
    }

    const pendingKey = `gateway:${gw.gatewayId}`;
    setPendingStatus((ids) => new Set(ids).add(pendingKey));
    const previousStatus = gw.isActive;
    const newStatus = !previousStatus;

    setGateways((prev) => prev.map((g) => (g.gatewayId === gw.gatewayId ? { ...g, isActive: newStatus } : g)));

    try {
      await brandService.updateGateway({
        ...gw,
        isActive: newStatus
      });
      toast.success(`Gateway "${gw.gatewayName}" is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('Failed to update gateway status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update gateway status'));
      setGateways((prev) => prev.map((g) => (g.gatewayId === gw.gatewayId ? { ...g, isActive: previousStatus } : g)));
    } finally {
      setPendingStatus((ids) => {
        const next = new Set(ids);
        next.delete(pendingKey);
        return next;
      });
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

  const templateRequestRef = useRef(0);
  const [templateError, setTemplatesError] = useState('');
  const fetchTemplates = useCallback(async () => {
    if (!templatePerms.canView || !selectedBrandId) return;
    const requestId = ++templateRequestRef.current;
    try {
      setTemplatesError('');
      setTemplateLoading(true);
      const res = await brandService.getBrandEmailTemplates({
        BrandId: selectedBrandId,
        Text: templateSearch.trim(),
        PageNumber: templatePage,
        PageSize: templatePageSize,
        SortProperty: templateSortProp,
        IsDescending: templateSortDesc
      });
      if (requestId !== templateRequestRef.current) return;
      setTemplates(res.data || []);
      setTemplateTotal(res.totalCount || 0);
      if (templatePage > 1 && templatePage > Math.max(1, Math.ceil(res.totalCount / templatePageSize)))
        setTemplatePage(Math.max(1, Math.ceil(res.totalCount / templatePageSize)));
    } catch (err) {
      if (requestId !== templateRequestRef.current) return;
      setTemplatesError(getApiErrorMessage(err, 'Failed to load records'));
      console.error('Failed to fetch templates:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch email templates'));
      setTemplates([]);
      setTemplateTotal(0);
    } finally {
      if (requestId === templateRequestRef.current) setTemplateLoading(false);
    }
  }, [templatePerms.canView, selectedBrandId, templateSearch, templatePage, templatePageSize, templateSortProp, templateSortDesc]);

  // Optimistic Toggle Template Active
  const handleToggleTemplateActive = async (tpl) => {
    if (!templatePerms.canUpdate || pendingStatus.has(`template:${tpl.brandEmailTemplateId}`)) {
      toast.error('You do not have permission to edit email templates.');
      return;
    }

    const pendingKey = `template:${tpl.brandEmailTemplateId}`;
    setPendingStatus((ids) => new Set(ids).add(pendingKey));
    const previousStatus = tpl.isActive;
    const newStatus = !previousStatus;

    setTemplates((prev) => prev.map((t) => (t.brandEmailTemplateId === tpl.brandEmailTemplateId ? { ...t, isActive: newStatus } : t)));

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
    } finally {
      setPendingStatus((ids) => {
        const next = new Set(ids);
        next.delete(pendingKey);
        return next;
      });
    }
  };

  useEffect(() => {
    setEmailPage(1);
    setGatewayPage(1);
    setTemplatePage(1);
    return () => {
      emailRequestRef.current++;
      gatewayRequestRef.current++;
      templateRequestRef.current++;
    };
  }, [selectedBrandId]);

  // Trigger data fetching depending on the currently selected tab
  useEffect(() => {
    if (!selectedBrandId) return;

    if (activeTab === 'email') {
      fetchEmails();
    } else if (activeTab === 'gateway') {
      brandService.clearGatewayCache();
      Promise.all([brandService.getPaymentTypes(), brandService.getGatewayPaymentTypes({ BrandId: selectedBrandId })]).catch((err) =>
        toast.error(getApiErrorMessage(err, 'Failed to load payment assignments'))
      );
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

  if (!selectedBrandId || !accessibleTabs.length)
    return (
      <div role="alert" className="p-6 text-gray-600 dark:text-gray-300">
        {!selectedBrandId ? 'Select a brand to manage its settings.' : 'You do not have permission to view this brand?s settings.'}
        <button className="ml-3 text-purple-600" onClick={() => navigate('/settings/brand')}>
          Back to Brands
        </button>
      </div>
    );

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
      {activeTab === 'email' && emailPerms.canView && (
        <BrandEmailTab
          emailError={emailError}
          emails={emails}
          emailTotal={emailTotal}
          emailSearch={emailSearch}
          setEmailSearch={setEmailSearch}
          setEmailPage={setEmailPage}
          fetchEmails={fetchEmails}
          emailSortProp={emailSortProp}
          setEmailSortDesc={setEmailSortDesc}
          emailSortDesc={emailSortDesc}
          setEmailSortProp={setEmailSortProp}
          renderSortIndicator={renderSortIndicator}
          emailLoading={emailLoading}
          emailPerms={emailPerms}
          setEditingEmail={setEditingEmail}
          setEmailModalOpen={setEmailModalOpen}
          emailPage={emailPage}
          emailPageSize={emailPageSize}
          setEmailPageSize={setEmailPageSize}
          visiblePasswords={visiblePasswords}
          togglePasswordVisibility={togglePasswordVisibility}
          handleToggleEmailActive={handleToggleEmailActive}
          updatingEmailIds={updatingEmailIds}
          setDeleteConfig={setDeleteConfig}
          setDeleteModalOpen={setDeleteModalOpen}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Payment Gateways Table & Actions                                   */}
      {/* ========================================================================= */}
      {activeTab === 'gateway' && gatewayPerms.canView && (
        <BrandGatewayTab
          gatewayError={gatewayError}
          gateways={gateways}
          gatewayTotal={gatewayTotal}
          gatewaySearch={gatewaySearch}
          setGatewaySearch={setGatewaySearch}
          setGatewayPage={setGatewayPage}
          fetchGateways={fetchGateways}
          gatewaySortProp={gatewaySortProp}
          setGatewaySortDesc={setGatewaySortDesc}
          gatewaySortDesc={gatewaySortDesc}
          setGatewaySortProp={setGatewaySortProp}
          renderSortIndicator={renderSortIndicator}
          gatewayLoading={gatewayLoading}
          gatewayPerms={gatewayPerms}
          pendingStatus={pendingStatus}
          setEditingGateway={setEditingGateway}
          setGatewayModalOpen={setGatewayModalOpen}
          gatewayPage={gatewayPage}
          gatewayPageSize={gatewayPageSize}
          setGatewayPageSize={setGatewayPageSize}
          GATEWAY_TYPE_NAMES={GATEWAY_TYPE_NAMES}
          handleToggleGatewayActive={handleToggleGatewayActive}
          setSelectedGatewayForPaymentTypes={setSelectedGatewayForPaymentTypes}
          setPaymentTypeModalOpen={setPaymentTypeModalOpen}
          setDeleteConfig={setDeleteConfig}
          setDeleteModalOpen={setDeleteModalOpen}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Templates Table & Actions                                          */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && templatePerms.canView && (
        <BrandTemplatesTab
          templateError={templateError}
          templates={templates}
          templateTotal={templateTotal}
          templateSearch={templateSearch}
          setTemplateSearch={setTemplateSearch}
          setTemplatePage={setTemplatePage}
          fetchTemplates={fetchTemplates}
          templateSortProp={templateSortProp}
          setTemplateSortDesc={setTemplateSortDesc}
          templateSortDesc={templateSortDesc}
          setTemplateSortProp={setTemplateSortProp}
          renderSortIndicator={renderSortIndicator}
          templateLoading={templateLoading}
          templatePerms={templatePerms}
          pendingStatus={pendingStatus}
          setEditingTemplate={setEditingTemplate}
          setTemplateModalOpen={setTemplateModalOpen}
          templatePage={templatePage}
          templatePageSize={templatePageSize}
          setTemplatePageSize={setTemplatePageSize}
          handleToggleTemplateActive={handleToggleTemplateActive}
          setDeleteConfig={setDeleteConfig}
          setDeleteModalOpen={setDeleteModalOpen}
        />
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
        open={gatewayModalOpen}
        onClose={() => {
          setGatewayModalOpen(false);
          setEditingGateway(null);
        }}
        brand={brand || { brandId: selectedBrandId }}
        gateway={editingGateway}
        onSuccess={() => {
          setGatewayModalOpen(false);
          setEditingGateway(null);
          fetchGateways();
        }}
      />

      {/* Gateway Payment Types Bulk Modal */}
      <GatewayPaymentTypeModal
        open={paymentTypeModalOpen}
        onClose={() => {
          setPaymentTypeModalOpen(false);
          setSelectedGatewayForPaymentTypes(null);
        }}
        permissions={gatewayPerms}
        gateway={selectedGatewayForPaymentTypes}
        brand={brand || { brandId: selectedBrandId }}
        onSuccess={() => {
          setPaymentTypeModalOpen(false);
          setSelectedGatewayForPaymentTypes(null);
          fetchGateways();
        }}
      />

      {/* Brand Template Modal */}
      <BrandTemplateModal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        brand={brand || { brandId: selectedBrandId }}
        template={editingTemplate}
        onSuccess={() => {
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
          deleteConfig?.type === 'email' ? 'Brand Email' : deleteConfig?.type === 'gateway' ? 'Payment Gateway' : 'Email Template'
        }`}
        description="Are you sure you want to delete"
        itemName={deleteConfig?.name || 'this record'}
        details={deleteConfig ? [{ label: 'Record ID', value: deleteConfig.id }] : []}
        loading={isDeleting}
      />
    </div>
  );
};

export default BrandTabsPage;
