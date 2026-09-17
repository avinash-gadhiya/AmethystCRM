import PropTypes from 'prop-types';
import { Users, Globe, TrendingUp, RotateCcw, Download, ShoppingCart } from 'lucide-react';

const FLAT_CARD_ICON_MAP = {
  group: Users,
  language: Globe,
  unarchive: TrendingUp,
  swap_horizontal_circle: RotateCcw,
  cloud_download: Download,
  shopping_cart: ShoppingCart
};

// -----------------------|| FLAT CARD ||-----------------------//

export default function FlatCard({ params }) {
  const IconComponent = FLAT_CARD_ICON_MAP[params.icon] || null;

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
        {IconComponent ? (
          <IconComponent size={26} className="text-indigo-600" />
        ) : (
          <span className="text-indigo-600 text-lg">{params.icon}</span>
        )}
      </div>
      <div>
        <h5 className="text-xl font-bold text-gray-800 mb-0.5">{params.value}</h5>
        <span className="text-xs text-gray-400">{params.title}</span>
      </div>
    </div>
  );
}

FlatCard.propTypes = { params: PropTypes.any };
