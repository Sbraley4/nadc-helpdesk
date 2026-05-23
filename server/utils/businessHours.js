/**
 * Business Hours Calculator
 * Calculates elapsed business hours between two dates using BusinessHours records
 */

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Minutes since midnight
 */
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get business hours for a specific day of week
 * @param {number} dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param {Array} businessHoursRecords - Array of BusinessHours from DB
 * @returns {Object|null} { openMinutes, closeMinutes } or null if closed
 */
function getBusinessHoursForDay(dayOfWeek, businessHoursRecords) {
  const record = businessHoursRecords.find(r => r.dayOfWeek === dayOfWeek);

  if (!record || !record.isOpen || !record.openTime || !record.closeTime) {
    return null;
  }

  return {
    openMinutes: parseTime(record.openTime),
    closeMinutes: parseTime(record.closeTime),
  };
}

/**
 * Calculate business hours elapsed between two dates
 * @param {Date} startDate - Start date/time
 * @param {Date} endDate - End date/time
 * @param {Array} businessHoursRecords - Array of BusinessHours records from DB
 * @returns {number} Number of business hours elapsed
 */
function calculateBusinessHours(startDate, endDate, businessHoursRecords) {
  if (!startDate || !endDate || endDate <= startDate) {
    return 0;
  }

  let totalMinutes = 0;
  const currentDate = new Date(startDate);

  // Iterate through each day
  while (currentDate < endDate) {
    const dayOfWeek = currentDate.getDay();
    const businessHours = getBusinessHoursForDay(dayOfWeek, businessHoursRecords);

    if (businessHours) {
      const { openMinutes, closeMinutes } = businessHours;

      // Get current time in minutes since midnight
      const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

      // Determine the end of this calculation period
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);

      const periodEnd = endDate < nextDay ? endDate : nextDay;
      const periodEndMinutes = periodEnd < nextDay
        ? periodEnd.getHours() * 60 + periodEnd.getMinutes()
        : 24 * 60;

      // Calculate overlap with business hours for this day
      if (currentDate.toDateString() === new Date(startDate).toDateString() &&
          currentDate.toDateString() === endDate.toDateString()) {
        // Start and end on same day
        const effectiveStart = Math.max(currentMinutes, openMinutes);
        const effectiveEnd = Math.min(periodEndMinutes, closeMinutes);

        if (effectiveEnd > effectiveStart) {
          totalMinutes += effectiveEnd - effectiveStart;
        }
      } else if (currentDate.toDateString() === new Date(startDate).toDateString()) {
        // First day
        const effectiveStart = Math.max(currentMinutes, openMinutes);
        const effectiveEnd = closeMinutes;

        if (effectiveEnd > effectiveStart) {
          totalMinutes += effectiveEnd - effectiveStart;
        }
      } else if (currentDate.toDateString() === endDate.toDateString()) {
        // Last day
        const effectiveStart = openMinutes;
        const effectiveEnd = Math.min(periodEndMinutes, closeMinutes);

        if (effectiveEnd > effectiveStart) {
          totalMinutes += effectiveEnd - effectiveStart;
        }
      } else {
        // Full day in between
        totalMinutes += closeMinutes - openMinutes;
      }
    }

    // Move to next day at midnight
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return totalMinutes / 60; // Convert to hours
}

/**
 * Calculate simple wall-clock hours between two dates
 * @param {Date} startDate - Start date/time
 * @param {Date} endDate - End date/time
 * @returns {number} Number of hours elapsed
 */
function calculateWallClockHours(startDate, endDate) {
  if (!startDate || !endDate || endDate <= startDate) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  return diffMs / (1000 * 60 * 60);
}

module.exports = {
  calculateBusinessHours,
  calculateWallClockHours,
  parseTime,
  getBusinessHoursForDay,
};
