import React from 'react';
import { createPortal } from 'react-dom';
import LiquidGlassButton from './LiquidGlassButton';
import GlassCloseButton from './GlassCloseButton';

const DeleteConfirmModal = ({
  open,
  isOpen,
  title = 'Delete Role',
  description = 'Are you sure you want to delete',
  itemName,
  details = [],
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
  isDeleting = false,
  loadingText = 'Deleting...',
  onCancel,
  onClose,
  onConfirm
}) => {
  const isVisible = open ?? isOpen ?? false;
  const isLoading = loading || isDeleting;
  const handleCancel = onCancel || onClose;

  if (!isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <GlassCloseButton onClick={handleCancel} disabled={isLoading} />
        </div>

        <div className="p-6">
          {message ? (
            <div className="text-sm text-gray-700 dark:text-gray-200">{message}</div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {description} {itemName ? <span className="font-semibold text-gray-900 dark:text-white">&ldquo;{itemName}&rdquo;</span> : null}?
            </p>
          )}

          {Array.isArray(details) && details.length > 0 && (
            <div className="mt-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 space-y-1.5">
              {details.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{row.value ?? '—'}</span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            This action cannot be undone.
          </p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <LiquidGlassButton
              variant="danger"
              onClick={onConfirm}
              disabled={isLoading}
              className="text-center"
            >
              {isLoading ? loadingText : confirmText}
            </LiquidGlassButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmModal;
