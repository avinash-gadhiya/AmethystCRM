import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import './animated-dropdown.css';

export default function AnimatedDropdown({
  value = '',
  onValueChange,
  options = [],
  placeholder = 'Select option',
  ariaLabel = 'Select option',
  disabled = false,
  className = ''
}) {
  return (
    <div className={`animated-dropdown ${className}`}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="animated-dropdown-trigger" aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="animated-dropdown-menu">
          {options.map((option) => (
            <SelectItem className="animated-dropdown-item" value={option.value} key={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
