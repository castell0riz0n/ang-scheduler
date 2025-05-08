import { Injectable, signal } from '@angular/core';
import {
  parseISO, format as formatDateFns, addDays, addMonths, addWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, getDay, setHours as dfnsSetHours, // alias to avoid conflict
  setMinutes as dfnsSetMinutes, setSeconds as dfnsSetSeconds,
  isWithinInterval, getHours as dfnsGetHours, getMinutes as dfnsGetMinutes,
  addHours as dfnsAddHours, addMinutes as dfnsAddMinutes, // alias
  differenceInMinutes, startOfDay, endOfDay, isValid,
  Locale,
  setHours, isBefore
} from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { da, de, enUS, es, fr, it, ja, ko, nl, pl, pt, ru, zhCN } from 'date-fns/locale'; // Import locales you need
import { CalendarEvent } from '../models/calendar-event.model';

// Map locales for date-fns
const dateFnsLocales: { [key: string]: Locale } = {
  'en-US': enUS, 'de-DE': de, 'fr-FR': fr, 'es-ES': es, 'it-IT': it,
  'pt-PT': pt, 'nl-NL': nl, 'pl-PL': pl, 'ru-RU': ru, 'ja-JP': ja,
  'ko-KR': ko, 'zh-CN': zhCN, 'da-DK': da
  // Add more as needed
};

@Injectable({
  providedIn: 'root', // Or provided in SchedulerModule if more contained
})
export class DateUtilService {
  private defaultLocale = signal<Locale>(enUS);
  private defaultTimeZone = signal<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  constructor() {}


  getLocale(localeCode?: string): Locale {
    return localeCode && dateFnsLocales[localeCode] ? dateFnsLocales[localeCode] : this.defaultLocale();
  }

