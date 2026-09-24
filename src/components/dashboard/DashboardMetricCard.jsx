import PropTypes from 'prop-types';

import { Card } from 'components/ui/Bootstrap';

const TONES = {
  primary: { background: 'bg-indigo-50', foreground: 'text-indigo-600' },
  success: { background: 'bg-emerald-50', foreground: 'text-emerald-600' },
  warning: { background: 'bg-amber-50', foreground: 'text-amber-600' },
  danger: { background: 'bg-red-50', foreground: 'text-red-600' }
};

export default function DashboardMetricCard({ icon: Icon, label, value, detail, tone = 'primary' }) {
  const colors = TONES[tone] || TONES.primary;

  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="d-flex align-items-center gap-3 p-4">
        <span className={`d-inline-flex align-items-center justify-content-center rounded-4 p-3 ${colors.background} ${colors.foreground}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="small text-muted">{label}</div>
          <div className="fs-4 fw-bold text-dark text-truncate">{value}</div>
          <div className="small text-muted text-truncate">{detail}</div>
        </div>
      </Card.Body>
    </Card>
  );
}

DashboardMetricCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  detail: PropTypes.node,
  tone: PropTypes.oneOf(Object.keys(TONES))
};

