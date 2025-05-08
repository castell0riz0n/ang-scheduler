import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { CdkDragDrop, CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { CalendarEvent, HourViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import { addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { CommonModule } from '@angular/common';
import { EventItemComponent } from '../event-item/event-item.component';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    ScrollingModule,
    EventItemComponent
  ],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent implements AfterViewInit {
  hours = input.required<HourViewModel[]>();
  currentViewDate = input.required<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  dayStartHourInput = input<number>(0);

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  eventMoveEdit = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService);

  @ViewChild('eventsViewport') eventsViewport?: CdkVirtualScrollViewport;
  @ViewChild('timeGutterViewport') timeGutterViewport?: CdkVirtualScrollViewport;

  public hourSegmentHeight = signal(80); // Increased from 60px to 80px
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  allTimedEvents = computed(() => {
    const uniqueEvents = new Map<string, DisplayCalendarEvent>();
    this.hours().forEach(hourVM => {
      hourVM.events.filter(e => !e.allDay).forEach(event => {
        if (!uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    return Array.from(uniqueEvents.values());
  });

  allDayEventsList = computed(() => {
    const uniqueEvents = new Map<string, DisplayCalendarEvent>();
    this.hours().forEach(hourVM => {
      hourVM.events.filter(e => e.allDay || e.isMultiDaySpan).forEach(event => {
        if (!uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    return Array.from(uniqueEvents.values());
  });

  ngAfterViewInit() {
    if (this.eventsViewport && this.timeGutterViewport) {
      this.eventsViewport.elementScrolled().subscribe(() => {
        if (this.eventsViewport && this.timeGutterViewport) {
          this.timeGutterViewport.scrollTo({ top: this.eventsViewport.measureScrollOffset('top') });
        }
      });
    }
  }

  onTimeSlotDrop(
    dropEvent: CdkDragDrop<any, any, DisplayCalendarEvent>,
    hourDroppedOn: HourViewModel
  ) {
    const movedEvent = dropEvent.item.data as DisplayCalendarEvent;
    const originalStartUtc = this.dateUtil.parseISOString(movedEvent.start);
    const originalEndUtc = this.dateUtil.parseISOString(movedEvent.end);
    let duration = differenceInMinutes(originalEndUtc, originalStartUtc);
    if (duration <= 0) duration = 60;

    let newStartUTC = new Date(hourDroppedOn.date);
    let newEndUTC = addMinutes(newStartUTC, duration);

    let newAllDay = movedEvent.allDay;
    if (dropEvent.container.id === 'all-day-drop-list') {
      newAllDay = true;
      newStartUTC = startOfDay(this.currentViewDate());
      if (duration < 24*60) duration = 24*60 - 1;
      newEndUTC = endOfDay(addMinutes(newStartUTC, duration));
    } else {
      newAllDay = false;
    }

    // Emit move edit event instead of standard drop
    this.eventMoveEdit.emit({
      event: { ...movedEvent.originalEvent, allDay: newAllDay },
      newStart: this.dateUtil.toIsoString(newStartUTC),
      newEnd: this.dateUtil.toIsoString(newEndUTC),
    });
  }

  onDragEnded(dragEndEvent: CdkDragEnd<DisplayCalendarEvent>) {
    // Optional cleanup if needed
  }

  getEventStyle(event: DisplayCalendarEvent): any {
    const top = (event.gridRowStartMinutes || 0) * this.minuteHeight();
    const height = (event.durationInMinutes || 60) * this.minuteHeight();

    return {
      top: `${top}px`,
      height: `${Math.max(this.minuteHeight() * 15, height)}px`,
      left: event.left || '5%',
      width: event.width || '90%',
      zIndex: event.zIndex || 10,
      borderLeft: '4px solid ' + (event.color?.primary || 'var(--event-default-color)'),
      backgroundColor: event.color?.secondary || 'var(--event-default-bg)',
      color: event.color?.textColor || 'var(--event-default-text)'
    };
  }

  handleTimeSlotClick(hour: HourViewModel) {
    this.slotClicked.emit(this.dateUtil.toIsoString(hour.date));
  }

  handleEventItemClicked(event: DisplayCalendarEvent, domEvent: MouseEvent) {

    this.eventClicked.emit(event.originalEvent);
  }

  handleEventItemDeleted(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    this.eventDeleted.emit(event.originalEvent);
  }
}
