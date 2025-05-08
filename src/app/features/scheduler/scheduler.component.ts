import { Component, ChangeDetectionStrategy, input, output, computed, effect, signal, ViewChild, ElementRef, AfterViewInit, inject, DestroyRef, OnInit, model } from '@angular/core';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel, HourViewModel } from './models/calendar-event.model';
import { DateUtilService } from './services/date.service';
import {
  startOfDay, endOfDay, isWithinInterval,
  parseISO, isBefore,
  getHours, addHours, differenceInMinutes, startOfWeek, addMinutes,
  isAfter,
  max,
  min, getMinutes
} from 'date-fns';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MonthViewComponent} from './components/month-view/month-view.component';
import {WeekViewComponent} from './components/week-view/week-view.component';
import {DayViewComponent} from './components/day-view/day-view.component';
function toISODateString(date: Date): string {
  return date.toISOString().split('.')[0];
}

export type SchedulerView = 'month' | 'week' | 'day';

export interface SchedulerFilter {
  from?: string; // ISO date string
  to?: string; // ISO date string
  types?: string[];
  keyword?: string;
}

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MonthViewComponent,
    WeekViewComponent,
    DayViewComponent
  ],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulerComponent implements OnInit, AfterViewInit {
  // --- Inputs ---
  events = input.required<CalendarEvent[]>();
  initialView = input<SchedulerView>('month');
  initialCenterDate = input<string>(toISODateString(new Date())); // ISO String
  filter = input<SchedulerFilter>({});
  locale = input<string>(navigator.language || 'en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Configuration for week/day views (could be an Input object)
  dayStartHour = input<number>(0); // 0-23
  dayEndHour = input<number>(24); // 1-24 (exclusive end for loops)
  weekStartsOn = input<0 | 1 | 2 | 3 | 4 | 5 | 6>(1); // 0=Sun, 1=Mon

  // Optional Input for event type colors
  eventTypeColors = input<Record<string, { background: string; border?: string; text?: string }>>({});

  pendingEventSlot = signal<{ date: string, timeZone: string } | null>(null);

  // --- Outputs ---
  eventMoved = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  viewChanged = output<{ view: SchedulerView, centerDateISO: string, viewStartISO: string, viewEndISO: string }>();
  slotClicked = output<{ date: string, timeZone: string }>(); // ISO string of slot start, including time for day/week view
  eventEdited = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();
  eventMoveRequested = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();

  // --- Internal State Signals ---
  destroyRef = inject(DestroyRef);
  dateUtil = inject(DateUtilService);

  // `model` for two-way binding support if needed by parent
  currentView = model<SchedulerView>(this.initialView());
  currentCenterDate = model<string>(this.initialCenterDate());

  // Scroll container references for centering views
  @ViewChild(MonthViewComponent) monthViewComponent?: MonthViewComponent;
  @ViewChild('monthViewContainer') monthViewContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('weekViewContainer') weekViewContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('dayViewContainer') dayViewContainerRef?: ElementRef<HTMLElement>;


  // --- Computed Signals for View Logic ---

  // Effective locale and timezone used by date service (updates service)
  private _localeSignal = effect(() => this.dateUtil.setLocale(this.locale()));
  private _timeZoneSignal = effect(() => this.dateUtil.setTimeZone(this.timeZone()));

  // Parsed center date in component's default/current timezone (conceptually)
  // Date objects in JS are UTC internally, but operations can be TZ-aware
  _parsedCenterDate = computed(() => {
    try {
      // We expect currentCenterDate() to be an ISO string
      // date-fns parseISO creates a Date object. We treat this as UTC,
      // and any display will be zoned using timeZone() input.
      return parseISO(this.currentCenterDate());
    } catch (e) {
      console.error("Invalid centerDate:", this.currentCenterDate(), e);
      return new Date(); // Fallback
    }
  });


  // Generate date range for the current view (Month, Week, Day)
  viewDateRange = computed(() => {
    const date = this._parsedCenterDate();
    const tz = this.timeZone();
    const loc = this.locale();
    const ws = this.weekStartsOn();

    switch (this.currentView()) {
      case 'month':
        return this.dateUtil.getMonthViewRange(date, loc, ws);
      case 'week':
        return this.dateUtil.getWeekViewRange(date, loc, ws);
      case 'day':
      default: // Fallback to day view if view type is unknown
        return this.dateUtil.getDayViewRange(date);
    }
  });

  // Filter and Expand Recurrences
  processedEvents = computed(() => {
    const originalEvents = this.events();
    const { start: viewStart, end: viewEnd } = this.viewDateRange();
    const currentFilter = this.filter();
    const tz = this.timeZone();

    // 1. Expand recurring events
    let eventsToProcess = this.dateUtil.expandRecurrences(originalEvents, viewStart, viewEnd, tz);

    // 2. Apply filters
    if (currentFilter.from) {
      const filterFromDate = this.dateUtil.parseWithTz(currentFilter.from, tz);
      eventsToProcess = eventsToProcess.filter(event => {
        const eventEnd = this.dateUtil.parseWithTz(event.end, tz);
        return !isBefore(eventEnd, filterFromDate);
      });
    }
    if (currentFilter.to) {
      const filterToDate = this.dateUtil.parseWithTz(currentFilter.to, tz);
      eventsToProcess = eventsToProcess.filter(event => {
        const eventStart = this.dateUtil.parseWithTz(event.start, tz);
        return !isBefore(filterToDate, eventStart);
      });
    }
    if (currentFilter.types && currentFilter.types.length > 0) {
      eventsToProcess = eventsToProcess.filter(event => currentFilter.types!.includes(event.type));
    }
    if (currentFilter.keyword && currentFilter.keyword.trim() !== '') {
      const keywordLower = currentFilter.keyword.trim().toLowerCase();
      eventsToProcess = eventsToProcess.filter(event =>
        event.title.toLowerCase().includes(keywordLower) ||
        (event.data?.description && String(event.data.description).toLowerCase().includes(keywordLower))
      );
    }
    return eventsToProcess;
  });


  // Prepare data for the Month View
  monthViewDays = computed((): DayViewModel[] => {
    if (this.currentView() !== 'month') return [];
    const { days } = this.viewDateRange(); // days are already Date objects
    const today = startOfDay(new Date()); // local today, compare with startOfDay of view dates
    const currentDisplayMonth = this._parsedCenterDate().getMonth();
    const allDisplayEvents = this.mapEventsToDisplayFormat(this.processedEvents(), this.viewDateRange().start, this.viewDateRange().end);


    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const dayEvents = allDisplayEvents.filter(event =>
        isWithinInterval(event.displayStart, { start: dayStart, end: dayEnd }) || // Starts in day
        isWithinInterval(event.displayEnd, { start: dayStart, end: dayEnd }) ||   // Ends in day
        (isBefore(event.displayStart, dayStart) && isBefore(dayEnd, event.displayEnd)) // Spans over day
      );
      // Basic sorting (can be more sophisticated for overlapping)
      dayEvents.sort((a,b) => a.displayStart.getTime() - b.displayStart.getTime());

      return {
        date: date, // This is a Date object
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: date.getMonth() === currentDisplayMonth,
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)), // 0=Sun, 6=Sat
        events: this.layoutEventsForDayCell(dayEvents, date), // Further process for rendering if needed
      };
    });
  });

  // Prepare data for the Week View
  weekViewDays = computed((): DayViewModel[] => {
    if (this.currentView() !== 'week') return [];
    const { days } = this.viewDateRange(); // Date objects
    const today = startOfDay(new Date());
    const allDisplayEvents = this.mapEventsToDisplayFormat(this.processedEvents(), this.viewDateRange().start, this.viewDateRange().end);


    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const dayEvents = allDisplayEvents.filter(event =>
        isWithinInterval(event.displayStart, {start: dayStart, end: dayEnd}) ||
        isWithinInterval(event.displayEnd, {start: dayStart, end: dayEnd}) ||
        (isBefore(event.displayStart, dayStart) && isBefore(dayEnd, event.displayEnd))
      );
      dayEvents.sort((a,b) => a.displayStart.getTime() - b.displayStart.getTime());

      return {
        date: date,
        isToday: this.dateUtil.isSameDay(date, today),
        isCurrentMonth: true, // All days in week view are "current"
        isWeekend: [0, 6].includes(this.dateUtil.getDay(date)),
        events: this.layoutEventsForTimeGrid(dayEvents, date, this.dayStartHour(), this.dayEndHour(), this.timeZone()),
      };
    });
  });

  // Prepare data for Day View
  dayViewHours = computed((): HourViewModel[] => {
    if (this.currentView() !== 'day') return [];
    const { start: viewStart, end: viewEnd } = this.viewDateRange();
    const date = this._parsedCenterDate(); // This is the day for the day view
    const tz = this.timeZone();

    const hours = this.dateUtil.getHoursOfDay(date, this.dayStartHour(), this.dayEndHour(), tz);
    const allDisplayEvents = this.mapEventsToDisplayFormat(this.processedEvents(), viewStart, viewEnd);

    return hours.map(hourSlot => {
      // hourSlot.date is UTC start of that hour for that day
      const hourStart = hourSlot.date;
      const hourEnd = addHours(hourSlot.date, 1);

      const hourEvents = allDisplayEvents.filter(event =>
        this.dateUtil.isWithinInterval(event.displayStart, { start: hourStart, end: hourEnd }) ||
        this.dateUtil.isWithinInterval(event.displayEnd, { start: hourStart, end: hourEnd }) ||
        (isBefore(event.displayStart, hourStart) && isBefore(hourEnd, event.displayEnd))
      );
      hourEvents.sort((a,b) => a.displayStart.getTime() - b.displayStart.getTime());

      return {
        date: hourSlot.date, // UTC date representing hour start
        label: hourSlot.label, // Formatted label like "9:00 AM"
        events: this.layoutEventsForTimeGrid(hourEvents, date, getHours(hourSlot.date), getHours(hourSlot.date)+1, tz),
      };
    });
  });

  // Common function to map CalendarEvent to DisplayCalendarEvent
  private mapEventsToDisplayFormat(calEvents: CalendarEvent[], viewStart: Date, viewEnd: Date): DisplayCalendarEvent[] {
    const tz = this.timeZone();
    const processedEvents: DisplayCalendarEvent[] = [];

    calEvents.forEach(event => {
      const displayStart = this.dateUtil.parseWithTz(event.start, tz);
      const displayEnd = this.dateUtil.parseWithTz(event.end, tz);

      // Determine if the event spans multiple days
      const isMultiDay = !this.dateUtil.isSameDay(displayStart, displayEnd);

      if (isMultiDay && !event.allDay) {
        // For multi-day timed events, create separate segments for each day
        let currentDay = startOfDay(displayStart);
        const lastDay = startOfDay(displayEnd);

        while (!isAfter(currentDay, lastDay)) {
          // Check if this day segment is within our view range
          if (this.dateUtil.isWithinInterval(currentDay, { start: viewStart, end: viewEnd })) {
            const segmentStart = max([displayStart, currentDay]);
            const segmentEnd = min([
              displayEnd,
              endOfDay(currentDay)
            ]);

            // Only create a segment if it has duration
            if (isBefore(segmentStart, segmentEnd)) {
              const isFirstDay = this.dateUtil.isSameDay(segmentStart, displayStart);
              const isLastDay = this.dateUtil.isSameDay(segmentEnd, displayEnd);

              processedEvents.push({
                ...event,
                originalEvent: event,
                id: `${event.id}_${this.dateUtil.format(currentDay, 'yyyyMMdd')}`,
                displayStart: segmentStart,
                displayEnd: segmentEnd,
                continuesBefore: !isFirstDay,
                continuesAfter: !isLastDay,
                isMultiDaySpan: true,
                durationInMinutes: this.dateUtil.differenceInMinutes(segmentEnd, segmentStart)
              });
            }
          }

          // Move to next day
          currentDay = this.dateUtil.addDays(currentDay, 1);
        }
      } else {
        // For single-day or all-day events, process normally
        const effectiveStart = isBefore(displayStart, viewStart) ? viewStart : displayStart;
        const effectiveEnd = isBefore(viewEnd, displayEnd) ? viewEnd : displayEnd;

        processedEvents.push({
          ...event,
          originalEvent: event,
          displayStart: effectiveStart,
          displayEnd: effectiveEnd,
          continuesBefore: isBefore(displayStart, viewStart),
          continuesAfter: isBefore(viewEnd, displayEnd),
          isMultiDaySpan: isMultiDay,
          durationInMinutes: this.dateUtil.differenceInMinutes(effectiveEnd, effectiveStart),
          allDay: event.allDay || isMultiDay // Consider multi-day events as "all-day" for layout purposes
        });
      }
    });

    // Sort events to ensure predictable layout
    return processedEvents.sort((a, b) => {
      // All-day events come first
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      // Then sort by start time
      return a.displayStart.getTime() - b.displayStart.getTime();
    });
  }
  // TODO: Sophisticated layout for overlapping events (placeholder)
  private layoutEventsForDayCell(events: DisplayCalendarEvent[], dayDate: Date): DisplayCalendarEvent[] {
    // For month view, just return them sorted. Stacking UI handled in template with maxEventsPerCell
    return events;
  }

  // TODO: Sophisticated layout for overlapping events in time grids (placeholder)
  private layoutEventsForTimeGrid(
    dayEvents: DisplayCalendarEvent[], // Already filtered for the day, sorted by UTC start time
    dayDateUtc: Date, // UTC start of the day for which events are being laid out
    dayViewStartHour: number, // Configurable visual start hour (e.g., 0 or 8)
    dayViewEndHour: number,   // Configurable visual end hour (e.g., 23 or 18, meaning up to 23:59 or 17:59)
    timeZone: string // For display interpretation; main logic should stick to UTC
  ): DisplayCalendarEvent[] {
    if (!dayEvents.length) return [];

    const laidOutEvents: DisplayCalendarEvent[] = [];

    // Group events by start time to identify overlaps
    const eventsByStartTime = new Map<string, DisplayCalendarEvent[]>();

    // Sort events by start time
    dayEvents.sort((a, b) => a.displayStart.getTime() - b.displayStart.getTime());

    // Group events that start at the same time (rounded to 5-minute intervals for flexibility)
    dayEvents.forEach(event => {
      const roundedStart = Math.floor(
        (getHours(event.displayStart) * 60 + getMinutes(event.displayStart)) / 5
      ) * 5;

      const key = `${roundedStart}`;
      if (!eventsByStartTime.has(key)) {
        eventsByStartTime.set(key, []);
      }
      eventsByStartTime.get(key)!.push(event);
    });

    // Calculate positions for each group of events
    eventsByStartTime.forEach((events, startTimeKey) => {
      const count = events.length;

      events.forEach((event, index) => {
        // Get the day start boundary in UTC for position calculation
        const dayStartBoundaryUtc = this.dateUtil.setHours(
          this.dateUtil.setMinutes(new Date(dayDateUtc), 0),
          dayViewStartHour
        );

        // Calculate top position (Y coordinate)
        const startMinutesFromViewStart = Math.max(
          0,
          differenceInMinutes(event.displayStart, dayStartBoundaryUtc)
        );

        // Calculate duration for height
        const dayEndBoundaryUtc = this.dateUtil.setHours(
          this.dateUtil.setMinutes(new Date(dayDateUtc), 59),
          dayViewEndHour - 1
        );

        const visibleEnd = isBefore(dayEndBoundaryUtc, event.displayEnd)
          ? dayEndBoundaryUtc
          : event.displayEnd;

        const durationMinutesVisual = Math.max(
          0,
          differenceInMinutes(visibleEnd, event.displayStart)
        );

        // Calculate width and left position for side-by-side display
        const width = count > 1 ? `${Math.max(20, 96 / count)}%` : '96%';
        const left = count > 1 ? `${(index * (96 / count)) + 2}%` : '2%';

        laidOutEvents.push({
          ...event,
          gridRowStartMinutes: Math.max(0, startMinutesFromViewStart),
          durationInMinutes: Math.max(15, durationMinutesVisual),
          width: width,
          left: left,
          zIndex: 10 + index,
          gridColumnIndex: index,
          gridColumnCount: count
        });
      });
    });

    return laidOutEvents;
  }

  // For month/week headers
  weekDayNames = computed(() => {
    const start = startOfWeek(new Date(), { locale: this.dateUtil.getLocale(this.locale()), weekStartsOn: this.weekStartsOn() });
    return Array.from({ length: 7 }).map((_, i) =>
      this.dateUtil.format(this.dateUtil.addDays(start, i), 'EEEEEE', this.locale()) // Short day name eg. Mo, Tu
    );
  });

  viewTitle = computed(() => {
    const date = this._parsedCenterDate();
    const loc = this.locale();
    const tz = this.timeZone();
    switch (this.currentView()) {
      case 'month': return this.dateUtil.format(date, 'LLLL yyyy', loc, tz); // "January 2024"
      case 'week':
        const { start, end } = this.viewDateRange();
        const startStr = this.dateUtil.format(start, 'LLL d', loc, tz);
        const endStr = this.dateUtil.format(end, 'LLL d, yyyy', loc, tz);
        return `${startStr} - ${endStr}`;
      case 'day': return this.dateUtil.format(date, 'EEEE, LLLL d, yyyy', loc, tz); // "Monday, January 21, 2024"
      default: return '';
    }
  });


  constructor() {
    // Effect to emit viewChanged event
    effect(() => {
      const view = this.currentView();
      const center = this.currentCenterDate();
      const { start, end } = this.viewDateRange();
      this.viewChanged.emit({
        view: view,
        centerDateISO: center,
        viewStartISO: this.dateUtil.toIsoString(start),
        viewEndISO: this.dateUtil.toIsoString(end)
      });
      // console.log('View or CenterDate changed:', view, center);
      this.scrollToCenter(); // Attempt to scroll when view/date changes
    }, { allowSignalWrites: true }); // Allow if scrollToCenter potentially writes to signals (less likely)

    // When events, filter, or view range change, recalculate display
    effect(() => {
      // console.log('Month View Days updated:', this.monthViewDays().length);
      // console.log('Processed events count:', this.processedEvents().length);
      // this.processedEvents(); // Access to trigger computation if needed for logging/debugging
    });
  }

  ngOnInit() {
    this.currentView.set(this.initialView());
    this.currentCenterDate.set(this.initialCenterDate());
  }

  ngAfterViewInit() {
    this.scrollToCenter();
  }

  // --- Navigation and View Controls ---
  setView(view: SchedulerView) {
    this.currentView.set(view);
  }

  private getMonthViewComponent(): any {
    if (!this.monthViewContainerRef) return null;

    // Access the component instance - note this is a simplified approach
    // In a more complete solution, you might use ViewChild with read: ComponentRef
    return this.monthViewContainerRef.nativeElement.querySelector('app-month-view');
  }

  navigate(direction: 'prev' | 'next' | 'today') {
    let newCenterDate = this._parsedCenterDate();
    if (direction === 'today') {
      newCenterDate = new Date();
      this.currentCenterDate.set(toISODateString(newCenterDate));

      // Use the properly typed ViewChild reference
      setTimeout(() => {
        if (this.currentView() === 'month' && this.monthViewComponent) {
          this.monthViewComponent.scrollToToday();
        }
      }, 50);

      return;
    }

    // Rest of existing navigation logic for prev/next...
    const amount = direction === 'prev' ? -1 : 1;
    switch (this.currentView()) {
      case 'month': newCenterDate = this.dateUtil.addMonths(newCenterDate, amount); break;
      case 'week': newCenterDate = this.dateUtil.addWeeks(newCenterDate, amount); break;
      case 'day': newCenterDate = this.dateUtil.addDays(newCenterDate, amount); break;
    }

    this.currentCenterDate.set(toISODateString(newCenterDate));
  }

  // --- Event Handlers from Child Views ---
  handleEventDropped(payload: { event: CalendarEvent, newStart: string, newEnd: string }) {
    // Update the event in your main `events` array or signal if it's mutable
    // For immutable patterns, you'd create a new array:
    const updatedEvents = this.events().map(e =>
      e.id === payload.event.id ? { ...e, start: payload.newStart, end: payload.newEnd } : e
    );
    // this.events.set(updatedEvents); // If `events` was a WritableSignal managed by this component

    // Emit output
    this.eventMoved.emit(payload);
  }

  handleSlotClicked(dateTimeIso: string) {
    // Instead of immediately creating an event, just record the slot information
    this.pendingEventSlot.set({
      date: dateTimeIso,
      timeZone: this.timeZone()
    });

    // Emit the slot click event (the parent app can use this to show a form)
    this.slotClicked.emit({
      date: dateTimeIso,
      timeZone: this.timeZone()
    });
  }

  createEventFromSlot(eventDetails: {
    title: string;
    type: string;
    description?: string;
    allDay?: boolean;
    durationMinutes?: number;
  }) {
    const slot = this.pendingEventSlot();
    if (!slot) return null;

    const startTime = new Date(slot.date);
    const endTime = addMinutes(startTime, eventDetails.durationMinutes || 60);

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}`, // Generate a temporary ID
      title: eventDetails.title,
      type: eventDetails.type,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      allDay: eventDetails.allDay || false,
      data: {
        description: eventDetails.description || ''
      }
    };

    // Reset pending slot
    this.pendingEventSlot.set(null);

    // Return the created event (parent app should add it to the events list)
    return newEvent;
  }

  handleEventClicked(event: CalendarEvent) {
    this.eventEdited.emit(event);
  }

  handleEventDeleted(event: CalendarEvent) {
    this.eventDeleted.emit(event);
  }

  handleEventMoveEdit(moveData: { event: CalendarEvent, newStart: string, newEnd: string }) {
    this.eventMoveRequested.emit(moveData);
  }

  // --- Scrolling Logic ---
  private scrollToCenter() {
    // This is a simplified scroll. For week/day views, it might involve scrolling
    // to a specific hour or ensuring the 'centerDate' day is visible.
    // Needs `afterNextRender` or `afterRender` for reliability if DOM elements are conditional
    Promise.resolve().then(() => { // Wait for microtask queue / next render cycle
      let container: HTMLElement | undefined;
      if (this.currentView() === 'month' && this.monthViewComponent) {
        // Use the component method directly
        this.monthViewComponent.scrollToCurrentViewDate();
        return;
      } else if (this.currentView() === 'week' && this.weekViewContainerRef) {
        // @ts-ignore
        container = this.weekViewContainerRef.nativeElement.querySelector(`.day-column-${this.dateUtil.getDay(this._parsedCenterDate())}`)! || this.weekViewContainerRef?.nativeElement!;
        // Also scroll vertically to ~8 AM or work start hour
      } else if (this.currentView() === 'day' && this.dayViewContainerRef) {
        container = this.dayViewContainerRef.nativeElement;
        // Scroll vertically to ~8 AM or work start hour
      }

      if (container && typeof container.scrollIntoView === 'function') {
        // More sophisticated scrolling would find the exact day/hour element.
        // For horizontal scroll in week view:
        // const targetDayElement = container.querySelector(`.day-column-${this.dateUtil.getDay(this._parsedCenterDate())}`);
        // targetDayElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        // For now, simple scroll to top of container
        // container.scrollTop = 0; // or scroll to a specific hour
        if (container.scrollTo) {
          container.scrollTo({ top: 0, behavior: 'smooth'});
        } else {
          container.scrollTop = 0; // Fallback
        }
        // console.log(`Scrolling to center for view ${this.currentView()}`);
      }
    });
  }

  // --- Lazy Loading Example (for filter date picker) ---
  async openDateRangePicker() {
    // Placeholder for lazy loading a date picker module and component
    // const { DatePickerModalComponent } = await import('./lazy/date-picker-modal.component');
    // const modalService = inject(NgbModal); // Example if using ng-bootstrap
    // modalService.open(DatePickerModalComponent);
    alert('Date range picker functionality to be implemented with lazy loading.');
  }

  // Accessibility
  getAriaLiveMessage(): string {
    return `Calendar view changed to ${this.currentView()}. Displaying dates around ${this.viewTitle()}.`;
  }

}
