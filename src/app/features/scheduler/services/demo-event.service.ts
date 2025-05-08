import { Injectable } from '@angular/core';
import { CalendarEvent } from '../models/calendar-event.model';
import { addDays, addHours, addMinutes, addMonths, addWeeks, startOfDay, startOfMonth, setHours, setMinutes } from 'date-fns';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DemoEventService {
  private eventsSubject = new BehaviorSubject<CalendarEvent[]>([]);
  private currentId = 1;

  constructor() {
    // Initialize with demo data
    this.generateDemoEvents();
  }

  get events$(): Observable<CalendarEvent[]> {
    return this.eventsSubject.asObservable();
  }

  get events(): CalendarEvent[] {
    return this.eventsSubject.value;
  }

  updateEvent(updatedEvent: CalendarEvent): void {
    const events = this.eventsSubject.value;
    const index = events.findIndex(e => e.id === updatedEvent.id);

    if (index !== -1) {
      events[index] = updatedEvent;
      this.eventsSubject.next([...events]);
    }
  }

  moveEvent(eventId: string, newStart: string, newEnd: string, allDay?: boolean): void {
    const events = this.eventsSubject.value;
    const index = events.findIndex(e => e.id === eventId);

    if (index !== -1) {
      const updatedEvent = {
        ...events[index],
        start: newStart,
        end: newEnd
      };

      if (allDay !== undefined) {
        updatedEvent.allDay = allDay;
      }

      events[index] = updatedEvent;
      this.eventsSubject.next([...events]);
    }
  }

  addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event-${this.currentId++}`
    };

    this.eventsSubject.next([...this.eventsSubject.value, newEvent]);
    return newEvent;
  }

  deleteEvent(eventId: string): void {
    const events = this.eventsSubject.value.filter(e => e.id !== eventId);
    this.eventsSubject.next(events);
  }

  generateDemoEvents(): void {
    const now = new Date();
    const today = startOfDay(now);
    const events: CalendarEvent[] = [];

    // Add standard meetings (simple events)
    events.push(
      {
        id: `event-${this.currentId++}`,
        title: 'Team Standup',
        type: 'meeting',
        start: setMinutes(setHours(today, 9), 30).toISOString(),
        end: setMinutes(setHours(today, 10), 0).toISOString(),
        data: {
          description: 'Daily team standup meeting to discuss progress and blockers',
          attendees: ['John', 'Sarah', 'Mike', 'Lisa']
        }
      },
      {
        id: `event-${this.currentId++}`,
        title: 'Project Review',
        type: 'meeting',
        start: setMinutes(setHours(today, 14), 0).toISOString(),
        end: setMinutes(setHours(today, 15), 30).toISOString(),
        data: { description: 'Quarterly project review with stakeholders' }
      }
    );

    // Add an all-day event
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Company Holiday',
      type: 'holiday',
      start: startOfDay(addDays(today, 3)).toISOString(),
      end: startOfDay(addDays(today, 4)).toISOString(),
      allDay: true,
      data: { description: 'Company-wide holiday - offices closed' }
    });

    // Add a multi-day event
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Conference',
      type: 'out-of-office',
      start: startOfDay(addDays(today, 6)).toISOString(),
      end: startOfDay(addDays(today, 9)).toISOString(),
      allDay: true,
      data: {
        description: 'Annual industry conference',
        location: 'Convention Center'
      }
    });

    // Add a task (non-meeting event)
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Quarterly Report Due',
      type: 'task',
      start: setHours(addDays(today, 1), 15).toISOString(),
      end: setHours(addDays(today, 1), 17).toISOString(),
      data: {
        description: 'Submit Q1 financial report to accounting',
        priority: 'high'
      }
    });

    // Add recurring events with RRULE

    // Weekly team meeting
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Weekly Team Meeting',
      type: 'meeting',
      start: setMinutes(setHours(addDays(today, 1), 10), 0).toISOString(),
      end: setMinutes(setHours(addDays(today, 1), 11), 30).toISOString(),
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=10', // Every Tuesday for 10 occurrences
      data: { description: 'Weekly team sync meeting' }
    });

    // Monthly planning meeting
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Monthly Planning',
      type: 'meeting',
      start: setMinutes(setHours(startOfMonth(addMonths(today, 1)), 9), 0).toISOString(),
      end: setMinutes(setHours(startOfMonth(addMonths(today, 1)), 12), 0).toISOString(),
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1;COUNT=6', // First day of every month for 6 months
      data: { description: 'Monthly planning and goal-setting session' }
    });

    // Daily reminder with exception dates
    const dailyReminder = {
      id: `event-${this.currentId++}`,
      title: 'Daily Check-in',
      type: 'reminder',
      start: setMinutes(setHours(today, 8), 45).toISOString(),
      end: setMinutes(setHours(today, 9), 0).toISOString(),
      recurrenceRule: 'FREQ=DAILY;COUNT=14', // Every day for 2 weeks
      // Skip weekends
      exDate: [
        startOfDay(addDays(today, 5)).toISOString(), // Skip Saturday
        startOfDay(addDays(today, 6)).toISOString(), // Skip Sunday
        startOfDay(addDays(today, 12)).toISOString(), // Skip next Saturday
        startOfDay(addDays(today, 13)).toISOString()  // Skip next Sunday
      ],
      data: { description: 'Daily project check-in reminder' }
    };
    events.push(dailyReminder);

    // Add events with custom colors
    events.push({
      id: `event-${this.currentId++}`,
      title: 'Client Meeting',
      type: 'client',
      start: setHours(addDays(today, 2), 13).toISOString(),
      end: setHours(addDays(today, 2), 14).toISOString(),
      color: { primary: '#e91e63', secondary: '#f8bbd0' }, // Custom pink color
      data: {
        description: 'Meeting with client to discuss project requirements',
        client: 'Acme Corp'
      }
    });

    // Add overlapping events (for testing rendering)
    events.push(
      {
        id: `event-${this.currentId++}`,
        title: 'Marketing Team Call',
        type: 'meeting',
        start: setMinutes(setHours(addDays(today, 4), 10), 0).toISOString(),
        end: setMinutes(setHours(addDays(today, 4), 11), 30).toISOString()
      },
      {
        id: `event-${this.currentId++}`,
        title: 'Product Review',
        type: 'meeting',
        start: setMinutes(setHours(addDays(today, 4), 10), 30).toISOString(),
        end: setMinutes(setHours(addDays(today, 4), 12), 0).toISOString()
      },
      {
        id: `event-${this.currentId++}`,
        title: 'Lunch with CEO',
        type: 'out-of-office',
        start: setMinutes(setHours(addDays(today, 4), 12), 0).toISOString(),
        end: setMinutes(setHours(addDays(today, 4), 13), 30).toISOString()
      }
    );

    this.eventsSubject.next(events);
  }
}
