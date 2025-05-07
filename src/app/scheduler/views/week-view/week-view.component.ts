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
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import {
  startOfWeek,
  endOfWeek,
  addMinutes,
  isSameDay,
  isToday,
  isWeekend,
  parseISO,
  format,
  eachDayOfInterval,
  differenceInMinutes,
  getHours,
  getMinutes
} from 'date-fns';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';

import {
  CalendarEvent,
  CalendarOptions,
  EventMoveResult,
  ExpandedEvent
} from '../../../models/calendar-event.model';

interface TimeSlot {
  time: Date;
  formattedTime: string;
  isHourStart: boolean;
}

interface WeekColumn {
  date: Date;
  formattedDate: string;
  dayName: string;
  isToday: boolean;
  isWeekend: boolean;
  slots: TimeSlot[];
  events: ExpandedEvent[];
}

@Component({
  selector: 'app-week-view',
  standalone: false,
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeekViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('weekViewContainer') weekViewContainer?: ElementRef;
  @ViewChild(CdkVirtualScrollViewport) virtualScroll?: CdkVirtualScrollViewport;

  @Input() set events(events: ExpandedEvent[]) {
    this._events.set(events);
    this.generateWeekColumns();
  }

  @Input() set centerDate(date: string) {
    this._centerDate.set(date);
    this.generateWeekColumns();
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale);
    this.generateWeekColumns();
  }

  @Input() set timeZone(timeZone: string) {
    this._timeZone.set(timeZone);
    this.generateWeekColumns();
  }

  @Input() set options(options: CalendarOptions) {
    const newOptions = {
      startHour: 8,
      endHour: 18,
      firstDayOfWeek: 0,
      timeSlotDuration: 60,
      ...options
    };
    this._options.set(newOptions);
    this.generateWeekColumns();
  }

  @Output() eventMoved = new EventEmitter<EventMoveResult>();
  @Output() slotClicked = new EventEmitter<string>();
  @Output() eventEdited = new EventEmitter<CalendarEvent>();

  private _events = signal<ExpandedEvent[]>([]);
  private _centerDate = signal<string>(new Date().toISOString());
  private _locale = signal<string>('en-US');
  private _timeZone = signal<string>('UTC');
  private _options = signal<CalendarOptions>({
    startHour: 8,
    endHour: 18,
    firstDayOfWeek: 0,
    timeSlotDuration: 60
  });

  readonly weekColumns = signal<WeekColumn[]>([]);
  readonly timeSlots = signal<TimeSlot[]>([]);
  readonly weekStartDate = computed(() => {
    const centerDate = utcToZonedTime(parseISO(this._centerDate()), this._timeZone());
    const firstDayOfWeek = this._options().firstDayOfWeek || 0;
    return startOfWeek(centerDate, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  });
  readonly visibleHours = computed(() => {
    return Array.from(
      { length: (this._options().endHour || 18) - (this._options().startHour || 8) + 1 },
      (_, i) => (this._options().startHour || 8) + i
    );
  });

  // For virtual scrolling
  readonly itemSize = 60; // Height of each hour row in pixels

  constructor(private ngZone: ElementRef) {
    // Listen for scroll to date events
    window.addEventListener('scrollToDate', this.handleScrollToDate.bind(this));
  }

  ngOnInit(): void {
    this.generateTimeSlots();
    this.generateWeekColumns();
  }

  ngAfterViewInit(): void {
    // Scroll to current business hours
    setTimeout(() => {
      this.scrollToBusinessHours();
    }, 0);
  }

  ngOnDestroy(): void {
    // Remove event listener
    window.removeEventListener('scrollToDate', this.handleScrollToDate.bind(this));
  }

  // Custom event handler for scrolling to a date
  private handleScrollToDate(event: CustomEvent): void {
    const dateStr = event.detail;

    if (dateStr) {
      const targetDate = parseISO(dateStr);

      // First scroll to the right hour
      this.scrollToTime(targetDate);

      // Then make sure the right day is in view
      // (Not needed in this implementation as week view shows all days)
    }
  }

  // Generate the time slots
  private generateTimeSlots(): void {
    const startHour = this._options().startHour || 8;
    const endHour = this._options().endHour || 18;
    const slotDuration = this._options().timeSlotDuration || 60;
    const timeZone = this._timeZone();
    const locale = this._locale();

    const slots: TimeSlot[] = [];
    const today = new Date();

    // Create a slot for each time interval
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotTime = new Date(today);
        slotTime.setHours(hour, minute, 0, 0);

        slots.push({
          time: slotTime,
          formattedTime: formatInTimeZone(slotTime, timeZone, 'h:mm a', { locale }),
          isHourStart: minute === 0
        });
      }
    }

    this.timeSlots.set(slots);
  }

  // Generate the week columns
  private generateWeekColumns(): void {
    const centerDateStr = this._centerDate();
    const timeZone = this._timeZone();
    const locale = this._locale();
    const firstDayOfWeek = this._options().firstDayOfWeek || 0;

    // Parse the center date in the correct time zone
    const centerDate = utcToZonedTime(parseISO(centerDateStr), timeZone);

    // Get the first and last day of the week
    const weekStart = startOfWeek(centerDate, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const weekEnd = endOfWeek(centerDate, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

    // Get all days in the week
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Generate time slots if not already generated
    if (this.timeSlots().length === 0) {
      this.generateTimeSlots();
    }

    // Build the week columns
    const columns: WeekColumn[] = days.map(date => {
      // Generate time slots for this day
      const daySlots = this.timeSlots().map(slot => {
        const slotTime = new Date(date);
        slotTime.setHours(slot.time.getHours(), slot.time.getMinutes(), 0, 0);

        return {
          time: slotTime,
          formattedTime: slot.formattedTime,
          isHourStart: slot.isHourStart
        };
      });

      return {
        date,
        formattedDate: formatInTimeZone(date, timeZone, 'd', { locale }),
        dayName: formatInTimeZone(date, timeZone, 'EEE', { locale }),
        isToday: isToday(date),
        isWeekend: isWeekend(date),
        slots: daySlots,
        events: this.getEventsForDay(date)
      };
    });

    this.weekColumns.set(columns);
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
      // Sort by start time
      const aStart = parseISO(a.start);
      const bStart = parseISO(b.start);

      if (aStart < bStart) return -1;
      if (aStart > bStart) return 1;

      return 0;
    });
  }

  // Scroll to business hours
  private scrollToBusinessHours(): void {
    if (this.virtualScroll) {
      const startHour = this._options().startHour || 8;
      const scrollIndex = startHour - (this._options().startHour || 8);
      this.virtualScroll.scrollToIndex(scrollIndex);
    }
  }

  // Scroll to a specific time
  private scrollToTime(date: Date): void {
    if (this.virtualScroll) {
      const hour = date.getHours();
      const startHour = this._options().startHour || 8;

      // Calculate scroll index based on hour
      if (hour >= startHour && hour <= (this._options().endHour || 18)) {
        const scrollIndex = hour - startHour;
        this.virtualScroll.scrollToIndex(scrollIndex);
      } else {
        // If the hour is outside our range, scroll to start
        this.virtualScroll.scrollToIndex(0);
      }
    }
  }

  // Handle drag and drop of events
  onEventDrop(event: CdkDragDrop<ExpandedEvent[]>, targetSlot: TimeSlot): void {
    if (event.previousContainer === event.container) {
      // Same day, just reorder
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Moving to a different day or time
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
      const duration = differenceInMinutes(originalEnd, originalStart);

      // Set the event to the new date and time
      const newStart = new Date(targetSlot.time);
      const newEnd = addMinutes(newStart, duration);

      // Emit the event moved event
      this.eventMoved.emit({
        event: movedEvent,
        newStart: newStart.toISOString(),
        newEnd: newEnd.toISOString()
      });

      // Refresh our view
      this.generateWeekColumns();
    }
  }

  // Handle click on a time slot
  onSlotClick(slot: TimeSlot, event: MouseEvent): void {
    // Only handle clicks directly on the slot, not on events
    if ((event.target as HTMLElement).classList.contains('time-slot')) {
      this.slotClicked.emit(slot.time.toISOString());
    }
  }

  // Handle double-click on an event
  onEventDoubleClick(event: CalendarEvent, e: MouseEvent): void {
    e.stopPropagation();
    this.eventEdited.emit(event);
  }

  // Get CSS classes for a day column
  getDayColumnClasses(column: WeekColumn): string {
    return [
      'day-column',
      column.isToday ? 'is-today' : '',
      column.isWeekend ? 'is-weekend' : ''
    ].filter(Boolean).join(' ');
  }

  // Get CSS classes for a time slot
  getTimeSlotClasses(slot: TimeSlot): string {
    return [
      'time-slot',
      slot.isHourStart ? 'is-hour-start' : ''
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

  // Get position styles for an event
  getEventStyles(event: CalendarEvent, dayDate: Date): any {
    const timeZone = this._timeZone();
    const startHour = this._options().startHour || 8;
    const endHour = this._options().endHour || 18;
    const totalMinutes = (endHour - startHour + 1) * 60;

    // Get event start and end times
    const eventStart = utcToZonedTime(parseISO(event.start), timeZone);
    const eventEnd = utcToZonedTime(parseISO(event.end), timeZone);

    // Calculate position and height
    const eventStartHour = getHours(eventStart);
    const eventStartMinute = getMinutes(eventStart);
    const eventEndHour = getHours(eventEnd);
    const eventEndMinute = getMinutes(eventEnd);

    // Calculate top position as percentage of the total day height
    const startMinuteOfDay = (eventStartHour - startHour) * 60 + eventStartMinute;
    const endMinuteOfDay = (eventEndHour - startHour) * 60 + eventEndMinute;

    const top = (startMinuteOfDay / totalMinutes) * 100;
    const height = ((endMinuteOfDay - startMinuteOfDay) / totalMinutes) * 100;

    // If the event starts before or ends after our visible hours, adjust
    const adjustedTop = Math.max(0, top);
    const adjustedHeight = Math.min(100 - adjustedTop, height);

    return {
      top: `${adjustedTop}%`,
      height: `${adjustedHeight}%`
    };
  }

  // Format time for display
  formatEventTime(event: CalendarEvent): string {
    const start = utcToZonedTime(parseISO(event.start), this._timeZone());
    const end = utcToZonedTime(parseISO(event.end), this._timeZone());

    return `${formatInTimeZone(start, this._timeZone(), 'h:mm a', { locale: this._locale() })} -
           ${formatInTimeZone(end, this._timeZone(), 'h:mm a', { locale: this._locale() })}`;
  }

  // Create a unique ID for each drop list
  getDropListId(slot: TimeSlot): string {
    return `drop-list-${format(slot.time, 'yyyy-MM-dd-HH-mm')}`;
  }

  // Get all drop list IDs for connected sorting
  getAllDropListIds(): string[] {
    return this.weekColumns().flatMap(column =>
      column.slots.map(slot => this.getDropListId(slot))
    );
  }

  getFilteredSlots(column: WeekColumn, hour:number){
    return column!.slots.filter(s => s.time.getHours() === hour)
  }

  getDropListData(column: WeekColumn, slot: TimeSlot, hour: number) {
    return column.events.filter(e => {
      const eventStart = parseISO(e.start);
      return eventStart.getHours() === hour &&
        eventStart.getMinutes() >= slot.time.getMinutes() &&
        eventStart.getMinutes() < slot.time.getMinutes() + (this._options().timeSlotDuration || 60)
    })
  }

  protected readonly isSameDay = isSameDay;
  protected readonly parseISO = parseISO;
}
