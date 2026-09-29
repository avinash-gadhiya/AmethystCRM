import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus } from 'lucide-react';
import LiquidGlassButton from './LiquidGlassButton';
import GlassCloseButton from './GlassCloseButton';

// ---------------------------------------------------------------------------
// Self-contained Custom Checkbox supporting checked & indeterminate
// ---------------------------------------------------------------------------
const CustomCheckbox = ({ checked, onCheckedChange, disabled = false, className = '', ...props }) => {
  const isIndeterminate = checked === 'indeterminate';
  const isChecked = checked === true;

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onCheckedChange?.(!isChecked);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndeterminate ? 'mixed' : isChecked}
      disabled={disabled}
      onClick={handleClick}
      className={`size-4.5 rounded-md border flex items-center justify-center transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 ${
        isChecked
          ? 'bg-purple-600 border-purple-600 text-white'
          : isIndeterminate
          ? 'bg-purple-600/20 border-purple-600 text-purple-600 dark:bg-purple-500/30 dark:border-purple-400 dark:text-purple-300'
          : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 hover:border-purple-400 text-transparent'
      } ${className}`.trim()}
      {...props}
    >
      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      {isIndeterminate && <Minus className="w-3.5 h-3.5 stroke-[3]" />}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Helpers (pure, no state)
// ---------------------------------------------------------------------------

const getPageMeta = (page) => {
  const perms = page?.menuPagePermissionDTOs || [];
  if (perms.length === 0) {
    const v = !!page?.hasPermission;
    return { all: v, any: v };
  }
  return {
    all: perms.every((p) => !!p.hasPermission),
    any: perms.some((p) => !!p.hasPermission)
  };
};

const getPageChecked = (page) => {
  const { all, any } = getPageMeta(page);
  if (all) return true;
  if (any) return 'indeterminate';
  return false;
};

const getMenuMeta = (menu) => {
  const pages = menu?.menuPermissionPageDTOs || [];
  if (pages.length === 0) {
    const v = !!menu?.hasPermission;
    return { all: v, any: v };
  }
  return {
    all: pages.every((p) => getPageMeta(p).all),
    any: pages.some((p) => getPageMeta(p).any)
  };
};

const getMenuChecked = (menu) => {
  const { all, any } = getMenuMeta(menu);
  if (all) return true;
  if (any) return 'indeterminate';
  return false;
};

const getSelectAllChecked = (permissions) => {
  if (!permissions?.length) return false;
  const all = permissions.every((m) => getMenuMeta(m).all);
  const any = permissions.some((m) => getMenuMeta(m).any);
  if (all) return true;
  return any ? 'indeterminate' : false;
};

// ---------------------------------------------------------------------------
// Immutable update helpers
// ---------------------------------------------------------------------------

const applyPermissionToggle = (permissions, menuIndex, pageIndex, permIndex) => {
  return permissions.map((menu, mi) => {
    if (mi !== menuIndex) return menu;

    const pages = (menu.menuPermissionPageDTOs || []).map((page, pi) => {
      if (pi !== pageIndex && pageIndex !== undefined) return page;

      if (pageIndex === undefined) {
        // Menu-level toggle
        const newVal = !menu.hasPermission;
        return {
          ...page,
          hasPermission: newVal,
          menuPagePermissionDTOs: (page.menuPagePermissionDTOs || []).map((p) => ({
            ...p,
            hasPermission: newVal
          }))
        };
      }

      if (permIndex === undefined) {
        // Page-level toggle
        const newVal = !page.hasPermission;
        return {
          ...page,
          hasPermission: newVal,
          menuPagePermissionDTOs: (page.menuPagePermissionDTOs || []).map((p) => ({
            ...p,
            hasPermission: newVal
          }))
        };
      }

      // Permission-level toggle
      const perms = (page.menuPagePermissionDTOs || []).map((p, idx) =>
        idx === permIndex ? { ...p, hasPermission: !p.hasPermission } : p
      );
      const allGranted = perms.length > 0 ? perms.every((p) => !!p.hasPermission) : !!page.hasPermission;
      return { ...page, hasPermission: allGranted, menuPagePermissionDTOs: perms };
    });

    if (pageIndex === undefined) {
      const newVal = !menu.hasPermission;
      return { ...menu, hasPermission: newVal, menuPermissionPageDTOs: pages };
    }

    const menuGranted = pages.length > 0 ? pages.every((p) => !!p.hasPermission) : !!menu.hasPermission;
    return { ...menu, hasPermission: menuGranted, menuPermissionPageDTOs: pages };
  });
};

const applySelectAll = (permissions, checked) =>
  permissions.map((menu) => ({
    ...menu,
    hasPermission: checked,
    menuPermissionPageDTOs: (menu.menuPermissionPageDTOs || []).map((page) => ({
      ...page,
      hasPermission: checked,
      menuPagePermissionDTOs: (page.menuPagePermissionDTOs || []).map((p) => ({
        ...p,
        hasPermission: checked
      }))
    }))
  }));

