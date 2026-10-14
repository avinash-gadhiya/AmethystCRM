import React from 'react';
import { Search, X } from 'lucide-react';

const TableSearchField = ({
  value,
  onChange,
  onKeyDown,
  onClear,
  placeholder = 'Search',
  className = 'flex-1 min-w-0 sm:flex-none sm:w-64',
  inputClassName = 'w-full outline-none bg-transparent dark:text-gray-200 dark:placeholder-gray-400',
  inputStyle = { fontSize: '14px' },
  clearAriaLabel = 'Clear search',
  icon,
  disabled = false,
}) => {
  return (
    <div className={`tbl-glass-search ${className}`}>
      {icon || <Search size={18} className="dark:text-gray-200" />}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={inputClassName}
        style={inputStyle}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label={clearAriaLabel}
        >
          <X size={16} className="text-gray-500 dark:text-gray-200" />
        </button>
      )}
    </div>
  );
};

export default TableSearchField;


