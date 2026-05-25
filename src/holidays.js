// Indian national / gazetted holidays. Update yearly.
// Format: YYYY-MM-DD => name
export const HOLIDAYS = {
  // 2026
  '2026-01-01': 'New Year Day',
  '2026-01-14': 'Sankranti / Pongal',
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-19': 'Ugadi',
  '2026-03-21': 'Eidul Fitr (Ramzan)',
  '2026-04-03': 'Good Friday',
  '2026-08-15': 'Independence Day',
  '2026-09-14': 'Vinayaka Chavithi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Vijaya Dashami / Dussehra',
  '2026-11-08': 'Deepavali',
  '2026-12-25': 'Christmas',

  // 2027 (placeholders — verify against gazette before relying on these)
  '2027-01-26': 'Republic Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Gandhi Jayanti',
  '2027-12-25': 'Christmas',
};

/**
 * Returns the IST date string YYYY-MM-DD for the given Date (or now).
 */
export function istDateString(date = new Date()) {
  // en-CA locale yields YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Check whether the given date (default: today in IST) is an Indian holiday.
 * Returns the holiday name or null.
 */
export function holidayName(date = new Date()) {
  const key = istDateString(date);
  return HOLIDAYS[key] ?? null;
}

export function isHoliday(date = new Date()) {
  return holidayName(date) !== null;
}
