import PropTypes from 'prop-types';
import '@/styles/liquid-glass-surfaces.css';

export default function LiquidGlassSurface({
  as: Component = 'div',
  glass = true,
  allowOverflow = false,
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={`${glass ? 'glass-surface daily-sales-glass__card ' : ''}${allowOverflow ? 'liquid-glass-surface--overflow ' : ''}${className}`}
      {...props}
    >
      {glass && <span className="daily-sales-glass__rim" aria-hidden="true" />}
      {children}
    </Component>
  );
}

LiquidGlassSurface.propTypes = {
  as: PropTypes.elementType,
  glass: PropTypes.bool,
  allowOverflow: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node
};
