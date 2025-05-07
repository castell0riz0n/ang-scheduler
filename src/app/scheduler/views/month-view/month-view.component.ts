// scheduler/views/month-view.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
  DragDropModule
} from '@angular/cdk/drag-drop';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  differenceInDays
} from 'date-fns';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';

import {
  CalendarEvent,
  CalendarOptions,
  EventMoveResult,
  ExpandedEvent
} from '../../../models/calendar-event.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CalendarDay {
  date: Date;
  formattedDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: ExpandedEvent[];
  overflowCount: number;
}

interface CalendarWeek {
  days: CalendarDay[];
}

@Component({
  selector: 'app-month-view',
  standalone: false,
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthViewComponent implements OnInit, OnDestroy {
  @ViewChild('monthGrid') monthGrid?: ElementRef;

  @Input() set events(events: ExpandedEvent[]) {
    this._events.set(events);
  }

  @Input() set centerDate(date: string) {
    this._centerDate.set(date);
    this.generateCalendarDays();
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale);
    this.generateCalendarDays();
  }

  @Input() set timeZone(timeZone: string) {
    this._timeZone.set(timeZone);
    this.generateCalendarDays();
  }

  @Input() set options(options: CalendarOptions) {
    this._options.set(options);
    this.generateCalendarDays();
  }

  @Output() eventMoved = new EventEmitter<EventMoveResult>();
  @Output() slotClicked = new EventEmitter<string>();
  @Output() eventEdited = new EventEmitter<CalendarEvent>();

  private _events = signal<ExpandedEvent[]>([]);
  private _centerDate = signal<string>(new Date().toISOString());
  private _locale = signal<string>('en-US');
  private _timeZone = signal<string>('UTC');
  private _options = signal<CalendarOptions>({});

  readonly weeks = signal<CalendarWeek[]>([]);
  readonly weekdays = computed(() => this.getWeekdayNames());
  readonly visibleDate = computed(() => {
    const date = utcToZonedTime(parseISO(this._centerDate()), this._timeZone());
    return formatInTimeZone(date, this._timeZone(), 'MMMM yyyy', { locale: this._locale() });
  });

  // Maximum number of events to show per day
  readonly maxEventsPerDay = 3;

  constructor(private ngZone: ElementRef) {
    // Listen for scroll to date events
    window.addEventListener('scrollToDate', this.handleScrollToDate.bind(this));

    // Generate calendar days whenever inputs change
    effect(() => {
      const events = this._events();
      const date = this._centerDate();
      const timeZone = this._timeZone();
      const locale = this._locale();
      const options = this._options();

      this.generateCalendarDays();
    });
  }

  ngOnInit(): void {
    this.generateCalendarDays();
  }

  ngOnDestroy(): void {
    // Remove event listener
    window.removeEventListener('scrollToDate', this.handleScrollToDate.bind(this));
  }

  // Custom event handler for scrolling to a date
  private handleScrollToDate(event: CustomEvent): void {
    // The event payload contains the date to scroll to
    const dateStr = event.detail;

    if (dateStr) {
      // For month view, we just need to ensure the month is visible
      // which is already handled by the centerDate property
    }
  }

  // Generate the calendar days for the current month
  private generateCalendarDays(): void {
    const dateStr = this._centerDate();
    const timeZone = this._timeZone();
    const locale = this._locale();
    const firstDayOfWeek = this._options().firstDayOfWeek || 0;

    // Parse the center date in the correct time zone
    const centerDate = utcToZonedTime(parseISO(dateStr), timeZone);

    // Get the first and last days of the month
    const monthStart = startOfMonth(centerDate);
    const monthEnd = endOfMonth(centerDate);

    // Adjust to include leading/trailing days to fill the grid
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

    // Get all weeks in the interval
    const weekStarts = eachWeekOfInterval(
      { start: calendarStart, end: calendarEnd },
      { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 }
    );

    // Build the calendar weeks
    const calendarWeeks: CalendarWeek[] = weekStarts.map(weekStart => {
      const weekEnd = addDays(weekStart, 6);
      const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

      const calendarDays: CalendarDay[] = daysInWeek.map(date => {
        // Filter events for this day
        const dayEvents = this.getEventsForDay(date);

        // Calculate overflow count if we have more events than we can display
        const overflowCount = Math.max(0, dayEvents.length - this.maxEventsPerDay);

        return {
          date,
          formattedDate: formatInTimeZone(date, timeZone, 'd', { locale }),
          isCurrentMonth: isSameMonth(date, centerDate),
          isToday: isToday(date),
          isWeekend: isWeekend(date),
          events: dayEvents.slice(0, this.maxEventsPerDay),
          overflowCount
        };
      });

      return { days: calendarDays };
    });

    this.weeks.set(calendarWeeks);
  }

  // Get weekday names based on locale and first day of week
  private getWeekdayNames(): string[] {
    const firstDayOfWeek = this._options().firstDayOfWeek || 0;
    const timeZone = this._timeZone();
    const locale = this._locale();

    // Get the date for the first day of the week
    const today = new Date();
    const firstDayDate = startOfWeek(today, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

    // Generate an array of the 7 days of the week
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(firstDayDate, i);
      return formatInTimeZone(day, timeZone, 'EEE', { locale });
    });
  }

  // Filter events for a specific day
  private getEventsForDay(date: Date): ExpandedEvent[] {
    const events = this._events();
    const timeZone = this._timeZone();

    // Convert date to the start and end of day in the specified time zone
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Filter events that overlap with this day
    return events.filter(event => {
      const eventStart = utcToZonedTime(parseISO(event.start), timeZone);
      const eventEnd = utcToZonedTime(parseISO(event.end), timeZone);

      return (
        // Event starts or ends on this day
        (eventStart >= dayStart && eventStart <= dayEnd) ||
        (eventEnd >= dayStart && eventEnd <= dayEnd) ||
        // Event spans over this day
        (eventStart < dayStart && eventEnd > dayEnd)
      );
    }).sort((a, b) => {
      // Sort by start time and then by duration
      const aStart = parseISO(a.start);
      const bStart = parseISO(b.start);
      const aEnd = parseISO(a.end);
      const bEnd = parseISO(b.end);

      // First compare start times
      if (aStart < bStart) return -1;
      if (aStart > bStart) return 1;

      // If start times are equal, compare durations (longer events first)
      const aDuration = differenceInDays(aEnd, aStart);
      const bDuration = differenceInDays(bEnd, bStart);

      return bDuration - aDuration;
    });
  }

  // Handle drag and drop of events
  onEventDrop(event: CdkDragDrop<ExpandedEvent[]>, targetDate: Date): void {
    if (event.previousContainer === event.container) {
      // Same day, just reorder (though this isn't usually needed in a calendar)
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Moving to a different day
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Get the moved event
      const movedEvent = event.container.data[event.currentIndex];

      // Calculate new start/end times
      const originalStart = parseISO(movedEvent.start);
      const originalEnd = parseISO(movedEvent.end);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      // Set the event to the new date, preserving the time
      const newStart = new Date(targetDate);
      newStart.setHours(
        originalStart.getHours(),
        originalStart.getMinutes(),
        originalStart.getSeconds()
      );

      const newEnd = new Date(newStart.getTime() + durationMs);

      // Emit the event moved event
      this.eventMoved.emit({
        event: movedEvent,
        newStart: newStart.toISOString(),
        newEnd: newEnd.toISOString()
      });

      // Refresh our view (this will get updated via the main component)
      // but we need to regenerate calendar days since we modified
      // the local event arrays
      this.generateCalendarDays();
    }
  }

  // Handle click on a day cell
  onDayClick(day: CalendarDay, event: MouseEvent): void {
    // Only handle clicks directly on the cell, not on events
    if ((event.target as HTMLElement).classList.contains('month-day-cell')) {
      // Create an ISO string for the clicked date at noon
      const clickedDate = new Date(day.date);
      clickedDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

      this.slotClicked.emit(clickedDate.toISOString());
    }
  }

  // Handle double-click on an event
  onEventDoubleClick(event: CalendarEvent, e: MouseEvent): void {
    e.stopPropagation();
    this.eventEdited.emit(event);
  }

  // Handle clicking on the "more events" indicator
  onMoreClick(day: CalendarDay, event: MouseEvent): void {
    event.stopPropagation();

    // In a real implementation, you'd show a popover with all events
    // For now, we'll just get all events for the day and emit a signal to show them
    const allEvents = this.getEventsForDay(day.date);

    // TODO: Show a popover with all events
    console.log('Show all events for', day.date, allEvents);
  }

  // Get CSS classes for a day cell
  getDayClasses(day: CalendarDay): string {
    return [
      'month-day-cell',
      day.isToday ? 'is-today' : '',
      day.isWeekend ? 'is-weekend' : '',
      !day.isCurrentMonth ? 'is-other-month' : ''
    ].filter(Boolean).join(' ');
  }

  // Get CSS classes for an event
  getEventClasses(event: CalendarEvent): string {
    return [
      'calendar-event',
      `event-${event.type}`,
      'cdk-drag'
    ].filter(Boolean).join(' ');
  }

  // Format time for display
  formatEventTime(event: CalendarEvent): string {
    const start = utcToZonedTime(parseISO(event.start), this._timeZone());
    return formatInTimeZone(start, this._timeZone(), 'h:mm a', { locale: this._locale() });
  }

  // Create a unique ID for each drop list
  getDropListId(day: CalendarDay): string {
    return `drop-list-${format(day.date, 'yyyy-MM-dd')}`;
  }

  // Get all drop list IDs for connected sorting
  getAllDropListIds(): string[] {
    return this.weeks().flatMap(week =>
      week.days.map(day => this.getDropListId(day))
    );
  }
}
