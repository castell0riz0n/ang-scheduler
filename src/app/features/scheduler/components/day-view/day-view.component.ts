import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';

import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { CalendarEvent, HourViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import {
  addMinutes,
  differenceInMinutes,

  startOfDay,

  endOfDay
} from 'date-fns';

@Component({
  selector: 'app-day-view',
  standalone: false,
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent implements AfterViewInit {
  // `hours` is Array<HourViewModel>, where HourViewModel.events contains DisplayCalendarEvent[] already processed by layoutEventsForTimeGrid
  hours = input.required<HourViewModel[]>();
  currentViewDate = input.required<Date>(); // UTC Date of the current day
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  dayStartHourInput = input<number>(0); // From scheduler main config for mapping gridRowStart correctly

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService);

  @ViewChild('eventsViewport') eventsViewport?: CdkVirtualScrollViewport;
  @ViewChild('timeGutterViewport') timeGutterViewport?: CdkVirtualScrollViewport;

  public hourSegmentHeight = signal(60); // px for a 1-hour segment.
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  // Flatten all timed events for absolute positioning overlay
  // The events in `hour.events` are already DisplayCalendarEvent with layout properties
  allTimedEvents = computed(() => {
    const uniqueEvents = new Map<string, DisplayCalendarEvent>();
    this.hours().forEach(hourVM => {
      hourVM.events.filter(e => !e.allDay).forEach(event => {
        if (!uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    return Array.from(uniqueEvents.values());
  });

  allDayEventsList = computed(() => {
    const uniqueEvents = new Map<string, DisplayCalendarEvent>();
    this.hours().forEach(hourVM => { // Could also come from a dedicated allDayEvents input if separated earlier
      hourVM.events.filter(e => e.allDay).forEach(event => {
        if (!uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    return Array.from(uniqueEvents.values());
  });

  ngAfterViewInit() {
    // Attempt to synchronize scrolling if both viewports exist
    if (this.eventsViewport && this.timeGutterViewport) {
      this.eventsViewport.elementScrolled().subscribe(() => {
        if (this.eventsViewport && this.timeGutterViewport) {
          this.timeGutterViewport.scrollTo({ top: this.eventsViewport.measureScrollOffset('top') });
        }
      });
      // Could add vice-versa, but usually gutter isn't independently scrollable
    }
  }

  onTimeSlotDrop(
    dropEvent: CdkDragDrop<any, any, DisplayCalendarEvent>,
    hourDroppedOn: HourViewModel // HourViewModel for the slot
  ) {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent;
    // currentViewDate() is the UTC start of the day.
    // hourDroppedOn.date is the UTC Date object for the start of that specific hour on that day.

    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    let duration = differenceInMinutes(originalEndUtc, originalStartUtc);
    if (duration <= 0) duration = 60; // Default duration if needed

    // New start time is simply the start of the hour slot dropped onto
    let newStartUTC = new Date(hourDroppedOn.date); // This is already UTC start of hour
    let newEndUTC = addMinutes(newStartUTC, duration);

    let newAllDay = movedEvent.allDay;
    if (dropEvent.container.id === 'all-day-drop-list') { // If dropped in all-day area
      newAllDay = true;
      newStartUTC = startOfDay(this.currentViewDate()); // Ensure it's start of day
      if (duration < 24*60) duration = 24*60 -1; // make it full day
      newEndUTC = endOfDay(addMinutes(newStartUTC, duration));
    } else { // Dropped in timed area
      newAllDay = false;
    }

    this.eventDropped.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  onDragEnded(dragEndEvent: CdkDragEnd<DisplayCalendarEvent>) { /* Optional */ }

  getEventStyle(event: DisplayCalendarEvent): any {
    // event.gridRowStartMinutes is calculated by SchedulerComponent's layoutEventsForTimeGrid
    // relative to the dayViewStartHour (e.g., 0 for 12AM, or if day view starts at 8AM, then relative to 8AM).
    // The HourViewModel.date objects are absolute UTC hours.
    // So, gridRowStartMinutes should be offset by the *actual* start hour of the visible segments.
    // For DayView, hours() is the direct source of visible segments.
    // `event.gridRowStartMinutes` should already be relative to `this.dayStartHourInput()`

    const top = (event.gridRowStartMinutes || 0) * this.minuteHeight();
    const height = (event.durationInMinutes || 60) * this.minuteHeight();

    return {
      top: `${top}px`,
      height: `${Math.max(this.minuteHeight() * 15, height)}px`,
      left: event.left || '5%', // Add some gutter
      width: event.width || '90%',
      zIndex: event.zIndex || 10,
    };
  }

  handleTimeSlotClick(hour: HourViewModel) {
    // hour.date is already the UTC start of that hour for the current day
    this.slotClicked.emit(this.dateUtil.toIsoString(hour.date));
  }

  handleEventItemClicked(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    domEvent.stopPropagation();
    this.eventClicked.emit(event.originalEvent);
  }
}
