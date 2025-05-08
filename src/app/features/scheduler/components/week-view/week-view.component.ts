import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal } from '@angular/core';
import { CdkDragDrop, CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CalendarEvent, DayViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import { addMinutes, differenceInMinutes, getHours, getMinutes, startOfDay, setHours, setMinutes } from 'date-fns';
import { CommonModule } from '@angular/common';
import { EventItemComponent } from '../event-item/event-item.component';

interface HourSegment {
  date: Date;
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
  eventMoveEdit = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService);

  public hourSegmentHeight = signal(80); // Increased from 60px to 80px
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  hourSegments = computed<HourSegment[]>(() => {
    const range = this.hoursRange();
    const segments: HourSegment[] = [];
    const baseDateForHourIteration = new Date(2000, 0, 1);
    for (let h = range.start; h < range.end; h++) {
      const hourUtc = setMinutes(setHours(baseDateForHourIteration, h), 0);
      segments.push({
        date: hourUtc,
        displayLabel: this.dateUtil.formatInTimeZone(hourUtc, this.timeZone(), 'p', this.locale())
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
    const targetDayUtc = dayTarget.date;
    const targetHourUtc = getHours(hourSegmentTarget.date);
    const targetMinuteUtc = getMinutes(hourSegmentTarget.date);

    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    const duration = differenceInMinutes(originalEndUtc, originalStartUtc);

    let newStartUTC = setMinutes(setHours(new Date(targetDayUtc), targetHourUtc), targetMinuteUtc);
    let newAllDay = movedEvent.allDay;

    if (movedEvent.allDay) {
      newAllDay = false;
    }

    let newEndUTC = addMinutes(newStartUTC, duration > 0 ? duration : 60);

    // Use eventMoveEdit instead of eventDropped
    this.eventMoveEdit.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  onDragEnded(event: CdkDragEnd<DisplayCalendarEvent>) {
    // Optional cleanup if needed
  }

  getEventStyle(event: DisplayCalendarEvent): any {
    const top = event.gridRowStartMinutes! * this.minuteHeight();
    const height = Math.max(this.minuteHeight() * 15, event.durationInMinutes! * this.minuteHeight());

    // Use width and left from event layout calculation
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: event.left || '1%',
      width: event.width || '98%',
      zIndex: event.zIndex || 10,
      borderLeft: '4px solid ' + (event.color?.primary || 'var(--event-default-color)'),
      backgroundColor: event.color?.secondary || 'var(--event-default-bg)',
      color: event.color?.textColor || 'var(--event-default-text)'
    };
  }

  handleTimeSlotClick(day: DayViewModel, hourSegment: HourSegment) {
    const clickedHour = getHours(hourSegment.date);
    const clickedMinute = getMinutes(hourSegment.date);
    const clickedDateTimeUtc = setMinutes(setHours(new Date(day.date), clickedHour), clickedMinute);
    this.slotClicked.emit(this.dateUtil.toIsoString(clickedDateTimeUtc));
  }

  handleEventItemClicked(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    this.eventClicked.emit(event.originalEvent);
  }

  handleEventItemDeleted(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    this.eventDeleted.emit(event.originalEvent);
  }

  // Helper methods for all-day events
  getAllDayEvents(day: DayViewModel): DisplayCalendarEvent[] {
    return day.events.filter(event => event.allDay || event.isMultiDaySpan);
  }

  getRegularEvents(day: DayViewModel): DisplayCalendarEvent[] {
    return day.events.filter(event => !event.allDay && !event.isMultiDaySpan);
  }
}
