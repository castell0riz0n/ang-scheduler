import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal } from '@angular/core';
import {CdkDragDrop, CdkDragEnd, DragDropModule} from '@angular/cdk/drag-drop';
import { CalendarEvent, DayViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import { addMinutes, differenceInMinutes, getHours, getMinutes, startOfDay, isBefore, setHours, setMinutes } from 'date-fns';
import {CommonModule} from '@angular/common';
import {EventItemComponent} from '../event-item/event-item.component'; // Ensure all needed are imported

interface HourSegment {
  date: Date; // UTC Date representing the start of this hour segment (e.g., on a generic day, hour matters)
  displayLabel: string;
}

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    EventItemComponent
  ],
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekViewComponent {
  days = input.required<DayViewModel[]>();
  weekDayNames = input.required<string[]>();
  hoursRange = input.required<{ start: number, end: number }>();
  currentViewDate = input.required<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService); // Make public for template

  public hourSegmentHeight = signal(60); // Pixels for one hour segment
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  hourSegments = computed<HourSegment[]>(() => {
    const range = this.hoursRange();
    const segments: HourSegment[] = [];
    // Use a constant base date just for hour iteration; day.date gives the actual day
    const baseDateForHourIteration = new Date(2000, 0, 1); // Arbitrary fixed date
    for (let h = range.start; h < range.end; h++) {
      // Create a UTC date for this hour.
      const hourUtc = this.dateUtil.setMinutes(this.dateUtil.setHours(baseDateForHourIteration, h), 0);
      segments.push({
        date: hourUtc, // UTC date, only hour/minute part is used for label generation context
        displayLabel: this.dateUtil.formatInTimeZone(hourUtc, this.timeZone(), 'p', this.locale()) // Format 'h a' or 'HH:mm'
      });
    }
    return segments;
  });

  onTimeSlotDrop(
    dropEvent: CdkDragDrop<any, any, DisplayCalendarEvent>,
    dayTarget: DayViewModel,
    hourSegmentTarget: HourSegment
  ) {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent;
    const targetDayUtc = dayTarget.date; // This is UTC start of day

    const targetHourUtc = getHours(hourSegmentTarget.date); // Hour from the generic segment date
    // targetMinute is 0 because hourSegment.date is start of hour

    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    const duration = differenceInMinutes(originalEndUtc, originalStartUtc);

    // New start time: combine targetDayUtc with targetHourUtc
    let newStartUTC = this.dateUtil.setMinutes(this.dateUtil.setHours(new Date(targetDayUtc), targetHourUtc), 0);

    // Handle all-day events dropped into timed area
    let newAllDay = movedEvent.allDay;
    if (movedEvent.allDay) { // If it WAS all-day, make it timed starting at this slot
      newAllDay = false;
      // Default duration for newly timed event, e.g., 1 hour
      // const newDuration = duration > 0 ? duration : 60;
      // If it was a multi-day all-day event, it becomes a single-day timed event of its original duration or default
    }

    let newEndUTC = addMinutes(newStartUTC, duration > 0 ? duration : 60); // ensure min duration

    this.eventDropped.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  onDragEnded(dragEndEvent: CdkDragEnd<DisplayCalendarEvent>) {
    // Example: Add a class briefly to show it dropped, then remove.
    // Or re-fetch/re-calculate if external state needs refresh signal.
    // CDK automatically reverts if not dropped in a cdkDropList.
  }

  // Style for event rendering based on `gridRowStartMinutes` and `durationInMinutesGrid` from SchedulerComponent pre-processing
  getEventStyle(event: DisplayCalendarEvent): any {
    // event.gridRowStartMinutes is relative to the start of the day's visual part (hoursRange().start)
    const top = event.gridRowStartMinutes! * this.minuteHeight(); // Add ! if sure it's populated
    const height = event.durationInMinutes! * this.minuteHeight();

    return {
      top: `${top}px`,
      height: `${Math.max(this.minuteHeight() * 15, height)}px`, // Min height
      left: event.left || '1%',
      width: event.width || '98%',
      zIndex: event.zIndex || 10,
    };
  }

  handleTimeSlotClick(day: DayViewModel, hourSegment: HourSegment) {
    const clickedHour = getHours(hourSegment.date);
    // Combine day.date (UTC start of day) with hour from hourSegment
    const clickedDateTimeUtc = setMinutes(setHours(new Date(day.date), clickedHour), 0);
    this.slotClicked.emit(this.dateUtil.toIsoString(clickedDateTimeUtc));
  }

  handleEventItemClicked(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    domEvent.stopPropagation(); // Prevent slotClick
    this.eventClicked.emit(event.originalEvent);
  }
}
