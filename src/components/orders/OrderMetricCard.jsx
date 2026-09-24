import PropTypes from 'prop-types';

export default function OrderMetricCard({ label, value, icon: Icon, tone = 'primary', detail }) {
  return (
    <div className="order-metric-card">
      <div>
        <span className="order-metric-label">{label}</span>
        <strong className="order-metric-value">{value}</strong>
        {detail && <span className="order-metric-detail">{detail}</span>}
      </div>
      <span className={`order-metric-icon order-metric-icon-${tone}`} aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
    </div>
  );
}

OrderMetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  icon: PropTypes.elementType.isRequired,
  tone: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  detail: PropTypes.string
};