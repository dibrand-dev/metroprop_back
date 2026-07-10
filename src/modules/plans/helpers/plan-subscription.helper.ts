/**
 * Calcula la fecha efectiva de baja de una suscripción.
 * Usa el día del mes de start_date (ej. compra el 9 → baja el próximo 9 posterior al cancel).
 */
export function computeScheduledEndDate(
  startDate: Date,
  cancelledAt: Date = new Date(),
): Date {
  const billingDay = startDate.getDate();
  const from = new Date(cancelledAt);

  let year = from.getFullYear();
  let month = from.getMonth();

  let candidate = dateWithClampedDay(year, month, billingDay);

  if (startOfDay(candidate).getTime() <= startOfDay(from).getTime()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = dateWithClampedDay(year, month, billingDay);
  }

  return startOfDay(candidate);
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** true cuando ya pasó el último día con beneficio (end_date inclusive). */
export function isSubscriptionEndDateReached(
  endDate?: Date | null,
  now: Date = new Date(),
): boolean {
  if (!endDate) {
    return false;
  }

  return startOfDay(now).getTime() > startOfDay(endDate).getTime();
}

export function isPurchasedPlanCurrentlyActive(
  active: boolean,
  endDate?: Date | null,
  now: Date = new Date(),
): boolean {
  if (!active) {
    return false;
  }

  return !isSubscriptionEndDateReached(endDate, now);
}

function dateWithClampedDay(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfMonth);
  return new Date(year, month, clampedDay);
}
