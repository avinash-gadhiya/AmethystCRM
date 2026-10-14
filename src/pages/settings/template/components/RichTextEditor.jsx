import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  Tag,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
  Sparkles
} from 'lucide-react';

const TINYMCE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js';

let tinymceLoadPromise = null;
const loadTinyMCEScript = () => {
  if (typeof window !== 'undefined' && window.tinymce) {
    return Promise.resolve(window.tinymce);
  }
  if (!tinymceLoadPromise) {
    tinymceLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${TINYMCE_CDN}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.tinymce));
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.src = TINYMCE_CDN;
      script.referrerPolicy = 'origin';
      script.async = true;
      script.onload = () => resolve(window.tinymce);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
  return tinymceLoadPromise;
};

const categorizePlaceholder = (token) => {
  const lower = token.toLowerCase();
  if (lower.includes('customer') || lower.includes('user') || lower.includes('client')) return 'customer';
  if (
    lower.includes('order') ||
    lower.includes('product') ||
    lower.includes('amount') ||
    lower.includes('discount') ||
    lower.includes('refund') ||
    lower.includes('invoice')
  ) {
    return 'order';
  }
  if (lower.includes('brand') || lower.includes('support') || lower.includes('tollfree')) return 'brand';
  return 'other';
};

const RichTextEditor = forwardRef(
  ({ value = '', onChange, placeholder = 'Enter template content...', placeholders = [], height = 380 }, ref) => {
    const editorIdRef = useRef(`tinymce-editor-${Math.random().toString(36).substring(2, 9)}`);
    const editorInstanceRef = useRef(null);
    const textareaFallbackRef = useRef(null);
    const [isTinyMCEReady, setIsTinyMCEReady] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    // Placeholders UI state
    const [isPlaceholdersExpanded, setIsPlaceholdersExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [lastInserted, setLastInserted] = useState(null);

    // Filter placeholders by category & search
    const filteredPlaceholders = useMemo(() => {
      if (!placeholders || placeholders.length === 0) return [];
      return placeholders.filter((token) => {
        const matchesSearch = token.toLowerCase().includes(searchQuery.trim().toLowerCase());
        const cat = categorizePlaceholder(token);
        const matchesCategory = activeCategory === 'all' || cat === activeCategory;
        return matchesSearch && matchesCategory;
      });
    }, [placeholders, searchQuery, activeCategory]);

    // Count categories
    const categoryCounts = useMemo(() => {
      const counts = { all: placeholders.length, customer: 0, order: 0, brand: 0, other: 0 };
      placeholders.forEach((token) => {
        const cat = categorizePlaceholder(token);
        if (counts[cat] !== undefined) counts[cat]++;
      });
      return counts;
    }, [placeholders]);

    // Expose insertPlaceholder and editor instance to parent
    useImperativeHandle(ref, () => ({
      insertPlaceholder(token) {
        handlePlaceholderClick(token);
      },
      getEditor() {
        return editorInstanceRef.current;
      }
    }));

    // Initialize TinyMCE
    useEffect(() => {
      let isMounted = true;

      loadTinyMCEScript()
        .then((tinymce) => {
          if (!isMounted) return;

          // Remove any existing instance with this ID
          if (tinymce.get(editorIdRef.current)) {
            tinymce.get(editorIdRef.current).remove();
          }

          const isDark =
            typeof document !== 'undefined' &&
            (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));

          tinymce.init({
            selector: `#${editorIdRef.current}`,
            height: height || 380,
            min_height: 300,
            menubar: false,
            branding: false,
            statusbar: true,
            elementpath: false,
            promotion: false,
            license_key: 'gpl',
            skin: isDark ? 'oxide-dark' : 'oxide',
            content_css: isDark ? 'dark' : 'default',
            toolbar_mode: 'sliding',
            plugins: [
              'advlist',
              'autolink',
              'lists',
              'link',
              'charmap',
              'preview',
              'anchor',
              'searchreplace',
              'visualblocks',
              'code',
              'fullscreen',
              'insertdatetime',
              'table',
              'help',
              'wordcount'
            ],
            toolbar:
              'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link table | removeformat | code preview fullscreen',
            content_style: `
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 15px;
                line-height: 1.6;
                padding: 16px;
                color: ${isDark ? '#e2e8f0' : '#1e293b'};
                background-color: ${isDark ? '#0f1322' : '#ffffff'};
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin: 12px 0;
              }
              table td,
              table th {
                border: 1px dashed ${isDark ? '#334155' : '#cbd5e1'};
                padding: 8px;
                vertical-align: top;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            `,
            setup: (editor) => {
              editorInstanceRef.current = editor;

              editor.on('init', () => {
                if (isMounted) {
                  editor.setContent(value || '');
                  setIsTinyMCEReady(true);
                }
              });

              editor.on('change keyup paste undo redo input', () => {
                const content = editor.getContent();
                setInternalValue(content);
                onChange?.(content);
              });
            }
          });
        })
        .catch((err) => {
          console.warn('TinyMCE CDN loading failed, using fallback editor:', err);
          if (isMounted) {
            setUseFallback(true);
          }
        });

      return () => {
        isMounted = false;
        if (typeof window !== 'undefined' && window.tinymce && editorInstanceRef.current) {
          try {
            window.tinymce.get(editorIdRef.current)?.remove();
          } catch {}
          editorInstanceRef.current = null;
        }
      };
    }, []);

    // Sync external value changes when not actively typing
    useEffect(() => {
      if (editorInstanceRef.current && isTinyMCEReady) {
        const current = editorInstanceRef.current.getContent();
        if (value !== current && (value || current)) {
          editorInstanceRef.current.setContent(value || '');
        }
      }
      setInternalValue(value || '');
    }, [value, isTinyMCEReady]);

    const handlePlaceholderClick = (token) => {
      setLastInserted(token);
      setTimeout(() => setLastInserted(null), 1800);

      if (editorInstanceRef.current && isTinyMCEReady) {
        editorInstanceRef.current.insertContent(token);
        editorInstanceRef.current.focus();
      } else if (textareaFallbackRef.current) {
        const el = textareaFallbackRef.current;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const text = el.value;
        const nextText = text.substring(0, start) + token + text.substring(end);
        el.value = nextText;
        setInternalValue(nextText);
        onChange?.(nextText);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        }, 0);
      }
    };

    return (
      <div className="space-y-2.5">
        {/* Placeholders Toolbar / Drawer */}
        {placeholders.length > 0 && (
          <div className="rounded-xl border border-purple-200/80 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 overflow-hidden shadow-2xs transition-all">
            {/* Drawer Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-purple-100/50 dark:bg-purple-950/40 border-b border-purple-200/60 dark:border-purple-900/30">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-purple-200/70 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Tag size={12} />
                </div>
                <span className="text-xs font-semibold text-purple-950 dark:text-purple-200">
                  Dynamic Placeholders
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-purple-200/80 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200">
                  {placeholders.length}
                </span>
                <span className="hidden sm:inline text-[11px] text-purple-700/80 dark:text-purple-300/70">
                  (click to insert at cursor)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Insertion Feedback Badge */}
                {lastInserted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/40 animate-fadeIn">
                    <Check size={11} /> Inserted {lastInserted}
                  </span>
                )}

                {/* Quick Search */}
                {isPlaceholdersExpanded && placeholders.length > 6 && (
                  <div className="relative">
                    <Search
                      size={11}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-28 sm:w-36 h-6.5 pl-6 pr-5 text-[11px] rounded-lg border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-[#121626] text-purple-950 dark:text-purple-200 placeholder-purple-300 dark:placeholder-purple-500 outline-none focus:ring-1 focus:ring-purple-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-700"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                )}

                {/* Expand / Collapse Button */}
                <button
                  type="button"
                  onClick={() => setIsPlaceholdersExpanded(!isPlaceholdersExpanded)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-200/60 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <span>{isPlaceholdersExpanded ? 'Collapse' : 'Expand'}</span>
                  {isPlaceholdersExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {/* Expanded Content with Filter Tabs & Chips */}
            {isPlaceholdersExpanded ? (
              <div className="p-2.5 space-y-2">
                {/* Category Filter Pills (if tags > 6) */}
                {placeholders.length > 6 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {[
                      { id: 'all', label: 'All', count: categoryCounts.all },
                      { id: 'customer', label: 'Customer', count: categoryCounts.customer },
                      { id: 'order', label: 'Order & Refund', count: categoryCounts.order },
                      { id: 'brand', label: 'Brand & Support', count: categoryCounts.brand },
                      { id: 'other', label: 'Other', count: categoryCounts.other }
                    ]
                      .filter((tab) => tab.count > 0 || tab.id === 'all')
                      .map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveCategory(tab.id)}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${
                            activeCategory === tab.id
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-purple-100/60 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 hover:bg-purple-200/70 dark:hover:bg-purple-900/60'
                          }`}
                        >
                          {tab.label} <span className="opacity-75 font-mono text-[10px]">({tab.count})</span>
                        </button>
                      ))}
                  </div>
                )}

                {/* Placeholders Chip Grid (Height-capped) */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {filteredPlaceholders.length > 0 ? (
                    filteredPlaceholders.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => handlePlaceholderClick(ph)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium bg-white dark:bg-[#121626] text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 hover:bg-purple-600 hover:text-white hover:border-purple-600 dark:hover:bg-purple-600 dark:hover:text-white rounded-lg shadow-2xs transition-all active:scale-95 group cursor-pointer"
                        title={`Click to insert ${ph} at cursor position`}
                      >
                        <span className="text-purple-400 group-hover:text-purple-200 font-bold text-[10px]">+</span>
                        <span>{ph}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-purple-400 italic py-1 px-1">
                      No placeholders match "{searchQuery}"
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Compact Collapsed Row: Top 5 placeholders preview */
              <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium shrink-0">Quick tags:</span>
                {placeholders.slice(0, 6).map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => handlePlaceholderClick(ph)}
                    className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-[#121626] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-600 hover:text-white rounded-md shrink-0 transition-colors"
                  >
                    <span>+</span>
                    <span>{ph}</span>
                  </button>
                ))}
                {placeholders.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setIsPlaceholdersExpanded(true)}
                    className="text-[10px] font-medium text-purple-600 hover:underline shrink-0"
                  >
                    +{placeholders.length - 6} more...
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TinyMCE / Editor Container */}
        <div className="relative border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#0f1322] transition-all">
          {!isTinyMCEReady && !useFallback && (
            <div className="h-[360px] flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span className="text-xs font-medium">Loading Rich Text Editor...</span>
            </div>
          )}

          <textarea
            id={editorIdRef.current}
            ref={textareaFallbackRef}
            value={internalValue}
            onChange={(e) => {
              setInternalValue(e.target.value);
              onChange?.(e.target.value);
            }}
            placeholder={placeholder}
            className={`w-full p-4 font-mono text-sm bg-transparent text-gray-900 dark:text-white outline-none resize-y ${
              isTinyMCEReady ? 'hidden' : useFallback ? 'block h-[360px]' : 'invisible h-0'
            }`}
          />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

