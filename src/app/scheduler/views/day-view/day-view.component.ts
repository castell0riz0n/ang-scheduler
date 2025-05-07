// scheduler/views/day-view.component.ts
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
  ViewChild,
  NgZone,
  AfterViewInit
} from '@angular/core';
import {  CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import {
  addMinutes,
  isToday,
  parseISO,
  format,
  differenceInMinutes,
  getHours,
  getMinutes,
} from 'date-fns';

import {
  CalendarEvent,
  CalendarOptions,
  EventMoveResult,
  ExpandedEvent
} from '../../../models/calendar-event.model';
import {formatInTimeZone, utcToZonedTime} from 'date-fns-tz';

interface TimeSlot {
  time: Date;
  formattedTime: string;
  isHourStart: boolean;
}

@Component({
  selector: 'app-day-view',
  standalone: false,
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DayViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('dayViewContainer') dayViewContainer?: ElementRef;
  @ViewChild(CdkVirtualScrollViewport) virtualScroll?: CdkVirtualScrollViewport;

  @Input() set events(events: ExpandedEvent[]) {
    this._events.set(events);
    this.filterDayEvents();
  }

  @Input() set centerDate(date: string) {
    this._centerDate.set(date);
    this.generateTimeSlots();
    this.filterDayEvents();
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale);
    this.generateTimeSlots();
  }

  @Input() set timeZone(timeZone: string) {
    this._timeZone.set(timeZone);
    this.generateTimeSlots();
    this.filterDayEvents();
  }

  @Input() set options(options: CalendarOptions) {
    const newOptions = {
      startHour: 8,
      endHour: 18,
      timeSlotDuration: 30,
      ...options
    };
    this._options.set(newOptions);
    this.generateTimeSlots();
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
    timeSlotDuration: 30
  });

  readonly timeSlots = signal<TimeSlot[]>([]);
  readonly dayEvents = signal<ExpandedEvent[]>([]);

  readonly currentDay = computed(() => {
    const centerDate = utcToZonedTime(parseISO(this._centerDate()), this._timeZone());
    return centerDate;
  });

  readonly formattedDate = computed(() => {
    return formatInTimeZone(
      this.currentDay(),
      this._timeZone(),
      'EEEE, MMMM d, yyyy',
      { locale: this._locale() }
    );
  });

  readonly isCurrentDayToday = computed(() => {
    return isToday(this.currentDay());
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
    this.filterDayEvents();
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
      this.scrollToTime(targetDate);
    }
  }

  // Generate the time slots for the day
  private generateTimeSlots(): void {
    const startHour = this._options().startHour || 8;
    const endHour = this._options().endHour || 18;
    const slotDuration = this._options().timeSlotDuration || 30;
    const timeZone = this._timeZone();
    const locale = this._locale();
    const day = this.currentDay();

    const slots: TimeSlot[] = [];

    // Create a slot for each time interval
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotTime = new Date(day);
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

  // Filter events for the current day
  private filterDayEvents(): void {
    const events = this._events();
    const day = this.currentDay();
    const timeZone = this._timeZone();

    // Convert date to the start and end of day in the specified time zone
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Filter events that overlap with this day
    const filteredEvents = events.filter(event => {
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
      const aDuration = differenceInMinutes(aEnd, aStart);
      const bDuration = differenceInMinutes(bEnd, bStart);

      return bDuration - aDuration;
    });

    this.dayEvents.set(filteredEvents);
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
      // Same time slot, just reorder (not really applicable for calendar)
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Moving to a different time slot
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

      // Set the event to the new time, preserving the duration
      const newStart = new Date(targetSlot.time);
      const newEnd = addMinutes(newStart, duration);

      // Emit the event moved event
      this.eventMoved.emit({
        event: movedEvent,
        newStart: newStart.toISOString(),
        newEnd: newEnd.toISOString()
      });

      // Refresh our view
      this.filterDayEvents();
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
  getEventStyles(event: CalendarEvent): any {
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
    return this.timeSlots().map(slot => this.getDropListId(slot));
  }

  getDropListData(slot: TimeSlot, hour: number) {
    return this.dayEvents().filter(e => {
      const eventStart = parseISO(e.start);
      return eventStart.getHours() === hour &&
        eventStart.getMinutes() >= slot.time.getMinutes() &&
        eventStart.getMinutes() < slot.time.getMinutes() + (this._options().timeSlotDuration || 30)
    })
  }

  getTimeSlots(hour: number) {
    return this.timeSlots().filter(s => s.time.getHours() === hour)
  }

  getFilteredDayEvents(hour: number){
    return this.dayEvents().filter(e => {
      const eventStart = parseISO(e.start);
      return eventStart.getHours() === hour ||
        (parseISO(e.start).getHours() < hour && parseISO(e.end).getHours() > hour)
    })
  }
}