  setTimeZone(timeZone?: string): void {
    this.defaultTimeZone.set(timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  setLocale(localeCode: string): void {
    const newLocale = dateFnsLocales[localeCode];
    if (newLocale) {
      this.defaultLocale.set(newLocale);
    } else {
      console.warn(`Locale ${localeCode} not found for date-fns, using default.`);
      this.defaultLocale.set(enUS); // Fallback to enUS
    }
  }

  // --- Core Date Parsing and Formatting ---
  parseISOString(dateString: string): Date { // Expects UTC ISO string ("...Z")
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : new Date();
  }

  toIsoString(date: Date): string { // Returns UTC ISO string ("...Z")
    return date.toISOString();
  }

  parseWithTz(dateString: string, timeZone: string): Date {
    // Assuming dateString is like '2023-01-01T10:00:00' and IS a local time in that TZ
    // If dateString is UTC '2023-01-01T10:00:00Z', use parseISO directly
    // For local times in TZ, convert to UTC first for consistent Date objects
    const parsedAsNaive = parseISO(dateString); // Date-fns parses as local machine if no Z
    return this.zonedTimeToUtc(parsedAsNaive, timeZone); // More robust might be needed based on source string nature
  }

  parseNaiveStringWithTz(naiveDateString: string, timeZone: string): Date {
    if (naiveDateString.includes('Z') || naiveDateString.match(/[+-]\d{2}:?\d{2}$/)) {
      console.warn(`parseNaiveStringWithTz called with a non-naive string: ${naiveDateString}. Parsing as ISO string directly.`);
      return this.parseISOString(naiveDateString);
    }
    // `parseISO` on a naive string creates a Date object as if it's local machine time.
    // Then `zonedTimeToUtc` correctly interprets this naive time as being in `timeZone`.
    const dateInMachineLocal = parseISO(naiveDateString);
    return this.zonedTimeToUtc(dateInMachineLocal, timeZone);
  }

  convertToZone(date: Date, timeZone: string): Date { // Input is UTC Date, output is also UTC Date (conceptually representing time in TZ)
    return toZonedTime(date, timeZone);
  }

  formatInTimeZone(date: Date, timeZone: string, formatString: string, localeCode?: string): string {
    const loc = localeCode ? this.getLocale(localeCode) : this.defaultLocale();
    // date is expected to be a UTC Date object. formatInTimeZone handles the conversion.
    try {
      return formatInTimeZone(date, timeZone, formatString, { locale: loc });
    } catch (error) {
      console.error("Error formatting date in timezone:", {date, timeZone, formatString, locale: loc}, error);
      return formatDateFns(date, formatString, { locale: loc }); // Fallback to basic format
    }
  }

  format(date: Date, formatString: string, locale?: string, timeZone?: string): string {
    const loc = locale ? this.getLocale(locale) : this.defaultLocale();
    const tz = timeZone || this.defaultTimeZone();
    try {
      return formatInTimeZone(date, tz, formatString, { locale: loc });
    } catch (error) {
      console.error("Error formatting date in timezone:", {date, tz, formatString, locale: loc}, error);
      // Fallback to basic formatting if tz fails
      return formatDateFns(date, formatString, { locale: loc });
    }
  }


  // --- View Range Generation ---
  getMonthViewRange(date: Date, localeCode?: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1 /* Monday */) {
    const loc = this.getLocale(localeCode);
    const start = startOfWeek(startOfMonth(date), { locale: loc, weekStartsOn });
    const end = endOfWeek(endOfMonth(date), { locale: loc, weekStartsOn });
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }

  getWeekViewRange(date: Date, localeCode?: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
    const loc = this.getLocale(localeCode);
    const start = startOfWeek(date, { locale: loc, weekStartsOn });
    const end = endOfWeek(date, { locale: loc, weekStartsOn });
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }

  getDayViewRange(date: Date) {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return {
      start,
      end,
      days: [new Date(start)] // For day view, there's only one day
    };
  }

  getHoursOfDay(baseDate: Date, startHour: number, endHour: number, tz: string): { date: Date, label: string }[] {
    const hours: { date: Date, label: string }[] = [];
    let current = dfnsSetMinutes(setHours(startOfDay(baseDate), startHour),0);
    for (let i = startHour; i < endHour; i++) {
      const zonedHour = this.convertToZone(current, tz);
      hours.push({
        date: new Date(current), // Store as UTC internal representation
        label: this.format(zonedHour, 'p', undefined, tz) // Format in target TZ
      });
      current = this.addHours(current,1);
    }
    return hours;
  }

  // --- Date Manipulations ---
  addDays = addDays;
  addWeeks = addWeeks;
  addMonths = addMonths;
  isSameDay = isSameDay;
  isSameMonth = isSameMonth;
  getDay = getDay; // Day of week (0 for Sunday)
  isWithinInterval = isWithinInterval;
  startOfDay = startOfDay;
  differenceInMinutes = differenceInMinutes;
  setHours = dfnsSetHours;
  setMinutes = dfnsSetMinutes;
  setSeconds = dfnsSetSeconds;
  addHours = dfnsAddHours;
  addMinutes = dfnsAddMinutes;
  getHours = dfnsGetHours;
  getMinutes = dfnsGetMinutes;

  // --- Recurrence Expansion ---
  expandRecurrences(
    events: CalendarEvent[],
    viewStartUtc: Date, // View range should be UTC
    viewEndUtc: Date,   // View range should be UTC
    timeZone: string // For interpreting recurrence rule's DTSTART if it has a TZID. For now, assume event.start is UTC.
  ): CalendarEvent[] {
    const allEvents: CalendarEvent[] = [];

    events.forEach(event => {
      if (event.recurrenceRule) {
        try {
          // RRULEs are sensitive to DTSTART.
          // Assuming `event.start` is already a UTC ISO string.
          const dtstartUtc = this.parseISOString(event.start);

          // rrule.js by default works with local times unless `tzid` is in RRULE or dtstart is UTC.
          // To be safe, ensure RRule operates in UTC context if dtstart is UTC.
          const rruleOptions = RRule.parseString(event.recurrenceRule);
          // If RRULE contains TZID, RRule.options.tzid will be set. date-fns-tz should handle that for dates.
          // For simplicity, if event.start is UTC, rule usually implies UTC occurrences.

          const rule = new RRule({
            ...rruleOptions,
            dtstart: dtstartUtc
          });

          const ruleSet = new RRuleSet();
          ruleSet.rrule(rule);

          if (event.exDate) { // EXDATEs should also be UTC if DTSTART is UTC
            event.exDate.forEach(ex => ruleSet.exdate(this.parseISOString(ex)));
          }

          // Generate occurrences within UTC view range
          const occurrencesUtc = ruleSet.between(addDays(viewStartUtc, -7), addDays(viewEndUtc, 7), true);

          occurrencesUtc.forEach(occurrenceDateUtc => {
            const originalStartUtc = this.parseISOString(event.start);
            const originalEndUtc = this.parseISOString(event.end);
            const duration = differenceInMinutes(originalEndUtc, originalStartUtc);

            const newStartUtc = occurrenceDateUtc;
            const newEndUtc = this.addMinutes(newStartUtc, duration);

            allEvents.push({
              ...event,
              id: `${event.id}_${this.toIsoString(newStartUtc)}`,
              start: this.toIsoString(newStartUtc),
              end: this.toIsoString(newEndUtc),
              recurrenceRule: undefined,
            });
          });
        } catch (e) {
          console.error('Error parsing RRULE for event:', event.id, e);
          const eventStartUtc = this.parseISOString(event.start);
          const eventEndUtc = this.parseISOString(event.end);
          if(
            // Event starts within view
            this.isWithinInterval(eventStartUtc, {start: viewStartUtc, end: viewEndUtc}) ||
            // Event ends within view
            this.isWithinInterval(eventEndUtc, {start: viewStartUtc, end: viewEndUtc}) ||
            // Event spans the entire view
            (isBefore(eventStartUtc, viewStartUtc) && isBefore(viewEndUtc, eventEndUtc))
          ){
            allEvents.push({...event, recurrenceRule: undefined}); // Add base if it falls in range & rule fails
          }
        }
      } else {
        allEvents.push(event);
      }
    });
    return allEvents;
  }

  getDropDate(baseDate: Date, hour?: number, minute?: number, timeZone?: string): Date {
    let newDate = new Date(baseDate); // baseDate should be a Date object in UTC
    if (hour !== undefined) newDate = setHours(newDate, hour);
    if (minute !== undefined) newDate = this.setMinutes(newDate, minute || 0);
    newDate = this.setSeconds(newDate,0); // Clear seconds
    // If baseDate was representing a date in a specific TZ, convert this new UTC date back to that TZ conceptually for newStart/newEnd ISO strings
    // This is complex. Assume baseDate already carries the correct "day" information.
    // The event's newStart/newEnd string must be an ISO string interpretable by parseWithTz.
    // For now, let's return UTC. The emitted ISO string will be from this UTC.
    return newDate;
  }

  zonedTimeToUtc(zonedDate: Date, timeZone: string): Date {
    const date = new Date(zonedDate.getTime());
    const tzOffset = new Date(date.toLocaleString('en-US', { timeZone })).getTime() -
      new Date(date.toLocaleString('en-US')).getTime();
    return new Date(date.getTime() - tzOffset);
  }
}
