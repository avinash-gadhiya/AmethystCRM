import * as React from 'react';

const IosToggle = React.forwardRef(
  (
    {
      checked,
      onCheckedChange,
      disabled = false,
      className,
      style,
      title,
      ...props
    },
    ref,
  ) => {
    const handleClick = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={!!checked}
        data-checked={checked ? 'true' : 'false'}
        disabled={disabled}
        onClick={handleClick}
        className={['ios-toggle', className].filter(Boolean).join(' ')}
        style={style}
        title={title}
        {...props}
      >
        <span className="ios-toggle-thumb" aria-hidden="true" />
      </button>
    );
  },
);

IosToggle.displayName = 'IosToggle';

export { IosToggle };


