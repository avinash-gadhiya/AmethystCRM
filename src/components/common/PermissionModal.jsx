import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Minus } from 'lucide-react';

import GlassCloseButton from './GlassCloseButton';
import LiquidGlassButton from './LiquidGlassButton';

const getPages = (menu) => menu?.menuPermissionPageDTOs || [];
const getPermissions = (page) => page?.menuPagePermissionDTOs || [];

const getSelectionState = (values, fallback = false) => {
  if (values.length === 0) {
    const selected = Boolean(fallback);
    return { all: selected, any: selected, checked: selected };
  }

  const all = values.every(Boolean);
  const any = values.some(Boolean);
  return { all, any, checked: all ? true : any ? 'indeterminate' : false };
};

const getPageState = (page) =>
  getSelectionState(
    getPermissions(page).map((permission) => Boolean(permission.hasPermission ?? permission.isGranted)),
    page?.hasPermission ?? page?.isGranted
  );

const getMenuState = (menu) =>
  getSelectionState(
    getPages(menu).map((page) => getPageState(page).all),
    menu?.hasPermission ?? menu?.isGranted
  );

const updateAll = (tree, checked) =>
  tree.map((menu) => ({
    ...menu,
    hasPermission: checked,
    isGranted: checked,
    menuPermissionPageDTOs: getPages(menu).map((page) => ({
      ...page,
      hasPermission: checked,
      isGranted: checked,
      menuPagePermissionDTOs: getPermissions(page).map((permission) => ({
        ...permission,
        hasPermission: checked,
        isGranted: checked
      }))
    }))
  }));

const updateMenu = (tree, menuIndex, checked) =>
  tree.map((menu, currentMenuIndex) =>
    currentMenuIndex !== menuIndex
      ? menu
      : {
          ...menu,
          hasPermission: checked,
          isGranted: checked,
          menuPermissionPageDTOs: getPages(menu).map((page) => ({
            ...page,
            hasPermission: checked,
            isGranted: checked,
            menuPagePermissionDTOs: getPermissions(page).map((permission) => ({
              ...permission,
              hasPermission: checked,
              isGranted: checked
            }))
          }))
        }
  );

const updatePage = (tree, menuIndex, pageIndex, checked) =>
  tree.map((menu, currentMenuIndex) => {
    if (currentMenuIndex !== menuIndex) return menu;

    const pages = getPages(menu).map((page, currentPageIndex) =>
      currentPageIndex !== pageIndex
        ? page
        : {
            ...page,
            hasPermission: checked,
            isGranted: checked,
            menuPagePermissionDTOs: getPermissions(page).map((permission) => ({
              ...permission,
              hasPermission: checked,
              isGranted: checked
            }))
          }
    );

    return {
      ...menu,
      hasPermission: pages.length > 0 ? pages.every((page) => getPageState(page).all) : checked,
      isGranted: pages.length > 0 ? pages.every((page) => getPageState(page).all) : checked,
      menuPermissionPageDTOs: pages
    };
  });

const updatePermission = (tree, menuIndex, pageIndex, permissionIndex, checked) =>
  tree.map((menu, currentMenuIndex) => {
    if (currentMenuIndex !== menuIndex) return menu;

    const pages = getPages(menu).map((page, currentPageIndex) => {
      if (currentPageIndex !== pageIndex) return page;

      const permissions = getPermissions(page).map((permission, currentPermissionIndex) =>
        currentPermissionIndex === permissionIndex
          ? { ...permission, hasPermission: checked, isGranted: checked }
          : permission
      );

      return {
        ...page,
        hasPermission: permissions.length > 0 && permissions.every((permission) => Boolean(permission.hasPermission ?? permission.isGranted)),
        isGranted: permissions.length > 0 && permissions.every((permission) => Boolean(permission.hasPermission ?? permission.isGranted)),
        menuPagePermissionDTOs: permissions
      };
    });

    return {
      ...menu,
      hasPermission: pages.length > 0 && pages.every((page) => getPageState(page).all),
      isGranted: pages.length > 0 && pages.every((page) => getPageState(page).all),
      menuPermissionPageDTOs: pages
    };
  });

const toggleMenu = (tree, menuIndex) =>
  tree.map((menu, currentMenuIndex) =>
    currentMenuIndex === menuIndex ? { ...menu, isExpanded: !menu.isExpanded } : menu
  );

