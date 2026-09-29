import React from 'react';

/**
 * Reusable iOS-style toggle button component.
 *
 * Component API:
 * <IosToggle
 *   checked={boolean}
 *   onCheckedChange={(nextChecked) => void}
 *   disabled={boolean}
 *   title={string}
 * />
 *
 * Requirements:
 * - Render a semantic <button type="button" role="switch">.
 * - Set aria-checked to the current boolean value.
 * - Add data-checked="true" or data-checked="false" for CSS state styling.
 * - Clicking the button must call onCheckedChange(!checked).
 * - Do nothing when disabled.
 * - Support keyboard activation through native button behavior.
 * - Include a child element named .ios-toggle-thumb.
 * - Support an optional className, style, title, and forwarded ref.
 */
const IosToggle = React.forwardRef(
  (
    {
      checked = false,
      onCheckedChange,
      onChange,
      disabled = false,
      loading = false,
      className = '',
      title,
      ...props
    },
    ref
  ) => {
    const isInteractive = !disabled && !loading;

    const handleClick = (e) => {
      e?.stopPropagation?.();
      if (!isInteractive) return;

      const nextChecked = !checked;
      if (typeof onCheckedChange === 'function') {
        onCheckedChange(nextChecked);
      }
      if (typeof onChange === 'function') {
        onChange(nextChecked);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        data-checked={checked ? 'true' : 'false'}
        disabled={!isInteractive}
        title={title}
        onClick={handleClick}
        className={`ios-toggle ${className}`.trim()}
        {...props}
      >
        <span className="ios-toggle-thumb" aria-hidden="true" />
      </button>
    );
  }
);

IosToggle.displayName = 'IosToggle';

export { IosToggle };
export default IosToggle;
