const TICKS_PER_SECOND = 10000000;
const DAY_TICKS = 86400 * TICKS_PER_SECOND;

export const shiftTimeTicks = (value) => {
  if (value && typeof value === 'object') {
    const ticks = Number(value.ticks ?? value.Ticks);
    if (Number.isSafeInteger(ticks) && ticks >= 0 && ticks < DAY_TICKS) return ticks;
  } else {
    const match = String(value ?? '').match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/);
    if (match) {
      const [, hours, minutes, seconds = '0', fraction = ''] = match;
      if (Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60) {
        return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * TICKS_PER_SECOND + Number(fraction.padEnd(7, '0'));
      }
    }
  }
  throw new Error('Choose a valid shift time.');
};

export const formatShiftTime = (value) => {
  try {
    const ticks = shiftTimeTicks(value);
    const seconds = Math.floor(ticks / TICKS_PER_SECOND);
    const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, '0'));
    const fraction = String(ticks % TICKS_PER_SECOND)
      .padStart(7, '0')
      .replace(/0+$/, '');
    return parts.join(':') + (fraction ? `.${fraction}` : '');
  } catch {
    return '';
  }
};

// Native time inputs support milliseconds. Preserve any finer stored precision
// when an existing field is left unchanged during an edit.
export const shiftTimeInput = (value) =>
  formatShiftTime(value)
    .replace(/(\.\d{3})\d+$/, '$1')
    .replace(/\.0+$/, '');

export const buildLeadSchedulerPayload = (form, { existing = null, user, now = new Date() } = {}) => {
  const actorId = Number(user?.userId);
  if (!Number.isInteger(actorId) || actorId <= 0) throw new Error('Your user session is unavailable. Please sign in again.');
  const groupId = Number(form.groupId);
  const groupName = String(form.groupName || '').trim();
  if (!Number.isInteger(groupId) || groupId <= 0 || !groupName) throw new Error('Select a group for this schedule.');
  const id = existing ? Number(existing.leadSchedulerId) : 0;
  if (existing && (!Number.isInteger(id) || id <= 0)) throw new Error('A valid schedule ID is required.');
  const time = (key) => ({
    ticks: shiftTimeTicks(existing && form[key] === shiftTimeInput(existing[key]) ? existing[key] : form[key])
  });
  const actorName = String(user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.userName || '');
  return {
    leadSchedulerId: id,
    isActive: form.isActive === true,
    groupId,
    groupName,
    shiftStartTime: time('shiftStartTime'),
    shiftEndTime: time('shiftEndTime'),
    createdDate: existing ? existing.createdDate : now.toISOString(),
    updatedDate: now.toISOString(),
    createdBy: existing ? existing.createdBy : actorId,
    createdByName: existing ? existing.createdByName : actorName,
    updatedBy: actorId,
    updatedByName: actorName
  };
};
