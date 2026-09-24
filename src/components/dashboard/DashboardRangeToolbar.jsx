import PropTypes from 'prop-types';
import { CalendarDays, RefreshCw } from 'lucide-react';

import { Button, Card, Col, Form, Row, Spinner } from 'components/ui/Bootstrap';

export default function DashboardRangeToolbar({ range, onRangeChange, onApply, onRefresh, loading, children }) {
  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Body className="py-3">
        <Form onSubmit={onApply}>
          <Row className="g-3 align-items-end justify-content-end">
            {children}
            <Col sm={6} lg={3} xl={2}>
              <Form.Label htmlFor="dashboard-from-date">From date</Form.Label>
              <Form.Control
                id="dashboard-from-date"
                type="date"
                value={range.fromDate}
                max={range.toDate}
                onChange={(event) => onRangeChange({ ...range, fromDate: event.target.value })}
              />
            </Col>
            <Col sm={6} lg={3} xl={2}>
              <Form.Label htmlFor="dashboard-to-date">To date</Form.Label>
              <Form.Control
                id="dashboard-to-date"
                type="date"
                value={range.toDate}
                min={range.fromDate}
                onChange={(event) => onRangeChange({ ...range, toDate: event.target.value })}
              />
            </Col>
            <Col xs="auto" className="d-flex gap-2">
              <Button type="submit" disabled={loading} className="d-inline-flex align-items-center gap-2">
                {loading ? <Spinner size="sm" /> : <CalendarDays size={15} />}
                Apply
              </Button>
              <Button
                variant="outline-secondary"
                disabled={loading}
                onClick={onRefresh}
                className="d-inline-flex align-items-center justify-content-center"
                aria-label="Refresh dashboard"
              >
                <RefreshCw size={15} />
              </Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

DashboardRangeToolbar.propTypes = {
  range: PropTypes.shape({ fromDate: PropTypes.string.isRequired, toDate: PropTypes.string.isRequired }).isRequired,
  onRangeChange: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  children: PropTypes.node
};
