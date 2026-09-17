/**
 * Bootstrap-to-Tailwind UI Shims
 * Provides drop-in replacements for react-bootstrap components using Tailwind CSS.
 * This file is used internally for migrating legacy view files.
 */
import { forwardRef } from 'react';

// --- Row / Col ---
export const Row = ({ children, className = '', ...props }) => (
  <div className={`grid gap-4 ${className}`} {...props}>{children}</div>
);

export const Col = ({ children, className = '', sm, md, lg, xl, ...props }) => {
  const spanClass = sm === 12 ? 'col-span-full' : lg === 3 ? 'col-span-1' : '';
  return <div className={`${spanClass} ${className}`} {...props}>{children}</div>;
};

// --- Card ---
export const Card = ({ children, className = '', ...props }) => (
  <div className={`card ${className}`} {...props}>{children}</div>
);

Card.Header = ({ children, className = '', ...props }) => (
  <div className={`card-header ${className}`} {...props}>{children}</div>
);

Card.Body = ({ children, className = '', ...props }) => (
  <div className={`card-body ${className}`} {...props}>{children}</div>
);

Card.Footer = ({ children, className = '', ...props }) => (
  <div className={`card-footer ${className}`} {...props}>{children}</div>
);

Card.Title = ({ as: Tag = 'h5', children, className = '', ...props }) => (
  <Tag className={`text-base font-semibold text-gray-800 mb-0 ${className}`} {...props}>{children}</Tag>
);

Card.Text = ({ children, className = '', ...props }) => (
  <p className={`text-sm text-gray-600 ${className}`} {...props}>{children}</p>
);

Card.Img = ({ ...props }) => <img {...props} />;
Card.ImgOverlay = ({ children, ...props }) => <div {...props}>{children}</div>;
Card.Link = ({ children, ...props }) => <a {...props}>{children}</a>;
Card.Subtitle = ({ children, className = '', ...props }) => (
  <h6 className={`text-sm text-gray-500 ${className}`} {...props}>{children}</h6>
);

// --- Button ---
const VARIANT_MAP = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  success: 'btn btn-success',
  warning: 'btn btn-warning',
  info: 'btn bg-sky-500 text-white hover:bg-sky-600',
  link: 'btn btn-link',
  'outline-primary': 'btn btn-outline-primary',
  'outline-secondary': 'btn btn-outline-secondary',
  'outline-danger': 'btn border-red-300 text-red-600 hover:bg-red-50',
  'outline-success': 'btn border-emerald-300 text-emerald-600 hover:bg-emerald-50',
  'outline-warning': 'btn border-amber-300 text-amber-600 hover:bg-amber-50',
  light: 'btn bg-gray-100 text-gray-700 hover:bg-gray-200',
};

const SIZE_MAP = { sm: 'btn-sm', lg: 'btn-lg' };

export const Button = forwardRef(({ children, variant = 'primary', size, className = '', disabled, type = 'button', as: Tag = 'button', onClick, ...props }, ref) => {
  const varClass = VARIANT_MAP[variant] || 'btn btn-primary';
  const szClass = SIZE_MAP[size] || '';
  const all = [varClass, szClass, className].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} type={Tag === 'button' ? type : undefined} className={all} disabled={disabled} onClick={onClick} {...props}>
      {children}
    </Tag>
  );
});
Button.displayName = 'Button';

// --- Badge ---
const BADGE_BG = {
  primary: 'bg-indigo-100 text-indigo-700',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  secondary: 'bg-gray-100 text-gray-600',
  light: 'bg-gray-50 text-gray-500 border border-gray-200',
  dark: 'bg-gray-800 text-white',
};

export const Badge = ({ children, bg = 'primary', className = '', text, ...props }) => {
  const bgClass = BADGE_BG[bg] || BADGE_BG.primary;
  return (
    <span className={`badge ${bgClass} ${className}`} {...props}>
      {children}
    </span>
  );
};

// --- Spinner ---
export const Spinner = ({ size: sz, className = '', ...props }) => (
  <span
    role="status"
    className={`inline-block rounded-full border-2 border-indigo-500 border-t-transparent animate-spin ${sz === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} ${className}`}
    {...props}
  />
);

// --- Table ---
export const Table = ({ children, className = '', hover, bordered, striped, responsive, ...props }) => {
  const tableEl = <table className={`table ${className}`} {...props}>{children}</table>;
  if (responsive) return <div className="table-responsive">{tableEl}</div>;
  return tableEl;
};

// --- Form ---
export const Form = ({ children, ...props }) => <form {...props}>{children}</form>;

