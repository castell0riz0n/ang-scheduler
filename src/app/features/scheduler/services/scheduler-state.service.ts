import { Injectable, signal, computed, inject } from '@angular/core';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel, HourViewModel } from '../models/calendar-event.model';
import { DateUtilService } from './date.service';
import { SchedulerLayoutService } from './scheduler-layout.service';
import {
  parseISO, startOfDay, endOfDay, isWithinInterval,
  isBefore, startOfWeek, endOfWeek, eachDayOfInterval,
  startOfMonth, endOfMonth, getHours, getMinutes
} from 'date-fns';

export type SchedulerView = 'month' | 'week' | 'day';

export interface SchedulerFilter {
  from?: string;
  to?: string;
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

  readonly processedEvents = computed(() => {
    const { start, end } = this.viewDateRange();
    return this.dateUtil.expandRecurrences(
      this.filteredEvents(),
      start,
      end,
      this._timeZone()
    );
  });

  readonly displayEvents = computed(() => {
    const processed = this.processedEvents();
    const { start, end } = this.viewDateRange();
    const tz = this._timeZone();

    // Process events for display
    return this.layoutService.processEventsForDisplay(
      (processed as DisplayCalendarEvent[]),
      start,
      end,
      tz
    );
  });

  readonly monthViewDays = computed(() => {
    if (this._currentView() !== 'month') return [];

    const { days } = this.viewDateRange();
    const today = startOfDay(new Date());
    const currentMonth = this.parsedCenterDate().getMonth();
    const events = this.displayEvents();

    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter events for this day
      const dayEvents = events.filter(event =>
        isWithinInterval(event.displayStart, { start: dayStart, end: dayEnd }) ||
        isWithinInterval(event.displayEnd, { start: dayStart, end: dayEnd }) ||
        (isBefore(event.displayStart, dayStart) &&
          isBefore(dayEnd, event.displayEnd))
      );

      return {
        date,
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: date.getMonth() === currentMonth,
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)),
        events: dayEvents
      };
    });
  });

  readonly weekViewDays = computed(() => {
    if (this._currentView() !== 'week') return [];

    const { days } = this.viewDateRange();
    const today = startOfDay(new Date());
    const events = this.displayEvents();

    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter events for this day
      const dayEvents = events.filter(event =>
        isWithinInterval(event.displayStart, { start: dayStart, end: dayEnd }) ||
        isWithinInterval(event.displayEnd, { start: dayStart, end: dayEnd }) ||
        (isBefore(event.displayStart, dayStart) &&
          isBefore(dayEnd, event.displayEnd))
      );

      // Layout events for time grid
      const processedEvents = this.layoutService.layoutEventsForTimeGrid(
        dayEvents,
        date,
        this._dayStartHour(),
        this._dayEndHour()
      );

      return {
        date,
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: true,
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)),
        events: processedEvents
      };
    });
  });

  readonly dayViewHours = computed(() => {
    if (this._currentView() !== 'day') return [];

    const date = this.parsedCenterDate();
    const tz = this._timeZone();
    const events = this.displayEvents();

    // Get hours for the day
    const hours = this.dateUtil.getHoursOfDay(
      date,
      this._dayStartHour(),
      this._dayEndHour(),
      tz
    );

    return hours.map(hourSlot => {
      const hourStart = hourSlot.date;
      const hourEnd = this.dateUtil.addHours(hourSlot.date, 1);

      // Filter events for this hour
      const hourEvents = events.filter(event =>
        this.dateUtil.isWithinInterval(event.displayStart, { start: hourStart, end: hourEnd }) ||
        this.dateUtil.isWithinInterval(event.displayEnd, { start: hourStart, end: hourEnd }) ||
        (isBefore(event.displayStart, hourStart) &&
          isBefore(hourEnd, event.displayEnd))
      );

      // Layout events for this hour
      const processedEvents = this.layoutService.layoutEventsForTimeGrid(
        hourEvents,
        date,
        this._dayStartHour(),
        this._dayEndHour()
      );

      return {
        date: hourSlot.date,
        label: hourSlot.label,
        events: processedEvents
      };
    });
  });

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
        newDate = this.dateUtil.addMonths(newDate, amount);
        break;
      case 'week':
        newDate = this.dateUtil.addWeeks(newDate, amount);
        break;
      case 'day':
        newDate = this.dateUtil.addDays(newDate, amount);
        break;
    }

    this._currentDate.set(newDate.toISOString());
  }
}
