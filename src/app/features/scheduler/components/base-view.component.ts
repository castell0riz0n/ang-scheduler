import { Directive, input, output, inject, ElementRef, AfterViewInit } from '@angular/core';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel, HourViewModel } from '../models/calendar-event.model';
import { DateUtilService } from '../services/date.service';
import { SchedulerLayoutService } from '../services/scheduler-layout.service';
import { addMinutes, differenceInMinutes, getHours, getMinutes, setHours, setMinutes } from 'date-fns';

@Directive()
export abstract class BaseViewComponent implements AfterViewInit {
  // Common inputs for all view components
  events = input.required<DisplayCalendarEvent[]>();
  currentViewDate = input.required<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  hourSegmentHeight = input<number>(80);

  // Common outputs
  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  eventMoveEdit = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();

  // Injected services
  protected dateUtil = inject(DateUtilService);
  protected layoutService = inject(SchedulerLayoutService);

  ngAfterViewInit(): void {
    this.initializeView();
  }

  /**
   * Initialize view-specific elements
   * (to be implemented by child classes)
   */
  protected abstract initializeView(): void;

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
    const config = {
      hourHeight: this.hourSegmentHeight(),
      dayStartHour: 0, // This should be from input
      dayEndHour: 24,  // This should be from input
      columnWidth: 150
    };

    // Get position from layout service
    const position = this.layoutService.calculateEventPosition(
      event,
      'day', // This should be dynamic based on current view
      config
    );

    // Add color properties
    return {
      ...position,
      borderLeft: '4px solid ' + (event.color?.primary || 'var(--event-default-color)'),
      backgroundColor: event.color?.secondary || 'var(--event-default-bg)',
      color: event.color?.textColor || 'var(--event-default-text)'
    };
  }

  protected onDragEnded(event: CdkDragEnd<DisplayCalendarEvent>): void {
    // Optional cleanup if needed
  }
}
