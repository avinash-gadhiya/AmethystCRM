// project imports
import MainCard from '../../../components/Card/MainCard';

// -----------------------|| BASIC COLOR ||-----------------------//

const ColorSwatch = ({ className, label }) => (
  <div className={`p-3 rounded-lg text-xs font-mono mb-2 ${className}`}>{label}</div>
);

const colorGroups = [
  { name: 'Blue', prefix: 'bg-blue', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Indigo', prefix: 'bg-indigo', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Purple', prefix: 'bg-purple', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Pink', prefix: 'bg-pink', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Red', prefix: 'bg-red', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Orange', prefix: 'bg-orange', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Amber', prefix: 'bg-amber', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Green', prefix: 'bg-green', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Teal', prefix: 'bg-teal', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Cyan', prefix: 'bg-cyan', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Gray', prefix: 'bg-gray', shades: [100,200,300,400,500,600,700,800,900] },
  { name: 'Slate', prefix: 'bg-slate', shades: [100,200,300,400,500,600,700,800,900] },
];

export default function BasicColor() {
  return (
    <div className="space-y-6">
      <MainCard title="Tailwind Color Palette" isOption={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {colorGroups.map((group) => (
            <div key={group.name}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group.name}</p>
              {group.shades.map((shade) => {
                const cls = `${group.prefix}-${shade}`;
                return (
                  <div key={shade} className={`h-8 rounded flex items-center px-2 mb-1 ${cls}`}>
                    <span className={`text-xs font-mono ${shade >= 500 ? 'text-white/80' : 'text-gray-700'}`}>
                      {shade}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </MainCard>
    </div>
  );
}
