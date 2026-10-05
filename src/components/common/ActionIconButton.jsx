import React from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';

const ActionIconButton = ({
  label,
  tooltip,
  icon,
  onClick,
  children,
  className = '',
  stopPropagation = true,
  disabled = false,
  variant
}) => {
  const displayLabel = tooltip || label || '';
  const IconComponent = typeof icon === 'string' ? null : icon;
  const isDeleteAction =
    variant === 'delete' ||
    icon === 'trash' ||
    icon === 'delete' ||
    (typeof displayLabel === 'string' && displayLabel.toLowerCase().includes('delete'));
  const isEditAction =
    variant === 'edit' ||
    icon === 'pencil' ||
    icon === 'edit' ||
    (typeof displayLabel === 'string' && displayLabel.toLowerCase().includes('edit'));
  const isViewAction =
    variant === 'view' ||
    icon === 'eye' ||
    icon === 'view' ||
    (typeof displayLabel === 'string' && displayLabel.toLowerCase().includes('view'));

  const handleClick = (e) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClick?.(e);
  };

  // Determine fallback icon if children are not provided
  let content = children;
  if (!content && IconComponent) {
    content = <IconComponent size={15} />;
  }
  if (!content) {
    if (icon === 'plus' || variant === 'primary' || variant === 'add') {
      content = <Plus size={15} />;
    } else if (isEditAction) {
      content = <Pencil size={15} />;
    } else if (isDeleteAction) {
      content = <Trash2 size={15} />;
    } else if (isViewAction) {
      content = <Eye size={15} />;
    }
  }

  // Normal, clean button style
  let styleClasses = 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200';
  if (isDeleteAction) {
    styleClasses = 'text-red-500 hover:text-red-700 bg-red-50/50 hover:bg-red-50 border-red-200/80';
  } else if (isEditAction) {
    styleClasses = 'text-blue-600 hover:text-blue-800 bg-blue-50/50 hover:bg-blue-50 border-blue-200/80';
  } else if (isViewAction) {
    styleClasses = 'text-emerald-600 hover:text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80';
  }

  return (
    <button
      type="button"
      aria-label={displayLabel || (isDeleteAction ? 'Delete' : 'Action')}
      title={displayLabel || (isDeleteAction ? 'Delete' : 'Action')}
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${styleClasses} ${className}`.trim()}
    >
      {content}
    </button>
  );
};

export default ActionIconButton;
