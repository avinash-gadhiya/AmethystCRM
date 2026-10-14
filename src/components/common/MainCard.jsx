import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { Maximize2, Minimize2, Minus, Plus, RefreshCw, Trash2, MoreHorizontal } from 'lucide-react';

// -----------------------|| MAIN CARD ||-----------------------//

export default function MainCard({ isOption, title, children, cardClass, CardBodyClass }) {
  const [fullCard, setFullCard] = useState(false);
  const [collapseCard, setCollapseCard] = useState(false);
  const [loadCard, setLoadCard] = useState(false);
  const [cardRemove, setCardRemove] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  if (cardRemove) return null;

  const cardReloadHandler = () => {
    setLoadCard(true);
    setMenuOpen(false);
    setTimeout(() => setLoadCard(false), 3000);
  };

  const mainCardClass = [
    'card',
    fullCard ? 'fixed inset-0 z-50 rounded-none' : '',
    cardClass || ''
  ]
    .filter(Boolean)
    .join(' ');

  const bodyClass = ['card-body', CardBodyClass || ''].filter(Boolean).join(' ');

  return (
    <div className={mainCardClass}>
      {/* Header */}
      {title && (
        <div className="card-header flex items-center justify-between">
          <h5 className="text-base font-semibold text-gray-800 mb-0">{title}</h5>
          {isOption && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="neu-icon-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Card options"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => { setFullCard(!fullCard); setMenuOpen(false); }}
                  >
                    {fullCard ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    {fullCard ? 'Restore' : 'Maximize'}
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => { setCollapseCard(!collapseCard); setMenuOpen(false); }}
                  >
                    {collapseCard ? <Plus size={14} /> : <Minus size={14} />}
                    {collapseCard ? 'Expand' : 'Collapse'}
                  </button>
                  <button type="button" className="dropdown-item" onClick={cardReloadHandler}>
                    <RefreshCw size={14} /> Reload
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item text-red-500"
                    onClick={() => { setCardRemove(true); setMenuOpen(false); }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {!collapseCard && (
        <div className={bodyClass}>
          {loadCard ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

MainCard.defaultProps = {
  isOption: true,
};

MainCard.propTypes = {
  isOption: PropTypes.bool,
  title: PropTypes.string,
  children: PropTypes.node,
  cardClass: PropTypes.string,
  CardBodyClass: PropTypes.string
};
