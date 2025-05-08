import { Component, input, output, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  CdkDragDrop,
  CdkDragStart,
  CdkDragEnd,
  transferArrayItem,
  moveItemInArray,
  DragDropModule
} from '@angular/cdk/drag-drop';
import { CalendarEvent, DisplayCalendarEvent, DayViewModel } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import {startOfDay, addMinutes, differenceInMinutes, isBefore, addDays, endOfDay, differenceInDays} from 'date-fns';
import {CommonModule} from '@angular/common';
import {EventItemComponent} from '../event-item/event-item.component';

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
export class MonthViewComponent {
  days = input.required<DayViewModel[]>();
  weekDayNames = input.required<string[]>();
  currentViewDate = input.required<Date>(); // The date around which this view is centered
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>(); // Emits ISO string of the clicked day
  eventClicked = output<CalendarEvent>(); // For editing or other actions

  private dateUtil = inject(DateUtilService);
  public maxEventsPerCell = 3; // Configurable: how many events to show before "+N more"

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
    domEvent.stopPropagation(); // Prevent slotClick
    this.eventClicked.emit(event.originalEvent);
  }

  onDragStarted(event: CdkDragStart, calEvent: DisplayCalendarEvent) {
    // console.log('Drag started for:', calEvent.title);
    // Potentially add a class to the body or scheduler to indicate dragging
  }

  onDragEnded(event: CdkDragEnd, calEvent: DisplayCalendarEvent) {
    // console.log('Drag ended for:', calEvent.title);
  }

  onEventDrop(dropEvent: CdkDragDrop<DisplayCalendarEvent[], any, DisplayCalendarEvent>) {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent; // The event being dragged
    const targetDayData = dropEvent.container.data as any; // DayViewModel in this case (custom data set on cdkDropList)

    if (!targetDayData || !targetDayData.date) {
      console.error('Drop target has no date data!', targetDayData);
      return;
    }
    const targetDate = targetDayData.date as Date; // Date of the target cell

    // Calculate new start and end
    // For month view, usually dragging preserves time of day unless it's an allDay event
    const originalEventStart = this.dateUtil.parseISOString(movedEvent.start);
    const originalEventEnd = this.dateUtil.parseISOString(movedEvent.end);

    const hours = originalEventStart.getUTCHours();
    const minutes = originalEventStart.getUTCMinutes();
    const duration = differenceInMinutes(originalEventEnd, originalEventStart);

    let newStart = new Date(targetDate); // TargetDate is start of day in UTC from DayViewModel
    newStart.setUTCHours(hours, minutes, 0, 0);
    let newEnd = addMinutes(newStart, duration);

    // If it was an all-day event, keep it all-day
    if (movedEvent.allDay) {
      newStart = startOfDay(newStart);
      newEnd = startOfDay(addDays(newStart, Math.max(0, differenceInDays(originalEventEnd, originalEventStart)) || 0)); // Keep duration for multi-day all-day
      if (isBefore(newEnd, newStart) || newEnd.getTime() === newStart.getTime()) { // Ensure end is after start for all-day
        newEnd = addDays(newStart,1);
        newEnd = endOfDay(addDays(newStart,0)); // More precise, end of the day
      } else {
        newEnd = endOfDay(newEnd);
      }
    }


    console.log(`Event ${movedEvent.title} dropped on ${this.dateUtil.toIsoString(targetDate)}. New start: ${this.dateUtil.toIsoString(newStart)}`);
    this.eventDropped.emit({
      event: movedEvent.originalEvent,
      newStart: this.dateUtil.toIsoString(newStart),
      newEnd: this.dateUtil.toIsoString(newEnd),
    });
  }

  // Helper to slice events for cell display and show "+N more"
  getEventsForCell(day: DayViewModel): DisplayCalendarEvent[] {
    return day.events.slice(0, this.maxEventsPerCell);
  }

  getOverflowCount(day: DayViewModel): number {
    return Math.max(0, day.events.length - this.maxEventsPerCell);
  }
}
