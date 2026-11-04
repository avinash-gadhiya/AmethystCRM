import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppModal from '@/components/common/AppModal';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import GlassRecordsHeader from '@/components/common/GlassRecordsHeader';
import IosToggle from '@/components/common/IosToggle';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import { TableCard } from '@/components/common/page-card';
import groupService from '@/services/groupService';
import leadSchedulerService from '@/services/leadSchedulerService';
import { shiftTimeInput } from '@/lib/leadScheduler';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import ApiDataViewer from './api/components/ApiDataViewer';
import ScheduleTimeFields from './ScheduleTimeFields';
import './api/lead-scheduler.css';
import NativeLiquidSelect from '@/components/common/liquid-membrane/NativeLiquidSelect';

const OPERATION = { path: '/LeadScheduler' };
const EMPTY_FORM = { groupId: '', groupName: '', shiftStartTime: '', shiftEndTime: '', isActive: true };

export default function LeadSchedulerPage() {
  const permissions = useMemo(() => resolveConfiguredPagePermissions('/LeadScheduler'), []);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [lookupVersion, setLookupVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setGroupsLoading(true);
    setGroupsError('');
    groupService
      .getGroupDropdownOptions(controller.signal, true)
      .then((rows) => {
        if (!controller.signal.aborted) {
          setGroups(rows);
          if (!rows.length) setGroupsError('No groups were returned. Add a group or retry loading the list.');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setGroupsError(getApiErrorMessage(error, 'Unable to load groups.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false);
      });
    return () => controller.abort();
  }, [open, lookupVersion]);

  const edit = (schedule = null) => {
    if (schedule ? !permissions.canUpdate : !permissions.canAdd) return;
    setExisting(schedule);
    setForm(
      schedule
        ? {
            groupId: String(schedule.groupId || ''),
            groupName: schedule.groupName || '',
            shiftStartTime: shiftTimeInput(schedule.shiftStartTime),
            shiftEndTime: shiftTimeInput(schedule.shiftEndTime),
            isActive: schedule.isActive === true
          }
        : { ...EMPTY_FORM }
    );
    setSaveError('');
    setOpen(true);
  };
  const close = () => {
    if (!savingRef.current) setOpen(false);
  };
  const save = async (event) => {
    event.preventDefault();
    if (savingRef.current || (existing ? !permissions.canUpdate : !permissions.canAdd)) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (existing) await leadSchedulerService.updateSchedule(form, existing);
      else await leadSchedulerService.createSchedule(form);
      setOpen(false);
      setRefresh((value) => value + 1);
      toast.success(existing ? 'Schedule updated.' : 'Schedule created.');
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Unable to save this schedule.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (deletingRef.current || !deleteTarget || !permissions.canDelete) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await leadSchedulerService.deleteSchedule(deleteTarget.leadSchedulerId);
      setDeleteTarget(null);
      setRefresh((value) => value + 1);
      toast.success('Schedule deleted.');
    } catch (error) {
      setDeleteError(getApiErrorMessage(error, 'Unable to delete this schedule.'));
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };
  const groupOptions = groups.filter((group) => group.isActive || Number(group.id) === Number(existing?.groupId));
  if (existing?.groupId && !groupOptions.some((group) => Number(group.id) === Number(existing.groupId))) {
    groupOptions.unshift({ id: existing.groupId, name: existing.groupName || `Group #${existing.groupId}` });
  }

  return (
    <div className="lead-scheduler-page crm-records-page">
      <GlassRecordsHeader
        icon={CalendarClock}
        eyebrow="LEAD MANAGEMENT"
        title="Lead Scheduler"
        description="Manage group schedules and shift times."
      >
        {permissions.canAdd && (
          <LiquidGlassButton className="scheduler-add-button" onClick={() => edit()}>
            <Plus size={16} />
            Add Schedule
          </LiquidGlassButton>
        )}
      </GlassRecordsHeader>
      <TableCard className="scheduler-data-card crm-records-card">
        {permissions.canView ? (
          <ApiDataViewer
            operation={OPERATION}
            title="Group schedules"
            presentation="scheduler"
            reloadToken={refresh}
            onEdit={permissions.canUpdate ? edit : undefined}
            onDelete={
              permissions.canDelete
                ? (row) => {
                    setDeleteError('');
                    setDeleteTarget(row);
                  }
                : undefined
            }
          />
        ) : (
          <p className="p-6 text-sm text-slate-500">You do not have permission to view lead schedules.</p>
        )}
      </TableCard>

      <AppModal
        open={open}
        onClose={close}
        busy={saving}
        onSubmit={save}
        icon={CalendarClock}
        title={existing ? 'Edit Schedule' : 'Add Schedule'}
        description="Choose a group and its shift times."
        footer={
          <>
            <LiquidGlassButton variant="secondary" disabled={saving} onClick={close}>
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton type="submit" loading={saving} disabled={saving || groupsLoading}>
              {existing ? 'Save Changes' : 'Create Schedule'}
            </LiquidGlassButton>
          </>
        }
      >
        {saveError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {saveError}
          </div>
        )}
        {groupsError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {groupsError}{' '}
            <button type="button" className="font-semibold underline" onClick={() => setLookupVersion((value) => value + 1)}>
              Retry
            </button>
          </div>
        )}
        <fieldset disabled={saving} className="scheduler-form">
          <label className="scheduler-form-group">
            Group <span aria-hidden="true">*</span>
            <NativeLiquidSelect
              aria-label="Schedule group"
              required
              value={form.groupId}
              disabled={groupsLoading}
              onChange={(event) => {
                const selected = groupOptions.find((group) => String(group.id) === event.target.value);
                setForm((current) => ({ ...current, groupId: event.target.value, groupName: selected?.name || '' }));
              }}
            >
              <option value="">{groupsLoading ? 'Loading groups...' : 'Select a group'}</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </NativeLiquidSelect>
          </label>
          <ScheduleTimeFields
            startValue={form.shiftStartTime}
            endValue={form.shiftEndTime}
            disabled={saving}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Shifts can continue past midnight.</p>
          <div className="scheduler-form-status">
            <div>
              <strong>Schedule status</strong>
              <p>{form.isActive ? 'This schedule is active.' : 'This schedule is inactive.'}</p>
            </div>
            <IosToggle
              checked={form.isActive}
              disabled={saving}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              aria-label="Active schedule"
            />
          </div>
        </fieldset>
      </AppModal>
      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Schedule"
        itemName={deleteTarget?.groupName || `Schedule #${deleteTarget?.leadSchedulerId}`}
        loading={deleting}
        onCancel={() => {
          if (!deletingRef.current) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        message={
          deleteError ? (
            <div role="alert" className="text-rose-600">
              {deleteError} You can retry deleting this schedule.
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
