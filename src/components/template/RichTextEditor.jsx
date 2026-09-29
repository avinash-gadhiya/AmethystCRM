import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Undo,
  Redo,
  Table as TableIcon,
  Tag,
  Loader2
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

const RichTextEditor = forwardRef(
  ({ value = '', onChange, placeholder = 'Enter template content...', placeholders = [], height = 430 }, ref) => {
    const editorIdRef = useRef(`tinymce-editor-${Math.random().toString(36).substring(2, 9)}`);
    const editorInstanceRef = useRef(null);
    const textareaFallbackRef = useRef(null);
    const [isTinyMCEReady, setIsTinyMCEReady] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    // Expose insertPlaceholder and editor instance to parent
    useImperativeHandle(ref, () => ({
      insertPlaceholder(token) {
        if (editorInstanceRef.current && isTinyMCEReady) {
          editorInstanceRef.current.insertContent(token);
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

          tinymce.init({
            selector: `#${editorIdRef.current}`,
            height: height,
            menubar: true,
            branding: false,
            statusbar: true,
            promotion: false,
            license_key: 'gpl',
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
              'media',
              'table',
              'help',
              'wordcount'
            ],
            toolbar:
              'undo redo | blocks | bold italic underline strikethrough forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link table | removeformat | code preview',
            content_style: `
              body {
                font-family: Arial, sans-serif;
                font-size: 16px;
                line-height: 1.5;
                padding: 12px;
                background-color: transparent;
              }
              table {
                border-collapse: collapse;
                width: 100%;
              }
              table td,
              table th {
                border: 1px dashed #bfbfbf;
                padding: 6px;
                vertical-align: top;
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

    // Fallback formatting execution
    const handleFormat = (command, val = null) => {
      document.execCommand(command, false, val);
    };

    return (
      <div className="space-y-2">
        {/* Placeholder insertion chips */}
        {placeholders.length > 0 && (
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-purple-900 dark:text-purple-300">
              <Tag size={13} className="text-purple-600 dark:text-purple-400" />
              <span>Available Placeholders (click to insert at cursor):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {placeholders.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => handlePlaceholderClick(ph)}
                  className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-[#121626] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 dark:hover:text-white rounded-md shadow-2xs transition-all active:scale-95"
                  title={`Insert ${ph}`}
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TinyMCE Container */}
        <div className="relative border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#0f1322]">
          {!isTinyMCEReady && !useFallback && (
            <div className="h-[430px] flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span className="text-xs">Loading Rich Text Editor...</span>
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
              isTinyMCEReady ? 'hidden' : useFallback ? 'block h-[430px]' : 'invisible h-0'
            }`}
          />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
