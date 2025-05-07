import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  LOCALE_ID
} from '@angular/core';
import {
  signal,
  computed,
  effect
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  isAfter,
  differenceInMinutes,
  getHours,
  getMinutes
} from 'date-fns';

import {
  CalendarEvent,
  CalendarFilter,
  CalendarOptions,
  EventMoveResult,
  ViewChangeResult,
  ExpandedEvent
} from '../models/calendar-event.model';
import { CalendarService } from './services/calendar.service';

@Component({
  selector: 'app-scheduler',
  standalone: false,
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CalendarService]
})
export class SchedulerComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  private defaultLocale = inject(LOCALE_ID);

  // Input properties
  @Input() set events(events: CalendarEvent[]) {
    this._events.set(events);
  }

  @Input() set view(view: 'month' | 'week' | 'day') {
    this._view.set(view);
  }

  @Input() set centerDate(date: string) {
    this._centerDate.set(date);
    this.scrollToCenterDate();
  }

  @Input() set filter(filter: CalendarFilter) {
    this._filter.set(filter);
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale || this.defaultLocale);
  }

  @Input() set timeZone(tz: string) {
    this._timeZone.set(tz || 'UTC');
  }

  @Input() set options(options: CalendarOptions) {
    this._options.set({
      startHour: 8,
      endHour: 18,
      firstDayOfWeek: 0,
      timeSlotDuration: 60,
      ...options
    });
  }

  // Output events
  @Output() eventMoved = new EventEmitter<EventMoveResult>();
  @Output() viewChanged = new EventEmitter<ViewChangeResult>();
  @Output() slotClicked = new EventEmitter<string>();
  @Output() eventEdited = new EventEmitter<CalendarEvent>();

  // Internal signals
  protected _events = signal<CalendarEvent[]>([]);
  protected _view = signal<'month' | 'week' | 'day'>('month');
  protected _centerDate = signal<string>(new Date().toISOString());
  protected _filter = signal<CalendarFilter>({});
  protected _locale = signal<string>(this.defaultLocale);
  protected _timeZone = signal<string>('UTC');
  protected _options = signal<CalendarOptions>({
    startHour: 8,
    endHour: 18,
    firstDayOfWeek: 0,
    timeSlotDuration: 60
  });

  // Computed values
  readonly currentView = computed(() => this._view());
  readonly currentDate = computed(() => this._centerDate());
  readonly filteredEvents = computed(() => this.filterEvents(this._events(), this._filter()));
  readonly visibleEvents = computed(() => this.getVisibleEvents(this.filteredEvents(), this._view(), this._centerDate()));
  readonly expandedEvents = computed(() => this.expandRecurringEvents(this.visibleEvents()));
  readonly viewTitle = computed(() => this.generateViewTitle(this._view(), this._centerDate(), this._locale(), this._timeZone()));

  constructor() {
    // Setup effect to emit view changes
    effect(() => {
      const view = this._view();
      const centerDate = this._centerDate();
      this.viewChanged.emit({ view, center: centerDate });
    }, { allowSignalWrites: true });

    // Initialize data from the calendar service
    this.calendarService.init(this._events, this._filter, this._view, this._centerDate)
      .pipe(takeUntilDestroyed())
      .subscribe();
  }

  ngOnInit(): void {
    // Setup initial scroll position
    setTimeout(() => this.scrollToCenterDate(), 0);
  }

  ngOnDestroy(): void {
    // Cleanup is handled automatically by takeUntilDestroyed
  }

  // Navigation methods
  navigateToNext(): void {
    const currentDate = parseISO(this._centerDate());
    let newDate: Date;

    switch (this._view()) {
      case 'day':
        newDate = addDays(currentDate, 1);
        break;
      case 'week':
        newDate = addWeeks(currentDate, 1);
        break;
      case 'month':
      default:
        newDate = addMonths(currentDate, 1);
        break;
    }

    this._centerDate.set(newDate.toISOString());
    this.scrollToCenterDate();
  }

  navigateToPrevious(): void {
    const currentDate = parseISO(this._centerDate());
    let newDate: Date;

    switch (this._view()) {
      case 'day':
        newDate = addDays(currentDate, -1);
        break;
      case 'week':
        newDate = addWeeks(currentDate, -1);
        break;
      case 'month':
      default:
        newDate = addMonths(currentDate, -1);
        break;
    }

    this._centerDate.set(newDate.toISOString());
    this.scrollToCenterDate();
  }

  navigateToToday(): void {
    this._centerDate.set(new Date().toISOString());
    this.scrollToCenterDate();
  }

  changeView(view: 'month' | 'week' | 'day'): void {
    this._view.set(view);
    this.scrollToCenterDate();
  }

  // Event handlers
  handleEventMove(result: EventMoveResult): void {
    this.eventMoved.emit(result);
  }

  handleSlotClick(date: string): void {
    this.slotClicked.emit(date);
  }

  handleEventEdit(event: CalendarEvent): void {
    this.eventEdited.emit(event);
  }

  // Helper methods
  private filterEvents(events: CalendarEvent[], filter: CalendarFilter): CalendarEvent[] {
    if (!filter) {
      return events;
    }

    return events.filter(event => {
      // Date range filter
      if (filter.from && isAfter(parseISO(filter.from), parseISO(event.end))) {
        return false;
      }

      if (filter.to && isBefore(parseISO(filter.to), parseISO(event.start))) {
        return false;
      }

      // Event type filter
      if (filter.types && filter.types.length > 0 && !filter.types.includes(event.type)) {
        return false;
      }

      // Keyword filter
      if (filter.keyword && !event.title.toLowerCase().includes(filter.keyword.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  private getVisibleEvents(events: CalendarEvent[], view: string, centerDate: string): CalendarEvent[] {
    const date = parseISO(centerDate);
    let start: Date;
    let end: Date;

    switch (view) {
      case 'day':
        start = new Date(date);
        start.setHours(0, 0, 0, 0);
        end = new Date(date);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const firstDay = this._options().firstDayOfWeek || 0;
        start = startOfWeek(date, { weekStartsOn: firstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        end = endOfWeek(date, { weekStartsOn: firstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        break;
      case 'month':
      default:
        start = startOfMonth(date);
        end = endOfMonth(date);

        // Include days from previous/next month to fill grid
        const firstDayOfWeek = this._options().firstDayOfWeek || 0;
        const weekStart = startOfWeek(start, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const weekEnd = endOfWeek(end, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

        if (isBefore(weekStart, start)) {
          start = weekStart;
        }

        if (isAfter(weekEnd, end)) {
          end = weekEnd;
        }
        break;
    }

    return events.filter(event => {
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);

      // Check if the event overlaps with our visible range
      return (isBefore(eventStart, end) && isAfter(eventEnd, start)) ||
        (isAfter(eventStart, start) && isBefore(eventStart, end)) ||
        (isAfter(eventEnd, start) && isBefore(eventEnd, end)) ||
        (isSameDay(eventStart, start) || isSameDay(eventEnd, end));
    });
  }

  private expandRecurringEvents(events: CalendarEvent[]): ExpandedEvent[] {
    const expandedEvents: ExpandedEvent[] = [];
    const date = parseISO(this._centerDate());
    const view = this._view();

    // First add non-recurring events
    events.filter(event => !event.recurrenceRule).forEach(event => {
      expandedEvents.push({
        ...event,
        originalEventId: event.id,
        instanceDate: event.start,
        isRecurring: false
      });
    });

    // Now handle recurring events
    events.filter(event => !!event.recurrenceRule).forEach(event => {
      // This is a simplified example - a real implementation would use a library like rrule.js
      // to properly parse and expand recurring events based on RRULE

      // For this example, we'll just handle a simple weekly recurrence
      if (event.recurrenceRule?.includes('FREQ=WEEKLY')) {
        const daysOfWeek: string[] = [];
        const bydayMatch = event.recurrenceRule.match(/BYDAY=([^;]+)/);

        if (bydayMatch && bydayMatch[1]) {
          const daysStr = bydayMatch[1];
          daysOfWeek.push(...daysStr.split(','));
        }

        // Determine the date range for the current view
        let start: Date;
        let end: Date;

        switch (view) {
          case 'day':
            start = new Date(date);
            end = new Date(date);
            break;
          case 'week':
            const firstDay = this._options().firstDayOfWeek || 0;
            start = startOfWeek(date, { weekStartsOn: firstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
            end = endOfWeek(date, { weekStartsOn: firstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
            break;
          case 'month':
          default:
            start = startOfMonth(date);
            end = endOfMonth(date);

            // Include days from previous/next month to fill grid
            const weekFirstDay = this._options().firstDayOfWeek || 0;
            const weekStart = startOfWeek(start, { weekStartsOn: weekFirstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
            const weekEnd = endOfWeek(end, { weekStartsOn: weekFirstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

            if (isBefore(weekStart, start)) {
              start = weekStart;
            }

            if (isAfter(weekEnd, end)) {
              end = weekEnd;
            }
            break;
        }

        // Generate all days in the range
        const days = eachDayOfInterval({ start, end });

        // Filter days by the BYDAY constraint
        const filteredDays = days.filter(day => {
          const dayCode = this.getDayCode(day.getDay());
          return daysOfWeek.includes(dayCode);
        });

        // Create an instance for each matching day
        filteredDays.forEach(day => {
          const eventStart = parseISO(event.start);
          const eventEnd = parseISO(event.end);
          const duration = differenceInMinutes(eventEnd, eventStart);

          const instanceStart = new Date(day);
          instanceStart.setHours(
            getHours(eventStart),
            getMinutes(eventStart),
            0,
            0
          );

          const instanceEnd = new Date(instanceStart);
          instanceEnd.setMinutes(instanceStart.getMinutes() + duration);

          expandedEvents.push({
            ...event,
            id: `${event.id}_${format(day, 'yyyy-MM-dd')}`,
            start: instanceStart.toISOString(),
            end: instanceEnd.toISOString(),
            originalEventId: event.id,
            instanceDate: instanceStart.toISOString(),
            isRecurring: true
          });
        });
      }
    });

    return expandedEvents;
  }

  private getDayCode(day: number): string {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    return days[day];
  }

  private generateViewTitle(view: string, centerDate: string, locale: string, timeZone: string): string {
    const date = utcToZonedTime(parseISO(centerDate), timeZone);

    switch (view) {
      case 'day':
        return formatInTimeZone(date, timeZone, 'EEEE, MMMM d, yyyy', { locale });
      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: this._options().firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const weekEnd = endOfWeek(date, { weekStartsOn: this._options().firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        return `${formatInTimeZone(weekStart, timeZone, 'MMM d', { locale })} - ${formatInTimeZone(weekEnd, timeZone, 'MMM d, yyyy', { locale })}`;
      case 'month':
      default:
        return formatInTimeZone(date, timeZone, 'MMMM yyyy', { locale });
    }
  }

  private scrollToCenterDate(): void {
    // This would be implemented in each view component to scroll to the current date
    // We'll trigger a custom event that the view components can listen for
    const event = new CustomEvent('scrollToDate', { detail: this._centerDate() });
    window.dispatchEvent(event);
  }
}
