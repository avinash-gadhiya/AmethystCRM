import PropTypes from 'prop-types';
import LiquidGlassSurface from './LiquidGlassSurface';
import '@/styles/records-glass.css';

export default function GlassRecordsHeader({ icon: Icon, eyebrow, title, description, children }) {
  return (
    <LiquidGlassSurface className="crm-records-header">
      <div className="crm-records-heading">
        <span className="crm-records-icon" aria-hidden="true"><Icon size={25} /></span>
        <div>
          <span className="crm-records-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className="crm-records-actions">{children}</div>
    </LiquidGlassSurface>
  );
}

GlassRecordsHeader.propTypes = {
  icon: PropTypes.elementType.isRequired,
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node
};
