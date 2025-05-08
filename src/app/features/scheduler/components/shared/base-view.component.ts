// base-view.component.ts
import { Directive, input, output, inject, signal, computed } from '@angular/core';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel, HourViewModel } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import { SchedulerLayoutService, ViewLayoutConfig } from '../../services/scheduler-layout.service';
import { addMinutes, differenceInMinutes, getHours, getMinutes, setHours, setMinutes } from 'date-fns';

@Directive()
export abstract class BaseViewComponent {
  // Common inputs for all view components
  days = input<DayViewModel[]>();
  weekDayNames = input<string[]>();
  hoursRange = input<{ start: number, end: number }>({ start: 0, end: 24 });
  currentViewDate = input<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Common outputs
  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  eventMoveEdit = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();

  // Injected services
  protected dateUtil = inject(DateUtilService);
  protected layoutService = inject(SchedulerLayoutService);

  // Common UI settings
  public hourSegmentHeight = signal(80);
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  // Common computed properties
  hourSegments = computed(() => {
    const range = this.hoursRange();
    const segments: { date: Date, displayLabel: string }[] = [];
    const baseDateForHourIteration = new Date(2000, 0, 1);

    for (let h = range.start; h < range.end; h++) {
      const hourUtc = setMinutes(setHours(baseDateForHourIteration, h), 0);
      segments.push({
        date: hourUtc,
        displayLabel: this.dateUtil.formatInTimeZone(hourUtc, this.timeZone(), 'p', this.locale())
      });
    }

    return segments;
  });

  /**
   * Initialize view-specific elements (to be called in ngAfterViewInit)
   */
  protected initializeView(): void {
    // To be implemented by child classes
  }

  /**
   * Handle click on a time slot
   */
  protected handleTimeSlotClick(date: Date, hour?: number, minute?: number): void {
    let slotDate = new Date(date);

    if (hour !== undefined) {
      slotDate = setHours(slotDate, hour);
      slotDate = setMinutes(slotDate, minute || 0);
    }

    this.slotClicked.emit(this.dateUtil.toIsoString(slotDate));
  }

  /**
   * Handle event click
   */
  protected handleEventItemClicked(event: DisplayCalendarEvent, domEvent?: MouseEvent): void {
    if (domEvent) {
      domEvent.stopPropagation();
    }
    this.eventClicked.emit(event.originalEvent);
  }

  /**
   * Handle event deletion
   */
  protected handleEventItemDeleted(event: DisplayCalendarEvent, domEvent?: MouseEvent): void {
    if (domEvent) {
      domEvent.stopPropagation();
    }
    this.eventDeleted.emit(event.originalEvent);
  }

  /**
   * Handle event drag and drop
   */
  protected onTimeSlotDrop(
    dropEvent: CdkDragDrop<any, any, DisplayCalendarEvent>,
    targetDate: Date,
    targetHour?: number,
    targetMinute?: number
  ): void {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent;
    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    const duration = differenceInMinutes(originalEndUtc, originalStartUtc);

    // Calculate new start time
    let newStartUTC = new Date(targetDate);
    if (targetHour !== undefined) {
      newStartUTC = setHours(newStartUTC, targetHour);
      newStartUTC = setMinutes(newStartUTC, targetMinute || 0);
    }

    // Keep all-day state or convert to timed event
    let newAllDay = movedEvent.allDay;
    if (dropEvent.container.id === 'all-day-drop-list') {
      newAllDay = true;
    } else if (movedEvent.allDay && targetHour !== undefined) {
      newAllDay = false;
    }

    // Calculate new end time
    let newEndUTC = addMinutes(newStartUTC, duration > 0 ? duration : 60);

    // Emit move event
    this.eventMoveEdit.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  /**
   * Get styled events for all-day section
   */
  protected getAllDayEvents(events: DisplayCalendarEvent[]): DisplayCalendarEvent[] {
    return events.filter(event => event.allDay || event.isMultiDaySpan);
  }

  /**
   * Get styled events for time grid
   */
  protected getRegularEvents(events: DisplayCalendarEvent[]): DisplayCalendarEvent[] {
    return events.filter(event => !event.allDay && !event.isMultiDaySpan);
  }

  /**
   * Get event style object
   */
  protected getEventStyle(event: DisplayCalendarEvent): any {
    // Use layoutService to calculate position
    const config: ViewLayoutConfig = {
      hourHeight: this.hourSegmentHeight(),
      dayStartHour: this.hoursRange().start,
      dayEndHour: this.hoursRange().end
    };

    // Get position from layout service
    return this.layoutService.calculateEventPosition(
      event,
      'day', // This should be dynamic based on current view
      config
    );
  }

  protected onDragEnded(event: CdkDragEnd<DisplayCalendarEvent>): void {
    // Optional cleanup if needed
  }
}
