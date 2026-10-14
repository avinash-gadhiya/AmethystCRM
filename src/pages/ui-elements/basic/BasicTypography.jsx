// -----------------------|| BASIC TYPOGRAPHY ||-----------------------//

export default function BasicTypography() {
  return (
    <div className="space-y-6">
      {/* Headings */}
      <div className="card">
        <div className="card-header">
          <h5 className="text-base font-semibold text-gray-800">Headings</h5>
        </div>
        <div className="card-body space-y-4">
          {[1, 2, 3, 4, 5, 6].map((level) => {
            const Tag = `h${level}`;
            const sizes = ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base'];
            return (
              <div key={level}>
                <Tag className={`font-bold text-gray-900 mb-1 ${sizes[level - 1]}`}>
                  This is a Heading {level}
                </Tag>
                <p className="text-sm text-gray-400 mb-0">
                  Suspendisse vel quam malesuada, aliquet sem sit amet, fringilla elit. Morbi tempor tincidunt tempor. Etiam id turpis viverra, vulputate sapien nec, varius sem.
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Font Weights */}
      <div className="card">
        <div className="card-header">
          <h5 className="text-base font-semibold text-gray-800">Font Weight</h5>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Light (300)', cls: 'font-light' },
              { label: 'Regular (400)', cls: 'font-normal' },
              { label: 'Medium (500)', cls: 'font-medium' },
              { label: 'Semibold (600)', cls: 'font-semibold' },
              { label: 'Bold (700)', cls: 'font-bold' },
              { label: 'Extrabold (800)', cls: 'font-extrabold' },
            ].map(({ label, cls }) => (
              <div key={label} className="p-4 bg-gray-50 rounded-xl">
                <p className={`text-base text-gray-800 mb-1 ${cls}`}>{label}</p>
                <p className={`text-sm text-gray-500 ${cls}`}>The quick brown fox</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Text Sizes */}
      <div className="card">
        <div className="card-header">
          <h5 className="text-base font-semibold text-gray-800">Text Sizes</h5>
        </div>
        <div className="card-body space-y-2">
          {[
            { label: 'text-xs (12px)', cls: 'text-xs' },
            { label: 'text-sm (14px)', cls: 'text-sm' },
            { label: 'text-base (16px)', cls: 'text-base' },
            { label: 'text-lg (18px)', cls: 'text-lg' },
            { label: 'text-xl (20px)', cls: 'text-xl' },
            { label: 'text-2xl (24px)', cls: 'text-2xl' },
            { label: 'text-3xl (30px)', cls: 'text-3xl' },
            { label: 'text-4xl (36px)', cls: 'text-4xl' },
          ].map(({ label, cls }) => (
            <p key={label} className={`${cls} text-gray-800 mb-0`}>{label}</p>
          ))}
        </div>
      </div>

      {/* Text Colors */}
      <div className="card">
        <div className="card-header">
          <h5 className="text-base font-semibold text-gray-800">Text Colors</h5>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { label: 'Primary', cls: 'text-indigo-600' },
              { label: 'Success', cls: 'text-emerald-600' },
              { label: 'Danger', cls: 'text-red-600' },
              { label: 'Warning', cls: 'text-amber-500' },
              { label: 'Info', cls: 'text-sky-500' },
              { label: 'Muted', cls: 'text-gray-400' },
              { label: 'Dark', cls: 'text-gray-900' },
              { label: 'Light', cls: 'text-gray-300' },
            ].map(({ label, cls }) => (
              <div key={label} className="p-3 bg-gray-50 rounded-xl">
                <p className={`text-sm font-medium mb-0 ${cls}`}>{label}</p>
                <span className="text-xs text-gray-400 font-mono">{cls}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inline Text Elements */}
      <div className="card">
        <div className="card-header">
          <h5 className="text-base font-semibold text-gray-800">Inline Text Elements</h5>
        </div>
        <div className="card-body space-y-3 text-sm text-gray-700">
          <p>You can use the mark tag to <mark className="bg-yellow-200 px-1 rounded">highlight</mark> text.</p>
          <p><del className="text-gray-400">This line of text is meant to be treated as deleted text.</del></p>
          <p><ins className="underline decoration-emerald-500">This line of text is meant to be treated as an addition to the document.</ins></p>
          <p><strong>This line rendered as bold text.</strong></p>
          <p><em>This line rendered as italicized text.</em></p>
          <p>Superscript<sup>TM</sup> &amp; Subscript<sub>2</sub></p>
          <p><code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-indigo-600">Inline code</code></p>
        </div>
      </div>
    </div>
  );
}
