// Display-only date formatting for the สท.2/สท.3 forms, which show
// DD.MM.YYYY in the Buddhist Era (matching the manual's worked examples,
// e.g. "01.05.2543"). The canonical stored value everywhere else in the
// system stays ISO Gregorian; this is purely a presentation string written
// into a text cell, never parsed back.

import { ceToBe, parseIsoDate } from "../domain/fiscal";

export function formatDateDmyBe(iso: string | null | undefined): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const day = String(date.day).padStart(2, "0");
  const month = String(date.month).padStart(2, "0");
  const yearBe = ceToBe(date.year);
  return `${day}.${month}.${yearBe}`;
}