const togglePage = (tree, menuIndex, pageIndex) =>
  tree.map((menu, currentMenuIndex) => {
    if (currentMenuIndex !== menuIndex) return menu;
    return {
      ...menu,
      menuPermissionPageDTOs: getPages(menu).map((page, currentPageIndex) =>
        currentPageIndex === pageIndex ? { ...page, isExpanded: !page.isExpanded } : page
      )
    };
  });

const PermissionCheckbox = ({ checked, disabled, label, onChange }) => {
  const selected = checked === true;
  const indeterminate = checked === 'indeterminate';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : selected}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange?.(!selected);
      }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border outline-none transition focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500'
          : indeterminate
            ? 'border-purple-600 bg-purple-100 text-purple-700 dark:border-purple-400 dark:bg-purple-500/25 dark:text-purple-300'
            : 'border-gray-300 bg-white text-transparent hover:border-purple-400 dark:border-white/20 dark:bg-white/5'
      }`}
    >
      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      {indeterminate && <Minus className="h-3.5 w-3.5 stroke-[3]" />}
    </button>
  );
};

const ActiveBadge = ({ active, activeText = 'Active', inactiveText = 'Deactive' }) => (
  <span
    className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
      active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400'
    }`}
  >
    {active ? activeText : inactiveText}
  </span>
);

const Arrow = ({ expanded }) => (
  <ChevronRight
    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
    aria-hidden="true"
  />
);

