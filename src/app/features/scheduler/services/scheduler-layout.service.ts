import { Injectable } from '@angular/core';
import { DisplayCalendarEvent } from '../models/calendar-event.model';
import { differenceInMinutes, getHours, getMinutes, isBefore, isAfter, max, min } from 'date-fns';

export interface EventPosition {
  top: string;
  left: string;
  width: string;
  height: string;
  zIndex: number;
}

export interface ViewLayoutConfig {
  hourHeight: number;
  dayStartHour: number;
  dayEndHour: number;
  columnWidth: number;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulerLayoutService {
  /**
   * Calculate the position and dimensions for an event in any view
   */
  calculateEventPosition(
    event: DisplayCalendarEvent,
    viewType: 'month' | 'week' | 'day',
    config: ViewLayoutConfig
  ): EventPosition {
    // Common calculations
    const minuteHeight = config.hourHeight / 60;

    if (event.allDay || event.isMultiDaySpan) {
      return this.getAllDayEventPosition(event, viewType);
    }

    // Common calculation for time-based events
    const startMinutesFromDayStart = Math.max(
      0,
      (getHours(event.displayStart) - config.dayStartHour) * 60 + getMinutes(event.displayStart)
    );

    const top = (startMinutesFromDayStart * minuteHeight);

    // Calculate duration
    const visibleEnd = event.displayEnd;
    const duration = Math.max(15, differenceInMinutes(visibleEnd, event.displayStart));
    const height = Math.max(minuteHeight * 15, duration * minuteHeight);

    // Position based on overlap group
    const { left, width, zIndex } = this.calculateOverlapPosition(event);

    return {
      top: `${top}px`,
      height: `${height}px`,
      left,
      width,
      zIndex
    };
  }

  /**
   * Position all-day events
   */
  private getAllDayEventPosition(
    event: DisplayCalendarEvent,
    viewType: 'month' | 'week' | 'day'
  ): EventPosition {
    // All-day events use a simpler layout
    return {
      top: '5px',
      left: '3%',
      width: '94%',
      height: '24px',
      zIndex: 5
    };
  }

  /**
   * Calculate horizontal position for overlapping events
   */
  private calculateOverlapPosition(event: DisplayCalendarEvent): { left: string, width: string, zIndex: number } {
    const count = event.gridColumnCount || 1;
    const index = event.gridColumnIndex || 0;

    // Calculate width and left position for side-by-side display
    const width = count > 1 ? `${Math.max(20, 96 / count)}%` : '96%';
    const left = count > 1 ? `${(index * (96 / count)) + 2}%` : '2%';

    return {
      left,
      width,
      zIndex: 10 + (index || 0)
    };
  }

  /**
   * Layout events for a time-based view (week/day)
   */
  layoutEventsForTimeGrid(
    events: DisplayCalendarEvent[],
    dayDate: Date,
    dayStartHour: number,
    dayEndHour: number
  ): DisplayCalendarEvent[] {
    if (!events.length) return [];

    // Group events by start time (rounded to 5-minute intervals)
    const eventsByStartTime = this.groupEventsByStartTime(events);
    const laidOutEvents: DisplayCalendarEvent[] = [];

    // Calculate positions for each group
    eventsByStartTime.forEach((groupEvents, startTimeKey) => {
      const count = groupEvents.length;

      groupEvents.forEach((event, index) => {
        // Calculate start minutes from day start
        const startMinutesFromDayStart = Math.max(
          0,
          (getHours(event.displayStart) - dayStartHour) * 60 + getMinutes(event.displayStart)
        );

        // Calculate visible duration
        const visibleEnd = event.displayEnd;
        const duration = Math.max(
          15,
          differenceInMinutes(visibleEnd, event.displayStart)
        );

        // Position the event
        laidOutEvents.push({
          ...event,
          gridRowStartMinutes: Math.max(0, startMinutesFromDayStart),
          durationInMinutes: duration,
          width: count > 1 ? `${Math.max(20, 96 / count)}%` : '96%',
          left: count > 1 ? `${(index * (96 / count)) + 2}%` : '2%',
          zIndex: 10 + index,
          gridColumnIndex: index,
          gridColumnCount: count
        });
      });
    });

    return laidOutEvents;
  }

  /**
   * Group events by their start time
   */
  private groupEventsByStartTime(events: DisplayCalendarEvent[]): Map<string, DisplayCalendarEvent[]> {
    const eventsByStartTime = new Map<string, DisplayCalendarEvent[]>();

    // Sort events by start time
    events.sort((a, b) => a.displayStart.getTime() - b.displayStart.getTime());

    // Group events that start at the same time (rounded to 5-minute intervals for flexibility)
    events.forEach(event => {
      const roundedStart = Math.floor(
        (getHours(event.displayStart) * 60 + getMinutes(event.displayStart)) / 5
      ) * 5;

      const key = `${roundedStart}`;
      if (!eventsByStartTime.has(key)) {
        eventsByStartTime.set(key, []);
      }
      eventsByStartTime.get(key)!.push(event);
    });

    return eventsByStartTime;
  }

  /**
   * Process events for display in any view
   */
  processEventsForDisplay(
    events: DisplayCalendarEvent[],
    viewStart: Date,
    viewEnd: Date,
    timeZone: string
  ): DisplayCalendarEvent[] {
    // This consolidates the mapEventsToDisplayFormat logic from SchedulerComponent
    // Implementation would include handling multi-day events, etc.
    return events;
  }
}
