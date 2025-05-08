
import { Injectable, signal, computed, inject } from '@angular/core';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel, HourViewModel } from '../models/calendar-event.model';
import { DateUtilService } from './date.service';
import { SchedulerLayoutService } from './scheduler-layout.service';
import {
  parseISO, startOfDay, endOfDay, isWithinInterval,
  isBefore, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval
} from 'date-fns';

export type SchedulerView = 'month' | 'week' | 'day';

export interface SchedulerFilter {
  from?: string; // ISO date string
  to?: string; // ISO date string
  types?: string[];
  keyword?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulerStateService {
  private dateUtil = inject(DateUtilService);
  private layoutService = inject(SchedulerLayoutService);

  // State signals
  private _events = signal<CalendarEvent[]>([]);
  private _currentView = signal<SchedulerView>('month');
  private _currentDate = signal<string>(new Date().toISOString());
  private _filter = signal<SchedulerFilter>({});
  private _locale = signal<string>(navigator.language || 'en-US');
  private _timeZone = signal<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  private _dayStartHour = signal<number>(0);
  private _dayEndHour = signal<number>(24);
  private _weekStartsOn = signal<0 | 1 | 2 | 3 | 4 | 5 | 6>(1);

  // Computed values
  readonly parsedCenterDate = computed(() => {
    try {
      return parseISO(this._currentDate());
    } catch (e) {
      console.error("Invalid centerDate:", this._currentDate(), e);
      return new Date();
    }
  });

  // Get the date range for the current view
  readonly viewDateRange = computed(() => {
    const date = this.parsedCenterDate();
    const loc = this._locale();
    const ws = this._weekStartsOn();

    switch (this._currentView()) {
      case 'month':
        return this.dateUtil.getMonthViewRange(date, loc, ws);
      case 'week':
        return this.dateUtil.getWeekViewRange(date, loc, ws);
      case 'day':
      default:
        return this.dateUtil.getDayViewRange(date);
    }
  });

  // Filtered and processed events
  readonly filteredEvents = computed(() => {
    const events = this._events();
    const filter = this._filter();
    const tz = this._timeZone();

    // Apply filters
    let filteredEvents = [...events];

    if (filter.from) {
      const filterFromDate = this.dateUtil.parseWithTz(filter.from, tz);
      filteredEvents = filteredEvents.filter(event => {
        const eventEnd = this.dateUtil.parseWithTz(event.end, tz);
        return !isBefore(eventEnd, filterFromDate);
      });
    }

    if (filter.to) {
      const filterToDate = this.dateUtil.parseWithTz(filter.to, tz);
      filteredEvents = filteredEvents.filter(event => {
        const eventStart = this.dateUtil.parseWithTz(event.start, tz);
        return !isBefore(filterToDate, eventStart);
      });
    }

    if (filter.types && filter.types.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        filter.types!.includes(event.type)
      );
    }

    if (filter.keyword && filter.keyword.trim() !== '') {
      const keywordLower = filter.keyword.trim().toLowerCase();
      filteredEvents = filteredEvents.filter(event =>
        event.title.toLowerCase().includes(keywordLower) ||
        (event.data?.description &&
          String(event.data.description).toLowerCase().includes(keywordLower))
      );
    }

    return filteredEvents;
  });

  // Recurring events expanded for the current view range
  readonly processedEvents = computed(() => {
    const { start, end } = this.viewDateRange();
    return this.dateUtil.expandRecurrences(
      this.filteredEvents(),
      start,
      end,
      this._timeZone()
    );
  });

