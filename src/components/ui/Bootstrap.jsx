/**
 * Bootstrap-to-Tailwind UI Shims
 * Provides drop-in replacements for react-bootstrap components using Tailwind CSS.
 * This file is used internally for migrating legacy view files.
 */
import { forwardRef } from 'react';

// --- Row / Col (12-Column Responsive Grid) ---
export const Row = ({ children, className = '', ...props }) => (
  <div className={`row ${className}`} {...props}>{children}</div>
);

export const Col = ({ children, className = '', xs, sm, md, lg, xl, ...props }) => {
  const classes = [];
  if (xs) classes.push(xs === true ? 'col' : `col-${xs}`);
  if (sm) classes.push(sm === true ? 'col-sm' : `col-sm-${sm}`);
  if (md) classes.push(md === true ? 'col-md' : `col-md-${md}`);
  if (lg) classes.push(lg === true ? 'col-lg' : `col-lg-${lg}`);
  if (xl) classes.push(xl === true ? 'col-xl' : `col-xl-${xl}`);
  if (classes.length === 0) classes.push('col');

  return <div className={`${classes.join(' ')} ${className}`.trim()} {...props}>{children}</div>;
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
  'outline-danger': 'btn btn-secondary text-red-600 hover:text-red-700',
  'outline-success': 'btn btn-secondary text-emerald-600 hover:text-emerald-700',
  'outline-warning': 'btn btn-secondary text-amber-600 hover:text-amber-700',
  light: 'btn btn-secondary',
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
  primary: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  secondary: 'bg-secondary',
  light: 'bg-light',
  dark: 'bg-secondary text-gray-900',
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
  if (responsive) return <div className="neu-table-wrapper table-responsive">{tableEl}</div>;
  return tableEl;
};

// --- Form ---
export const Form = ({ children, ...props }) => <form {...props}>{children}</form>;

Form.Group = ({ children, className = '', ...props }) => <div className={`mb-4 ${className}`} {...props}>{children}</div>;
Form.Label = ({ children, className = '', ...props }) => (
  <label className={`block text-xs font-semibold text-gray-600 mb-1.5 ${className}`} {...props}>{children}</label>
);
Form.Control = forwardRef(({ as: Tag = 'input', className = '', type = 'text', size: sz, ...props }, ref) => {
  const szClass = sz === 'sm' ? 'py-1.5 text-xs' : '';
  if (Tag === 'textarea') {
    return <textarea ref={ref} className={`form-control neu-input ${szClass} ${className}`} {...props} />;
  }
  return <input ref={ref} type={type} className={`form-control neu-input ${szClass} ${className}`} {...props} />;
});
Form.Control.displayName = 'Form.Control';

Form.Select = forwardRef(({ children, className = '', size: sz, ...props }, ref) => (
  <select ref={ref} className={`form-control form-select neu-input ${className}`} {...props}>{children}</select>
));
Form.Select.displayName = 'Form.Select';

Form.Check = ({ label, type = 'checkbox', className = '', id, ...props }) => (
  <label className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer ${className}`} htmlFor={id}>
    <input id={id} type={type} className="form-check-input w-4 h-4 rounded cursor-pointer" {...props} />
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
  <div className={`relative flex items-center ${className}`} {...props}>{children}</div>
);

InputGroup.Text = ({ children, className = '', ...props }) => (
  <span className={`inline-flex items-center px-3.5 py-2 bg-[#eef2f7] border border-r-0 border-white/80 rounded-l-xl text-gray-600 text-sm shadow-[inset_2px_2px_4px_#cad3e0,inset_-2px_-2px_4px_#ffffff] ${className}`} {...props}>
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
  <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-300/60 ${className}`} {...props}>
    <div className="flex-1">{children}</div>
    {closeButton && (
      <button
        type="button"
        onClick={onHide}
        className="neu-icon-btn ml-4"
        aria-label="Close"
      >
        ✕
      </button>
    )}
  </div>
);

Modal.Title = ({ children, className = '', as: Tag = 'h5', ...props }) => (
  <Tag className={`text-base font-bold text-gray-800 mb-0 ${className}`} {...props}>{children}</Tag>
);

Modal.Body = ({ children, className = '', ...props }) => (
  <div className={`px-6 py-5 ${className}`} {...props}>{children}</div>
);

Modal.Footer = ({ children, className = '', ...props }) => (
  <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-300/60 bg-transparent ${className}`} {...props}>
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
