import React from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

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

  const handleClick = (e) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClick?.(e);
  };

  if (isDeleteAction) {
    return (
      <button
        type="button"
        aria-label={displayLabel || 'Delete'}
        title={displayLabel || 'Delete'}
        onClick={handleClick}
        disabled={disabled}
        className={`bin-button ${className}`.trim()}
      >
        {IconComponent ? <IconComponent size={15} className="bin-icon" aria-hidden="true" /> : <Trash2 size={15} className="bin-icon" aria-hidden="true" />}
      </button>
    );
  }

  // Determine fallback icon if children are not provided
  let content = children;
  if (!content && IconComponent) {
    content = <IconComponent size={15} />;
  }
  if (!content) {
    if (icon === 'plus' || variant === 'primary' || variant === 'add') {
      content = <Plus size={15} />;
    } else if (icon === 'pencil' || icon === 'edit' || variant === 'edit') {
      content = <Pencil size={15} />;
    } else if (icon === 'trash') {
      content = <Trash2 size={15} />;
    }
  }

  return (
    <button
      type="button"
      aria-label={displayLabel}
      title={displayLabel}
      onClick={handleClick}
      disabled={disabled}
      className={`liquid-glass-icon-btn ${className}`.trim()}
    >
      {content}
    </button>
  );
};

export default ActionIconButton;
