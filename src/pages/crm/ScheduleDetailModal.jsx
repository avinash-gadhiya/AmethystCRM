import PropTypes from 'prop-types';
import { CalendarClock, Clock3, Users } from 'lucide-react';
import AppModal from '@/components/common/AppModal';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import { formatApiValue } from '@/lib/apiData';
import { formatShiftTime } from '@/lib/leadScheduler';

export default function ScheduleDetailModal({ record, onClose }) {
  const activity = record
    ? [
        { label: 'Created', date: record.createdDate, name: record.createdByName, userId: record.createdBy },
        { label: 'Last updated', date: record.updatedDate, name: record.updatedByName, userId: record.updatedBy }
      ]
    : [];
  return (
    <AppModal
      open={Boolean(record)}
      onClose={onClose}
      icon={CalendarClock}
      title="Schedule details"
      description={record ? `Schedule #${record.leadSchedulerId ?? '-'}` : ''}
      size="lg"
      className="scheduler-details-dialog"
      footer={<LiquidGlassButton onClick={onClose}>Close</LiquidGlassButton>}
    >
      {record && (
        <div className="scheduler-details">
          <section className="scheduler-details-summary" aria-label="Schedule overview">
            <span className="scheduler-details-group-icon" aria-hidden="true">
              <Users size={23} />
            </span>
            <div className="scheduler-details-group">
              <span>Assigned group</span>
              <h3>{record.groupName || 'Unnamed group'}</h3>
              <small>Group ID: {record.groupId ?? '-'}</small>
            </div>
            <span className="scheduler-status" data-active={record.isActive === true}>
              {record.isActive === true ? 'Active' : record.isActive === false ? 'Inactive' : 'Unknown status'}
            </span>
          </section>

          <section aria-labelledby="schedule-shift-heading">
            <h4 id="schedule-shift-heading" className="scheduler-details-heading">
              Shift times
            </h4>
            <dl className="scheduler-details-times">
              {[
                { label: 'Shift start', value: record.shiftStartTime },
                { label: 'Shift end', value: record.shiftEndTime }
              ].map((field) => (
                <div key={field.label}>
                  <dt>
                    <Clock3 size={15} aria-hidden="true" />
                    {field.label}
                  </dt>
                  <dd>{formatShiftTime(field.value) || '-'}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="schedule-activity-heading">
            <h4 id="schedule-activity-heading" className="scheduler-details-heading">
              Activity
            </h4>
            <div className="scheduler-details-activity">
              {activity.map((entry) => (
                <section key={entry.label} aria-label={entry.label}>
                  <h5>{entry.label}</h5>
                  <p>{formatApiValue(entry.date, 'date')}</p>
                  <strong>{entry.name || (entry.userId ? `User #${entry.userId}` : '-')}</strong>
                  <small>User ID: {entry.userId ?? '-'}</small>
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppModal>
  );
}

ScheduleDetailModal.propTypes = { record: PropTypes.object, onClose: PropTypes.func.isRequired };
