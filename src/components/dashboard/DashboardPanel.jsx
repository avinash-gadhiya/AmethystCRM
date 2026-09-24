import PropTypes from 'prop-types';

import { Card, Spinner } from 'components/ui/Bootstrap';

export default function DashboardPanel({ title, children, loading = false, empty = false, emptyMessage = 'No data found.', action }) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header className="bg-transparent d-flex align-items-center justify-content-between gap-3 py-3">
        <h5 className="mb-0 fw-semibold">{title}</h5>
        {action}
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="d-flex align-items-center justify-content-center text-muted gap-2" style={{ minHeight: 280 }}>
            <Spinner size="sm" /> Loading data...
          </div>
        ) : empty ? (
          <div className="d-flex align-items-center justify-content-center text-muted" style={{ minHeight: 280 }}>
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </Card.Body>
    </Card>
  );
}

DashboardPanel.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  loading: PropTypes.bool,
  empty: PropTypes.bool,
  emptyMessage: PropTypes.string,
  action: PropTypes.node
};