const PermissionModal = ({
  open,
  title = 'Role Permissions',
  subtitle,
  permissions = [],
  loading = false,
  saving = false,
  onPermissionsChange,
  onClose,
  onSave
}) => {
  const tree = Array.isArray(permissions) ? permissions : [];

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose?.();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open || loading || tree.length === 0) return;
    const missingExpansionState = tree.some(
      (menu) =>
        typeof menu.isExpanded !== 'boolean' ||
        getPages(menu).some((page) => typeof page.isExpanded !== 'boolean')
    );
    if (!missingExpansionState) return;

    onPermissionsChange?.(
      tree.map((menu, menuIndex) => ({
        ...menu,
        isExpanded:
          typeof menu.isExpanded === 'boolean'
            ? menu.isExpanded
            : menuIndex === 0 && getPages(menu).length > 0,
        menuPermissionPageDTOs: getPages(menu).map((page, pageIndex) => ({
          ...page,
          isExpanded:
            typeof page.isExpanded === 'boolean'
              ? page.isExpanded
              : menuIndex === 0 && pageIndex === 0 && getPermissions(page).length > 0
        }))
      }))
    );
  }, [open, loading, tree, onPermissionsChange]);

  if (!open || typeof document === 'undefined') return null;

  const change = (updater) => onPermissionsChange?.(updater(tree));
  const selectAllState = getSelectionState(tree.map((menu) => getMenuState(menu).all));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[40rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slide-in dark:border-white/10 dark:bg-[#17132a] sm:max-h-[90vh]">
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#1d1733]/95 sm:px-6">
          <div className="min-w-0">
            <h2 id="permission-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
              {title || 'Role Permissions'}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <GlassCloseButton className="shrink-0" onClick={onClose} disabled={saving} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 dark:border-purple-900 dark:border-t-purple-400" />
              <span className="text-sm font-medium">Loading permissions...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              No permissions available
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
                <PermissionCheckbox
                  checked={selectAllState.checked}
                  disabled={saving}
                  label="Select all permissions"
                  onChange={(checked) => change((currentTree) => updateAll(currentTree, checked))}
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Select All</span>
              </div>

              <div className="space-y-3">
                {tree.map((menu, menuIndex) => {
                  const pages = getPages(menu);
                  const menuState = getMenuState(menu);
                  const grantedPages = pages.filter((page) => getPageState(page).all).length;
                  const menuKey = menu.menuId ?? `menu-${menuIndex}`;

                  return (
                    <section key={menuKey} className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                      <div
                        className={`flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors ${pages.length ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : ''}`}
                        onClick={() => pages.length && change((currentTree) => toggleMenu(currentTree, menuIndex))}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <PermissionCheckbox
                            checked={menuState.checked}
                            disabled={saving}
                            label={`Toggle ${menu.menuName || 'menu'} permissions`}
                            onChange={(checked) => change((currentTree) => updateMenu(currentTree, menuIndex, checked))}
                          />
                          <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {menu.menuName || 'Unnamed menu'}
                          </span>
                        </div>
                        {pages.length ? (
                          <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{grantedPages}/{pages.length}</span>
                            <Arrow expanded={Boolean(menu.isExpanded)} />
                          </div>
                        ) : (
                          <ActiveBadge
                            active={Boolean(menu.hasPermission ?? menu.isGranted)}
                            activeText="Active"
                            inactiveText="Deactive"
                          />
                        )}
                      </div>

                      {menu.isExpanded && pages.length > 0 && (
                        <div className="space-y-2 border-t border-gray-200 bg-gray-50/80 p-3 pl-5 dark:border-white/10 dark:bg-black/10 sm:pl-7">
                          {pages.map((page, pageIndex) => {
                            const pagePermissions = getPermissions(page);
                            const pageState = getPageState(page);
                            const grantedPermissions = pagePermissions.filter((permission) => Boolean(permission.hasPermission ?? permission.isGranted)).length;
                            const pageKey = page.pageId ?? `${menuKey}-page-${pageIndex}`;

                            return (
                              <div key={pageKey} className="space-y-2">
                                <div
                                  className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 transition-colors dark:border-white/10 dark:bg-[#1d1733] ${pagePermissions.length ? 'cursor-pointer hover:border-purple-200 hover:bg-purple-50/30 dark:hover:border-purple-500/30' : ''}`}
                                  onClick={() => pagePermissions.length && change((currentTree) => togglePage(currentTree, menuIndex, pageIndex))}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <PermissionCheckbox
                                      checked={pageState.checked}
                                      disabled={saving}
                                      label={`Toggle ${page.pageDisplayName || page.pageName || 'page'} permissions`}
                                      onChange={(checked) => change((currentTree) => updatePage(currentTree, menuIndex, pageIndex, checked))}
                                    />
                                    <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                                      {page.pageDisplayName || page.pageName || 'Unnamed page'}
                                    </span>
                                  </div>
                                  {pagePermissions.length ? (
                                    <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                      <span>{grantedPermissions}/{pagePermissions.length}</span>
                                      <Arrow expanded={Boolean(page.isExpanded)} />
                                    </div>
                                  ) : (
                                    <ActiveBadge
                                      active={Boolean(page.hasPermission ?? page.isGranted)}
                                      activeText="Active"
                                      inactiveText="Deactive"
                                    />
                                  )}
                                </div>

                                {page.isExpanded && pagePermissions.length > 0 && (
                                  <div className="ml-4 space-y-1.5 border-l border-gray-200 pl-3 dark:border-white/10 sm:ml-8 sm:pl-4">
                                    {pagePermissions.map((permission, permissionIndex) => {
                                      const isAllocated = Boolean(permission.hasPermission ?? permission.isGranted);
                                      return (
                                        <div
                                          key={permission.pagePermissionId ?? `${pageKey}-permission-${permissionIndex}`}
                                          className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100/80 dark:border-white/10 dark:bg-white/[0.03]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2.5">
                                            <PermissionCheckbox
                                              checked={isAllocated}
                                              disabled={saving}
                                              label={`Toggle ${permission.permissionName || permission.permissionCode || 'permission'}`}
                                              onChange={(checked) =>
                                                change((currentTree) =>
                                                  updatePermission(currentTree, menuIndex, pageIndex, permissionIndex, checked)
                                                )
                                              }
                                            />
                                            <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-300 sm:text-sm">
                                              {permission.permissionName || permission.permissionCode || 'Unnamed permission'}
                                            </span>
                                          </div>
                                          <ActiveBadge
                                            active={isAllocated}
                                            activeText="Active"
                                            inactiveText="Deactive"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-[#1d1733]/95 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200"
          >
            Cancel
          </button>
          <LiquidGlassButton
            type="button"
            onClick={onSave}
            disabled={loading || saving}
            loading={saving}
            className="min-w-[150px] px-4 py-2.5 text-sm font-semibold sm:min-w-[190px]"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </LiquidGlassButton>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default PermissionModal;
