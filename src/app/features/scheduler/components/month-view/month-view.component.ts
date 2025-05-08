import { Component, input, output, computed, ChangeDetectionStrategy, inject, ViewChild, ElementRef, AfterViewInit, signal } from '@angular/core';
import {
  CdkDragDrop,
  CdkDragStart,
  CdkDragEnd,
  DragDropModule
} from '@angular/cdk/drag-drop';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import {
  startOfDay, addMinutes, differenceInMinutes, isBefore, addDays, endOfDay, differenceInDays,
  getHours, getMinutes, setHours, setMinutes
} from 'date-fns';
import { CommonModule } from '@angular/common';
import { EventItemComponent } from '../event-item/event-item.component';

// Define interface for hour segments (matching the week view)
interface HourSegment {
  date: Date; // UTC Date representing the start of this hour segment
  displayLabel: string;
}

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    EventItemComponent
  ],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthViewComponent implements AfterViewInit {
  days = input.required<DayViewModel[]>();
  weekDayNames = input.required<string[]>();
  currentViewDate = input.required<Date>(); // The date around which this view is centered
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Add new inputs for hour configuration (matching week view)
  hoursRange = input<{ start: number, end: number }>({ start: 0, end: 24 });

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>(); // Emits ISO string of the clicked day
  eventClicked = output<CalendarEvent>(); // For editing or other actions

  private dateUtil = inject(DateUtilService);
  public maxEventsPerCell = 3; // Configurable: how many events to show before "+N more"
  public hourSegmentHeight = signal(60); // Default height for hour segments (matching week view)

  @ViewChild('monthScrollContainer') monthScrollContainer?: ElementRef<HTMLElement>;

  // Generate hour segments for the time gutter (similar to week view)
  hourSegments = computed<HourSegment[]>(() => {
    const range = this.hoursRange();
    const segments: HourSegment[] = [];
    // Use a constant base date just for hour iteration
    const baseDateForHourIteration = new Date(2000, 0, 1); // Arbitrary fixed date
    for (let h = range.start; h < range.end; h++) {
      // Create a UTC date for this hour.
      const hourUtc = setMinutes(setHours(baseDateForHourIteration, h), 0);
      segments.push({
        date: hourUtc,
        displayLabel: this.dateUtil.formatInTimeZone(hourUtc, this.timeZone(), 'p', this.locale())
      });
    }
    return segments;
  });

  ngAfterViewInit() {
    // Scroll to the current week after view is initialized
    this.scrollToToday();
  }

  // Check if a day corresponds to today
  isDayToday(dayIndex: number): boolean {
    const today = new Date();
    return dayIndex === today.getDay();
  }

  // Scroll to today's column
  public scrollToToday() {
    if (!this.monthScrollContainer) return;

    setTimeout(() => {
      const todayCell = this.monthScrollContainer?.nativeElement.querySelector('.today-column');
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        // If today is not visible, scroll to the current view date
        this.scrollToCurrentViewDate();
      }
    }, 100);
  }

  // Scroll to the current view date
  public scrollToCurrentViewDate() {
    if (!this.monthScrollContainer) return;

    const currentViewDateStr = this.currentViewDate().toISOString().split('T')[0];
    const targetCell = this.monthScrollContainer.nativeElement.querySelector(`[data-date^="${currentViewDateStr}"]`);

    if (targetCell) {
      targetCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Handler for time slot clicks
  handleTimeSlotClick(day: DayViewModel, hourSegment: HourSegment) {
    // Combine day.date (UTC start of day) with hour from hourSegment
    const clickedHour = getHours(hourSegment.date);
    const clickedMinute = getMinutes(hourSegment.date);
    const clickedDateTimeUtc = setMinutes(setHours(new Date(day.date), clickedHour), clickedMinute);
    this.slotClicked.emit(this.dateUtil.toIsoString(clickedDateTimeUtc));
  }

  // Handle drops on time slots
  onTimeSlotDrop(
    dropEvent: CdkDragDrop<any, any, DisplayCalendarEvent>,
    dayTarget: DayViewModel,
    hourSegmentTarget: HourSegment
  ) {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent;
    const targetDayUtc = dayTarget.date; // This is UTC start of day

    const targetHourUtc = getHours(hourSegmentTarget.date); // Hour from the generic segment date
    const targetMinuteUtc = getMinutes(hourSegmentTarget.date); // Minutes from segment if needed

    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    const duration = differenceInMinutes(originalEndUtc, originalStartUtc);

    // New start time: combine targetDayUtc with targetHourUtc
    let newStartUTC = setMinutes(setHours(new Date(targetDayUtc), targetHourUtc), targetMinuteUtc);

    // Handle all-day events
    let newAllDay = movedEvent.allDay;
    if (movedEvent.allDay) {
      newAllDay = false; // Convert to timed event when dropping on time slot
    }

    let newEndUTC = addMinutes(newStartUTC, duration > 0 ? duration : 60);

    this.eventDropped.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  // Style for event rendering based on time properties
  getEventStyle(event: DisplayCalendarEvent): any {
    // Position based on start time and duration
    if (event.allDay) {
      return {
        top: '30px', // Just below the day number header
        left: '3%',
        width: '94%',
        height: '24px'
      };
    }

    // Calculate position based on time (similar to week view)
    const dayStart = this.hoursRange().start * 60; // Start hour in minutes
    const eventStart = getHours(event.displayStart) * 60 + getMinutes(event.displayStart);
    const startMinutesFromDayStart = Math.max(0, eventStart - dayStart);

    // Calculate top position
    const top = (startMinutesFromDayStart / 60) * this.hourSegmentHeight() + 30; // +30px for day header

    // Calculate height based on duration
    const duration = differenceInMinutes(event.displayEnd, event.displayStart);
    const height = Math.max(25, (duration / 60) * this.hourSegmentHeight());

    return {
      top: `${top}px`,
      left: '3%',
      width: '94%',
      height: `${height}px`,
      zIndex: 10
    };
  }

  // Existing methods
  dayTrackBy(index: number, day: DayViewModel) {
    return day.date.toISOString();
  }

  eventTrackBy(index: number, event: DisplayCalendarEvent) {
    return event.id;
  }

  onSlotClick(day: DayViewModel) {
    this.slotClicked.emit(this.dateUtil.toIsoString(startOfDay(day.date)));
  }

  onEventClick(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    domEvent.stopPropagation();
    this.eventClicked.emit(event.originalEvent);
  }

  onDragEnded(event: CdkDragEnd<DisplayCalendarEvent>) {
    // Handle drag end if needed
  }

  // Helper to slice events for cell display and show "+N more"
  getEventsForCell(day: DayViewModel): DisplayCalendarEvent[] {
    return day.events.slice(0, this.maxEventsPerCell);
  }

  getOverflowCount(day: DayViewModel): number {
    return Math.max(0, day.events.length - this.maxEventsPerCell);
  }
}
