import PropTypes from 'prop-types';
import { RefreshCw } from 'lucide-react';

import { Badge, Button, Card, Col, Form, Row, Spinner } from 'components/ui/Bootstrap';

export default function DashboardDateFilter({ value, onChange, onApply, onRefresh, loading, connectedCount, totalCount }) {
  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
        <div>
          <h5 className="mb-1 fw-semibold">CRM Dashboard</h5>
          <span className="text-muted small">Live sales, leads, financial and service data</span>
        </div>
        <Badge bg={connectedCount === totalCount ? 'success' : 'warning'} className="px-3 py-2">
          {loading ? 'Syncing APIs...' : `${connectedCount}/${totalCount} APIs connected`}
        </Badge>
      </Card.Header>
      <Card.Body>
        <Form onSubmit={onApply}>
          <Row className="g-3 align-items-end">
            <Col sm={6} lg={3} xl={2}>
              <Form.Label>From date</Form.Label>
              <Form.Control
                type="date"
                value={value.fromDate}
                max={value.toDate}
                onChange={(event) => onChange({ ...value, fromDate: event.target.value })}
              />
            </Col>
            <Col sm={6} lg={3} xl={2}>
              <Form.Label>To date</Form.Label>
              <Form.Control
                type="date"
                value={value.toDate}
                min={value.fromDate}
                onChange={(event) => onChange({ ...value, toDate: event.target.value })}
              />
            </Col>
            <Col lg={4} xl={3} className="d-flex gap-2">
              <Button type="submit" disabled={loading} className="d-inline-flex align-items-center justify-content-center gap-2">
                {loading && <Spinner size="sm" />}
                Apply
              </Button>
              <Button
                variant="outline-secondary"
                disabled={loading}
                onClick={onRefresh}
                className="d-inline-flex align-items-center justify-content-center gap-2"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Refresh
              </Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

DashboardDateFilter.propTypes = {
  value: PropTypes.shape({ fromDate: PropTypes.string.isRequired, toDate: PropTypes.string.isRequired }).isRequired,
  onChange: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  connectedCount: PropTypes.number.isRequired,
  totalCount: PropTypes.number.isRequired
};

