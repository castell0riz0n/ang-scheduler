import { Injectable } from '@angular/core';
import {CalendarEvent, DisplayCalendarEvent} from '../models/calendar-event.model';
import {getHours, getMinutes, differenceInMinutes, startOfDay, isAfter, max, min, endOfDay, isBefore} from 'date-fns';
import { DateUtilService } from './date.service';

export interface ViewLayoutConfig {
  hourHeight: number;
  dayStartHour: number;
  dayEndHour: number;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulerLayoutService {
  constructor(private dateUtil: DateUtilService) {}

  /**
   * Calculate the position and dimensions for an event in any view
   */
  calculateEventPosition(
    event: DisplayCalendarEvent,
    viewType: 'month' | 'week' | 'day',
    config: ViewLayoutConfig
  ): any {
    const { hourHeight, dayStartHour } = config;
    const minuteHeight = hourHeight / 60;

    if (event.allDay || event.isMultiDaySpan) {
      return {
        top: '5px',
        left: '3%',
        width: '94%',
        height: '24px',
        zIndex: 5,
        borderLeft: '4px solid ' + (event.color?.primary || 'var(--event-default-color)'),
        backgroundColor: event.color?.secondary || 'var(--event-default-bg)',
        color: event.color?.textColor || 'var(--event-default-text)'
      };
    }

    // For regular timed events
    const dayStartMinutes = dayStartHour * 60;
    const eventStartMinutes = getHours(event.displayStart) * 60 + getMinutes(event.displayStart);
    const startMinutesFromDayStart = Math.max(0, eventStartMinutes - dayStartMinutes);

    // Calculate the top position
    const top = startMinutesFromDayStart * minuteHeight;

    // Calculate the height based on duration
    const duration = differenceInMinutes(event.displayEnd, event.displayStart);
    const height = Math.max(minuteHeight * 15, duration * minuteHeight); // Minimum height of 15 minutes

    // Use width and left from event layout calculation (or default values)
    const width = event.width || '96%';
    const left = event.left || '2%';
    const zIndex = event.zIndex || 10;

    return {
      top: `${top}px`,
      height: `${height}px`,
      left,
      width,
      zIndex,
      borderLeft: '4px solid ' + (event.color?.primary || 'var(--event-default-color)'),
      backgroundColor: event.color?.secondary || 'var(--event-default-bg)',
      color: event.color?.textColor || 'var(--event-default-text)'
    };
  }

  /**
   * Layout events for a time-based view (week/day)
   * This consolidates the logic previously duplicated in WeekViewComponent and DayViewComponent
   */
  layoutEventsForTimeGrid(
    events: DisplayCalendarEvent[],
    dayStartHour: number,
    dayEndHour: number
  ): DisplayCalendarEvent[] {
    if (!events.length) return [];

    // Group events by start time (rounded to 5-minute intervals for flexibility)
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
        const duration = Math.max(
          15,
          differenceInMinutes(event.displayEnd, event.displayStart)
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
   * Group events by their start time (rounded to 5-minute intervals for flexibility)
   * Events starting at the same time will be displayed side by side
   */
  private groupEventsByStartTime(events: DisplayCalendarEvent[]): Map<string, DisplayCalendarEvent[]> {
    const eventsByStartTime = new Map<string, DisplayCalendarEvent[]>();

    // Sort events by start time
    events.sort((a, b) => a.displayStart.getTime() - b.displayStart.getTime());

    // Group events that start at the same time (rounded to 5-minute intervals)
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
   * Layout all-day events for month or week view
   * Handles positioning and stacking of all-day events
   */
  layoutAllDayEvents(events: DisplayCalendarEvent[]): DisplayCalendarEvent[] {
    // Sort all-day events by duration (longest first) for better visual layout
    const sortedEvents = [...events].sort((a, b) => {
      const aDuration = this.dateUtil.differenceInMinutes(a.displayEnd, a.displayStart);
      const bDuration = this.dateUtil.differenceInMinutes(b.displayEnd, b.displayStart);
      return bDuration - aDuration;
    });

    // Simple positioning for now - can be enhanced with collision detection
    return sortedEvents.map((event, index) => ({
      ...event,
      top: `${(index * 25) + 2}px`,
      zIndex: 5
    }));
  }

  processEventsForDisplay(
    events: CalendarEvent[],
    viewStart: Date,
    viewEnd: Date,
    timeZone: string
  ): DisplayCalendarEvent[] {
    const processedEvents: DisplayCalendarEvent[] = [];

    events.forEach(event => {
      const displayStart = this.dateUtil.parseWithTz(event.start, timeZone);
      const displayEnd = this.dateUtil.parseWithTz(event.end, timeZone);

      // Determine if the event spans multiple days
      const isMultiDay = !this.dateUtil.isSameDay(displayStart, displayEnd);

      if (isMultiDay) {
        // For multi-day events, create segments for each day
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
                durationInMinutes: this.dateUtil.differenceInMinutes(segmentEnd, segmentStart),
                multiDayGroupId: event.id
              });
            }
          }

          // Move to next day
          currentDay = this.dateUtil.addDays(currentDay, 1);
        }
      } else {
        // Single-day events
        processedEvents.push({
          ...event,
          originalEvent: event,
          displayStart,
          displayEnd,
          continuesBefore: false,
          continuesAfter: false,
          isMultiDaySpan: false,
          durationInMinutes: this.dateUtil.differenceInMinutes(displayEnd, displayStart)
        });
      }
    });

    // Sort events and prepare for layout
    return this.prepareEventsLayout(processedEvents);
  }

  /**
   * Add this helper method to organize events for proper display
   * It stacks multi-day events consistently across days
   */
  private prepareEventsLayout(events: DisplayCalendarEvent[]): DisplayCalendarEvent[] {
    // First sort events
    events.sort((a, b) => {
      // Sort by multi-day first (all-day events on top)
      if (a.isMultiDaySpan !== b.isMultiDaySpan) {
        return a.isMultiDaySpan ? -1 : 1;
      }

      // Then by start time
      return a.displayStart.getTime() - b.displayStart.getTime();
    });

    // Track positions of multi-day events to keep them consistent
    const multiDayPositions = new Map<string, number>();
    let nextPosition = 0;

    // Find all unique multi-day event groups and assign positions
    events.filter(e => e.isMultiDaySpan && e.multiDayGroupId).forEach(e => {
      if (!multiDayPositions.has(e.multiDayGroupId!)) {
        multiDayPositions.set(e.multiDayGroupId!, nextPosition++);
      }
    });

    // Apply positions to events
    return events.map(event => {
      if (event.isMultiDaySpan && event.multiDayGroupId) {
        const position = multiDayPositions.get(event.multiDayGroupId!) || 0;
        // Add position-specific properties
        return {
          ...event,
          multiDayPosition: position,
          top: `${position * 35 + 5}px`, // 35px height per event + 5px padding
          height: '30px',
          zIndex: 10 + position
        };
      }
      return event;
    });
  }

}