  // Data for month view
  readonly monthViewDays = computed(() => {
    if (this._currentView() !== 'month') return [];

    const { days } = this.viewDateRange();
    const today = startOfDay(new Date());
    const currentMonth = this.parsedCenterDate().getMonth();
    const events = this.processedEvents();

    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter events for this day
      const dayEvents = events.filter(event =>
        isWithinInterval(this.dateUtil.parseISOString(event.start), { start: dayStart, end: dayEnd }) ||
        isWithinInterval(this.dateUtil.parseISOString(event.end), { start: dayStart, end: dayEnd }) ||
        (isBefore(this.dateUtil.parseISOString(event.start), dayStart) &&
          isBefore(dayEnd, this.dateUtil.parseISOString(event.end)))
      ).map(event => {
        const displayStart = this.dateUtil.parseISOString(event.start);
        const displayEnd = this.dateUtil.parseISOString(event.end);

        return {
          ...event,
          displayStart,
          displayEnd,
          isMultiDaySpan: !this.dateUtil.isSameDay(displayStart, displayEnd),
          continuesBefore: isBefore(displayStart, dayStart),
          continuesAfter: isBefore(dayEnd, displayEnd),
          originalEvent: event
        };
      });

      return {
        date,
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: date.getMonth() === currentMonth,
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)),
        events: dayEvents
      };
    });
  });

  // Data for week view
  readonly weekViewDays = computed(() => {
    if (this._currentView() !== 'week') return [];

    const { days } = this.viewDateRange();
    const today = startOfDay(new Date());
    const events = this.processedEvents();

    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter events for this day
      const dayEvents = events.filter(event =>
        isWithinInterval(this.dateUtil.parseISOString(event.start), { start: dayStart, end: dayEnd }) ||
        isWithinInterval(this.dateUtil.parseISOString(event.end), { start: dayStart, end: dayEnd }) ||
        (isBefore(this.dateUtil.parseISOString(event.start), dayStart) &&
          isBefore(dayEnd, this.dateUtil.parseISOString(event.end)))
      ).map(event => {
        const displayStart = this.dateUtil.parseISOString(event.start);
        const displayEnd = this.dateUtil.parseISOString(event.end);

        return {
          ...event,
          displayStart,
          displayEnd,
          isMultiDaySpan: !this.dateUtil.isSameDay(displayStart, displayEnd),
          continuesBefore: isBefore(displayStart, dayStart),
          continuesAfter: isBefore(dayEnd, displayEnd),
          originalEvent: event
        };
      });

      // Layout events for time grid
      const processedEvents = this.layoutService.layoutEventsForTimeGrid(
        dayEvents.filter(e => !e.allDay && !e.isMultiDaySpan),
        this._dayStartHour(),
        this._dayEndHour()
      );

      // Add all-day events back
      const allDayEvents = dayEvents.filter(e => e.allDay || e.isMultiDaySpan);

      return {
        date,
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: true,
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)),
        events: [...processedEvents, ...allDayEvents]
      };
    });
  });

  // Data for day view
  readonly dayViewHours = computed(() => {
    if (this._currentView() !== 'day') return [];

    const date = this.parsedCenterDate();
    const tz = this._timeZone();
    const events = this.processedEvents();

    // Get hours for the day
    const hours = this.dateUtil.getHoursOfDay(
      date,
      this._dayStartHour(),
      this._dayEndHour(),
      tz
    );

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Filter events for this day
    const dayEvents = events.filter(event =>
      isWithinInterval(this.dateUtil.parseISOString(event.start), { start: dayStart, end: dayEnd }) ||
      isWithinInterval(this.dateUtil.parseISOString(event.end), { start: dayStart, end: dayEnd }) ||
      (isBefore(this.dateUtil.parseISOString(event.start), dayStart) &&
        isBefore(dayEnd, this.dateUtil.parseISOString(event.end)))
    ).map(event => {
      const displayStart = this.dateUtil.parseISOString(event.start);
      const displayEnd = this.dateUtil.parseISOString(event.end);

      return {
        ...event,
        displayStart,
        displayEnd,
        isMultiDaySpan: !this.dateUtil.isSameDay(displayStart, displayEnd),
        continuesBefore: isBefore(displayStart, dayStart),
        continuesAfter: isBefore(dayEnd, displayEnd),
        originalEvent: event
      };
    });

    // Layout events for time grid
    const processedEvents = this.layoutService.layoutEventsForTimeGrid(
      dayEvents.filter(e => !e.allDay && !e.isMultiDaySpan),
      this._dayStartHour(),
      this._dayEndHour()
    );

    // Add all-day events
    const allDayEvents = dayEvents.filter(e => e.allDay || e.isMultiDaySpan);

    return hours.map(hourSlot => {
      const hourStart = hourSlot.date;
      const hourEnd = this.dateUtil.addHours(hourSlot.date, 1);

      // Filter events for this hour
      const hourEvents = processedEvents.filter(event =>
        this.dateUtil.isWithinInterval(event.displayStart, { start: hourStart, end: hourEnd }) ||
        this.dateUtil.isWithinInterval(event.displayEnd, { start: hourStart, end: hourEnd }) ||
        (isBefore(event.displayStart, hourStart) &&
          isBefore(hourEnd, event.displayEnd))
      );

      return {
        date: hourSlot.date,
        label: hourSlot.label,
        events: [...hourEvents, ...allDayEvents]
      };
    });
  });

  // Get day names for week header
  readonly weekDayNames = computed(() => {
    const start = startOfWeek(new Date(), {
      locale: this.dateUtil.getLocale(this._locale()),
      weekStartsOn: this._weekStartsOn()
    });

    return Array.from({ length: 7 }).map((_, i) =>
      this.dateUtil.format(
        this.dateUtil.addDays(start, i),
        'EEEEEE',
        this._locale()
      )
    );
  });

  // Get title for current view
  readonly viewTitle = computed(() => {
    const date = this.parsedCenterDate();
    const loc = this._locale();
    const tz = this._timeZone();

    switch (this._currentView()) {
      case 'month':
        return this.dateUtil.format(date, 'LLLL yyyy', loc, tz);
      case 'week':
        const { start, end } = this.viewDateRange();
        const startStr = this.dateUtil.format(start, 'LLL d', loc, tz);
        const endStr = this.dateUtil.format(end, 'LLL d, yyyy', loc, tz);
        return `${startStr} - ${endStr}`;
      case 'day':
        return this.dateUtil.format(date, 'EEEE, LLLL d, yyyy', loc, tz);
      default:
        return '';
    }
  });

  // Methods to update state
  setEvents(events: CalendarEvent[]): void {
    this._events.set(events);
  }

  setView(view: SchedulerView): void {
    this._currentView.set(view);
  }

  setDate(date: string): void {
    this._currentDate.set(date);
  }

  setFilter(filter: SchedulerFilter): void {
    this._filter.set(filter);
  }

  setLocale(locale: string): void {
    this._locale.set(locale);
    this.dateUtil.setLocale(locale);
  }

  setTimeZone(timeZone: string): void {
    this._timeZone.set(timeZone);
    this.dateUtil.setTimeZone(timeZone);
  }

  setDayStartHour(hour: number): void {
    this._dayStartHour.set(hour);
  }

  setDayEndHour(hour: number): void {
    this._dayEndHour.set(hour);
  }

  setWeekStartsOn(day: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
    this._weekStartsOn.set(day);
  }

  // Navigation methods
  navigate(direction: 'prev' | 'next' | 'today'): void {
    let newDate = this.parsedCenterDate();

    if (direction === 'today') {
      newDate = new Date();
      this._currentDate.set(newDate.toISOString());
      return;
    }

    const amount = direction === 'prev' ? -1 : 1;

    switch (this._currentView()) {
      case 'month':
        newDate = addMonths(newDate, amount);
        break;
      case 'week':
        newDate = addWeeks(newDate, amount);
        break;
      case 'day':
        newDate = addDays(newDate, amount);
        break;
    }

    this._currentDate.set(newDate.toISOString());
  }
}