Form.Group = ({ children, className = '', ...props }) => <div className={`mb-4 ${className}`} {...props}>{children}</div>;
Form.Label = ({ children, className = '', ...props }) => (
  <label className={`block text-xs font-medium text-gray-500 mb-1.5 ${className}`} {...props}>{children}</label>
);
Form.Control = forwardRef(({ as: Tag = 'input', className = '', type = 'text', size: sz, ...props }, ref) => {
  const szClass = sz === 'sm' ? 'py-1.5 text-xs' : '';
  if (Tag === 'textarea') {
    return <textarea ref={ref} className={`form-control ${szClass} ${className}`} {...props} />;
  }
  return <input ref={ref} type={type} className={`form-control ${szClass} ${className}`} {...props} />;
});
Form.Control.displayName = 'Form.Control';

Form.Select = forwardRef(({ children, className = '', size: sz, ...props }, ref) => (
  <select ref={ref} className={`form-control ${className}`} {...props}>{children}</select>
));
Form.Select.displayName = 'Form.Select';

Form.Check = ({ label, type = 'checkbox', className = '', id, ...props }) => (
  <label className={`flex items-center gap-2 text-sm text-gray-600 cursor-pointer ${className}`} htmlFor={id}>
    <input id={id} type={type} className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" {...props} />
    {label}
  </label>
);

Form.Text = ({ children, className = '', ...props }) => (
  <p className={`text-xs text-gray-400 mt-1 mb-0 ${className}`} {...props}>{children}</p>
);

Form.FloatingLabel = ({ children, label, ...props }) => (
  <div className="relative" {...props}>
    {children}
    <label className="absolute left-3 top-1 text-xs text-gray-400">{label}</label>
  </div>
);

// --- InputGroup ---
export const InputGroup = ({ children, className = '', ...props }) => (
  <div className={`relative flex ${className}`} {...props}>{children}</div>
);

InputGroup.Text = ({ children, className = '', ...props }) => (
  <span className={`inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm ${className}`} {...props}>
    {children}
  </span>
);

// --- Modal ---
export const Modal = ({ children, show, onHide, size, className = '', ...props }) => {
  if (!show) return null;
  const widthClass = size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onHide?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal-box ${widthClass} ${className}`} {...props}>
        {children}
      </div>
    </div>
  );
};

Modal.Header = ({ children, closeButton, onHide, className = '', ...props }) => (
  <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 ${className}`} {...props}>
    <div className="flex-1">{children}</div>
    {closeButton && (
      <button
        type="button"
        onClick={onHide}
        className="ml-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent border-0 cursor-pointer"
        aria-label="Close"
      >
        ✕
      </button>
    )}
  </div>
);

Modal.Title = ({ children, className = '', as: Tag = 'h5', ...props }) => (
  <Tag className={`text-base font-semibold text-gray-800 mb-0 ${className}`} {...props}>{children}</Tag>
);

Modal.Body = ({ children, className = '', ...props }) => (
  <div className={`px-6 py-4 ${className}`} {...props}>{children}</div>
);

Modal.Footer = ({ children, className = '', ...props }) => (
  <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 ${className}`} {...props}>
    {children}
  </div>
);

// --- Alert ---
const ALERT_BG = {
  danger: 'alert-danger',
  warning: 'alert-warning',
  success: 'alert-success',
  info: 'alert-info',
  primary: 'alert-info',
};

export const Alert = ({ children, variant = 'info', dismissible, onClose, className = '', ...props }) => (
  <div className={`alert ${ALERT_BG[variant] || 'alert-info'} ${className}`} role="alert" {...props}>
    <span className="flex-1">{children}</span>
    {dismissible && (
      <button type="button" onClick={onClose} className="ml-2 bg-transparent border-0 cursor-pointer text-inherit opacity-60 hover:opacity-100 p-0">×</button>
    )}
  </div>
);

// --- Dropdown ---
export const Dropdown = ({ children, ...props }) => <div className="relative inline-block" {...props}>{children}</div>;
Dropdown.Toggle = ({ children, ...props }) => <button type="button" className="btn btn-secondary btn-sm" {...props}>{children}</button>;
Dropdown.Menu = ({ children, ...props }) => <div className="dropdown-menu" {...props}>{children}</div>;
Dropdown.Item = ({ children, onClick, as: Tag = 'button', ...props }) => (
  <Tag type="button" className="dropdown-item" onClick={onClick} {...props}>{children}</Tag>
);
Dropdown.Divider = () => <div className="dropdown-divider" />;
Dropdown.Header = ({ children }) => <div className="dropdown-header">{children}</div>;

// --- Collapse (simple show/hide) ---
export const Collapse = ({ children, in: isIn }) => isIn ? <>{children}</> : null;

// --- Overlay / Tooltip ---
export const OverlayTrigger = ({ children, overlay }) => {
  const title = overlay?.props?.children || '';
  return <div title={String(title)} className="inline-block">{children}</div>;
};

export const Tooltip = ({ children }) => <>{children}</>;
export const Popover = ({ children }) => <>{children}</>;

export default {};
