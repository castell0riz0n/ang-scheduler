// models/calendar-event.model.ts
export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  start: string; // ISO string format: "2025-01-21T09:30:00"
  end: string;   // ISO string format: "2025-01-21T10:30:00"
  recurrenceRule?: string; // RRULE format e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  color?: string; // Optional color override
  description?: string; // Optional description
  resourceId?: string; // For resource/group view
  metadata?: Record<string, any>; // For any additional data
}

export interface CalendarFilter {
  from?: string;
  to?: string;
  types?: string[];
  keyword?: string;
}

export interface CalendarViewState {
  view: 'month' | 'week' | 'day';
  centerDate: string;
  filter: CalendarFilter;
}

export interface CalendarOptions {
  startHour?: number; // Default hour to start in week/day view (e.g., 8 for 8:00 AM)
  endHour?: number;   // Default hour to end in week/day view (e.g., 18 for 6:00 PM)
  firstDayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  timeSlotDuration?: number; // In minutes, default 60
  typeColorMap?: Record<string, string>; // Mapping of event types to colors
}

export interface EventMoveResult {
  event: CalendarEvent;
  newStart: string;
  newEnd: string;
}

export interface ViewChangeResult {
  view: 'month' | 'week' | 'day';
  center: string;
}

// Utility type for recurrence expansions
export interface ExpandedEvent extends CalendarEvent {
  originalEventId: string; // Reference to the original recurring event
  instanceDate: string; // The specific date of this instance
  isRecurring: boolean; // Flag to indicate this is a recurring instance
}
