import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

// project imports
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

// third party - Lucide icons
import { Bell, ShoppingCart, FileText } from 'lucide-react';

const FEED_ICON_MAP = {
  bell: Bell,
  'shopping-cart': ShoppingCart,
  'file-text': FileText
};

// -----------------------|| FEED CARD ||-----------------------//

export default function FeedCard({ wrapclass, title, height, options }) {
  return (
    <div className={`card ${wrapclass || ''}`}>
      <div className="card-header">
        <h5 className="text-base font-semibold text-gray-800">{title}</h5>
      </div>
      <SimpleBar style={{ height }}>
        <div className="card-body space-y-4">
          {options.map((x, i) => {
            const IconComponent = FEED_ICON_MAP[x.icon] || Bell;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <IconComponent size={14} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={x.link || '#'} className="block">
                    <div className="flex items-center justify-between gap-2">
                      <h6 className="text-sm font-medium text-gray-700 mb-0 truncate">{x.heading}</h6>
                      <span className="text-xs text-gray-400 flex-shrink-0">{x.publishon}</span>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </SimpleBar>
    </div>
  );
}

FeedCard.propTypes = {
  wrapclass: PropTypes.string,
  title: PropTypes.string,
  height: PropTypes.string,
  options: PropTypes.any
};
