import { Injectable } from '@angular/core';
import { WritableSignal, Signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CalendarEvent, CalendarFilter } from '../../models/calendar-event.model';

@Injectable()
export class CalendarService {
  private eventsSignal!: WritableSignal<CalendarEvent[]>;
  private filterSignal!: WritableSignal<CalendarFilter>;
  private viewSignal!: WritableSignal<'month' | 'week' | 'day'>;
  private centerDateSignal!: WritableSignal<string>;

  /**
   * Initialize the service with the component's signals
   * This allows us to keep the signals in the component but
   * have service methods that can update them
   */
  init(
    events: WritableSignal<CalendarEvent[]>,
    filter: WritableSignal<CalendarFilter>,
    view: WritableSignal<'month' | 'week' | 'day'>,
    centerDate: WritableSignal<string>
  ): Observable<boolean> {
    this.eventsSignal = events;
    this.filterSignal = filter;
    this.viewSignal = view;
    this.centerDateSignal = centerDate;

    return of(true);
  }

  /**
   * Updates an event's time after drag and drop
   */
  updateEventTime(eventId: string, newStart: string, newEnd: string): void {
    const events = this.eventsSignal();
    const eventIndex = events.findIndex(e => e.id === eventId);

    if (eventIndex !== -1) {
      const updatedEvents = [...events];
      updatedEvents[eventIndex] = {
        ...updatedEvents[eventIndex],
        start: newStart,
        end: newEnd
      };

      this.eventsSignal.set(updatedEvents);
    }
  }

  /**
   * Updates a recurring event's time for a specific instance
   * or for all future occurrences
   */
  updateRecurringEventTime(
    originalEventId: string,
    instanceDate: string,
    newStart: string,
    newEnd: string,
    applyToAllFuture: boolean = false
  ): void {
    // This is a simplified implementation
    // A full implementation would modify the RRULE or create an exception
    const events = this.eventsSignal();
    const eventIndex = events.findIndex(e => e.id === originalEventId);

    if (eventIndex !== -1) {
      // For now, we'll just update the base event
      // In a real implementation, you would handle RRULE modification
      // or create EXDATE exceptions
      const updatedEvents = [...events];
      updatedEvents[eventIndex] = {
        ...updatedEvents[eventIndex],
        start: newStart,
        end: newEnd
      };

      this.eventsSignal.set(updatedEvents);
    }
  }

  /**
   * Adds a new event to the calendar
   */
  addEvent(event: CalendarEvent): void {
    const events = this.eventsSignal();
    this.eventsSignal.set([...events, event]);
  }

  /**
   * Updates an existing event
   */
  updateEvent(updatedEvent: CalendarEvent): void {
    const events = this.eventsSignal();
    const eventIndex = events.findIndex(e => e.id === updatedEvent.id);

    if (eventIndex !== -1) {
      const updatedEvents = [...events];
      updatedEvents[eventIndex] = updatedEvent;
      this.eventsSignal.set(updatedEvents);
    }
  }

  /**
   * Removes an event from the calendar
   */
  removeEvent(eventId: string): void {
    const events = this.eventsSignal();
    this.eventsSignal.set(events.filter(e => e.id !== eventId));
  }

  /**
   * Updates the current filter
   */
  updateFilter(filter: CalendarFilter): void {
    this.filterSignal.set({...filter});
  }

  /**
   * Changes the view and optionally centers on a date
   */
  changeView(view: 'month' | 'week' | 'day', centerDate?: string): void {
    this.viewSignal.set(view);

    if (centerDate) {
      this.centerDateSignal.set(centerDate);
    }
  }
}
