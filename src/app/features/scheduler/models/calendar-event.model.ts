export interface CalendarEvent {
  id: string;
  title: string;
  type: string; // For color-coding and filtering
  start: string; // ISO string e.g., "2025-01-21T09:30:00"
  end: string;   // ISO string
  allDay?: boolean;
  recurrenceRule?: string; // RRULE string from rrule.js (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  exDate?: string[]; // Array of ISO date strings for exceptions
  data?: any; // For additional custom data
  resourceId?: string; // For resource/group view
  color?: { primary: string; secondary?: string; textColor?:string }; // Optional explicit color override
}

// Interface for events processed for display
export interface DisplayCalendarEvent extends CalendarEvent {
  displayStart: Date; // Parsed and timezone-adjusted start
  displayEnd: Date;   // Parsed and timezone-adjusted end
  isMultiDaySpan?: boolean; // If the event spans multiple days in the current view segment
  continuesBefore?: boolean; // If the event started before the current view segment
  continuesAfter?: boolean; // If the event continues after the current view segment
  gridColumnStart?: number; // For grid layout (e.g., day of week 1-7)
  gridRowStart?: number; // For hour-based grid
  gridRowEnd?: number; // For hour-based grid
  zIndex?: number;
  width?: string | number; // for positioning overlapping events
  left?: string | number;  // for positioning overlapping events
  gridRowStartMinutes?: number; // Calculated duration
  durationInMinutes?: number; // Calculated duration
  gridColumnIndex?: number; // Calculated duration
  originalEvent: CalendarEvent; // Reference to original event
  gridColumnCount?: number;
  multiDayGroupId?: string;
}

export interface DayViewModel {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean; // For month view styling
  events: DisplayCalendarEvent[];
  isWeekend: boolean;
}

export interface HourViewModel {
  date: Date; // Start of the hour
  label: string; // e.g., "9:00 AM"
  events: DisplayCalendarEvent[]; // Events that start or occur in this hour slot
}
