// Search box for a long `SelectContent` list.
//
// Pass it through SelectContent's `search` prop, not as a child - the prop
// renders it above the scroll viewport, so it stays put while the options
// scroll under it. As a child it would scroll away and leave a gap at the top.
//
// Radix runs its own type-ahead on keystrokes inside the content and moves
// focus to the matching item, so the key events have to stop at the input -
// otherwise typing jumps the highlight around and steals focus from the field.
const SelectSearchInput = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => (
  <div
    className={`border-b border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900 ${className}`}
  >
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    />
  </div>
);

export default SelectSearchInput;
