import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search, Check } from 'lucide-react';

// -----------------------|| MATERIAL (now Lucide Gallery) ||-----------------------//

const allIcons = Object.entries(LucideIcons)
  .filter(([name, comp]) => typeof comp === 'function' && name !== 'default' && name !== 'createLucideIcon')
  .map(([name]) => name);

export default function Material() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');

  const filtered = query
    ? allIcons.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : allIcons;

  const handleCopy = (name) => {
    navigator.clipboard.writeText(`<${name} size={20} />`).catch(() => {});
    setCopied(name);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h5 className="text-base font-semibold text-gray-800 mb-1">Lucide Icon Library</h5>
          <p className="text-sm text-gray-400 mb-0">
            Click any icon to copy React usage snippet.{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600">
              {'<IconName size={20} />'}
            </code>
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {filtered.length} icons
        </span>
      </div>
      <div className="card-body">
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              className="form-control pl-9"
              placeholder="Search icons..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="i-main">
          {filtered.map((name) => {
            const IconComp = LucideIcons[name];
            const isCopied = copied === name;
            if (!IconComp) return null;
            return (
              <div
                key={name}
                className={`i-block group ${isCopied ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}`}
                title={name}
                onClick={() => handleCopy(name)}
              >
                {isCopied ? (
                  <Check size={20} className="text-indigo-500" />
                ) : (
                  <IconComp size={20} />
                )}
                <span className="text-gray-500 group-hover:text-indigo-600 truncate w-full text-center" style={{ fontSize: '10px' }}>
                  {isCopied ? 'Copied!' : name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
