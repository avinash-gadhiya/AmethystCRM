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
  autoFocus = true,
}) => (
  <div
    className={`border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900 ${className}`}
  >
    <input
      type="text"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-800"
    />
  </div>
);

export default SelectSearchInput;
