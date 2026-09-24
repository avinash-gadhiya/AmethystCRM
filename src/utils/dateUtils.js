export const toInputDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthToDateRange = (referenceDate = new Date()) => ({
  fromDate: toInputDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
  toDate: toInputDate(referenceDate)
});

export const isValidDateRange = ({ fromDate, toDate }) => Boolean(fromDate && toDate && fromDate <= toDate);
