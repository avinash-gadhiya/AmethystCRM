import PropTypes from 'prop-types';
import { Gift, ShoppingBag, DollarSign, Tag } from 'lucide-react';

const PRODUCT_CARD_ICON_MAP = {
  card_giftcard: Gift,
  local_mall: ShoppingBag,
  monetization_on: DollarSign,
  local_offer: Tag
};

// -----------------------|| PRODUCT CARD ||-----------------------//

export default function ProductCard({ params }) {
  const isVariant = !!params.variant;
  const IconComponent = PRODUCT_CARD_ICON_MAP[params.icon] || null;

  const variantClasses = {
    primary: 'bg-indigo-600',
    success: 'bg-emerald-600',
    danger: 'bg-red-600',
    warning: 'bg-amber-500',
    info: 'bg-sky-500',
  };

  const bgClass = params.variant ? (variantClasses[params.variant] || `bg-${params.variant}`) : 'bg-white border border-gray-100';
  const textClass = isVariant ? 'text-white' : 'text-gray-800';
  const subTextClass = isVariant ? 'text-white/70' : 'text-gray-400';

  return (
    <div className={`rounded-2xl p-5 ${bgClass} shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${subTextClass}`}>{params.title}</p>
          <h3 className={`text-2xl font-bold mb-0 ${textClass}`}>{params.primaryText}</h3>
        </div>
        {IconComponent && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isVariant ? 'bg-white/20' : 'bg-indigo-50'}`}>
            <IconComponent size={22} className={isVariant ? 'text-white' : 'text-indigo-600'} />
          </div>
        )}
      </div>
      {params.secondaryText && (
        <p className={`text-xs mt-3 mb-0 ${subTextClass}`}>{params.secondaryText}</p>
      )}
    </div>
  );
}

ProductCard.propTypes = { params: PropTypes.any };