const toggleMenuExpand = (permissions, menuIndex) =>
  permissions.map((m, idx) => (idx === menuIndex ? { ...m, isExpanded: !m.isExpanded } : m));

const togglePageExpand = (permissions, menuIndex, pageIndex) =>
  permissions.map((m, mi) => {
    if (mi !== menuIndex) return m;
    const pages = (m.menuPermissionPageDTOs || []).map((p, pi) =>
      pi === pageIndex ? { ...p, isExpanded: !p.isExpanded } : p
    );
    return { ...m, menuPermissionPageDTOs: pages };
  });

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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
  if (!open) return null;

  const change = (updater) => {
    onPermissionsChange?.(updater(permissions));
  };

  const handleSelectAll = () => {
    const current = getSelectAllChecked(permissions);
    const nextVal = current !== true;
    change((p) => applySelectAll(p, nextVal));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">{subtitle}</p>
            )}
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 dark:bg-[#17132a]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500 dark:text-gray-400">
              <span className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading permissions...</span>
            </div>
          ) : !permissions || permissions.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No permissions available
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1d1733]">
                <div className="flex items-center gap-3">
                  <CustomCheckbox
                    checked={getSelectAllChecked(permissions)}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Select All</span>
                </div>
              </div>

              {/* Three-level tree */}
              <div className="space-y-3">
                {permissions.map((menu, menuIndex) => (
                  <div
                    key={menu.menuId || menuIndex}
                    className="border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#1d1733] overflow-hidden"
                  >
                    {/* Menu row */}
                    <div
                      className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer rounded-lg transition-colors"
                      onClick={() => {
                        if (menu.menuPermissionPageDTOs?.length > 0) {
                          change((p) => toggleMenuExpand(p, menuIndex));
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <CustomCheckbox
                          checked={getMenuChecked(menu)}
                          onCheckedChange={() =>
                            change((p) => applyPermissionToggle(p, menuIndex, undefined, undefined))
                          }
                        />
                        <span className="font-medium text-gray-800 dark:text-white">{menu.menuName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        {menu.menuPermissionPageDTOs?.length > 0 ? (
                          <>
                            <span className="text-xs">
                              {menu.menuPermissionPageDTOs.filter((p) => p.hasPermission).length}/
                              {menu.menuPermissionPageDTOs.length}
                            </span>
                            <span className="text-gray-400 dark:text-gray-300 text-xs">
                              {menu.isExpanded ? '▼' : '›'}
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pages */}
                    {menu.isExpanded && menu.menuPermissionPageDTOs?.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#17132a] p-3 space-y-2">
                        {menu.menuPermissionPageDTOs.map((page, pageIndex) => (
                          <div key={page.pageId || pageIndex}>
                            {/* Page row */}
                            <div
                              className="flex items-center justify-between py-2 px-3 bg-white dark:bg-[#1d1733] rounded border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                              onClick={() => {
                                if (page.menuPagePermissionDTOs?.length > 0) {
                                  change((p) => togglePageExpand(p, menuIndex, pageIndex));
                                }
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <CustomCheckbox
                                  checked={getPageChecked(page)}
                                  onCheckedChange={() =>
                                    change((p) => applyPermissionToggle(p, menuIndex, pageIndex, undefined))
                                  }
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">{page.pageName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                {page.menuPagePermissionDTOs?.length > 0 ? (
                                  <>
                                    <span>
                                      {page.menuPagePermissionDTOs.filter((p) => p.hasPermission).length}/
                                      {page.menuPagePermissionDTOs.length}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-300">
                                      {page.isExpanded ? '▼' : '›'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Permission rows */}
                            {page.isExpanded && page.menuPagePermissionDTOs?.length > 0 && (
                              <div className="ml-6 mt-2 space-y-1">
                                {page.menuPagePermissionDTOs.map((perm, permIndex) => (
                                  <div
                                    key={perm.pagePermissionId || permIndex}
                                    className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-[#17132a] rounded border border-gray-200 dark:border-white/10"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <CustomCheckbox
                                        checked={!!perm.hasPermission}
                                        onCheckedChange={() =>
                                          change((p) =>
                                            applyPermissionToggle(p, menuIndex, pageIndex, permIndex)
                                          )
                                        }
                                      />
                                      <span className="text-xs text-gray-700 dark:text-gray-200">
                                        {perm.permissionName}
                                      </span>
                                    </div>
                                    <span className="px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                      Active
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 sticky bottom-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <LiquidGlassButton
            type="button"
            onClick={onSave}
            disabled={loading || saving}
            className="sm:ml-auto text-center"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PermissionModal;
