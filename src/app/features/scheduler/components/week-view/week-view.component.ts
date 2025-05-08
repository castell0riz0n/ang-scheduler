// week-view.component.ts
import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CalendarEvent, DayViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';
import { addMinutes, differenceInMinutes, getHours, getMinutes, startOfDay, setHours, setMinutes } from 'date-fns';
import { CommonModule } from '@angular/common';
import { EventItemComponent } from '../event-item/event-item.component';
import { AllDayEventsComponent } from '../shared/all-day-events.component';
import { TimeGutterComponent } from '../shared/time-gutter.component';
import { DayHeadersComponent } from '../shared/day-headers.component';

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
export class WeekViewComponent implements AfterViewInit {
  // Preserve the original inputs
  days = input.required<DayViewModel[]>();
  weekDayNames = input.required<string[]>();
  hoursRange = input.required<{ start: number, end: number }>();
  currentViewDate = input.required<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Preserve the original outputs
  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  eventMoveEdit = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService);
  private cdr = inject(ChangeDetectorRef);

  public hourSegmentHeight = signal(80); // Increased from 60px to 80px
  public minuteHeight = computed(() => this.hourSegmentHeight() / 60);

  // ViewChild references for synchronized scrolling
  @ViewChild('headerContent') headerContent?: ElementRef<HTMLElement>;
  @ViewChild('weekBodyScrollContainer') weekBodyScrollContainer?: ElementRef<HTMLElement>;

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

  ngAfterViewInit() {
    // Initialize the header position and width
    this.updateHeaderPosition();

    // Scroll to business hours (e.g., 9 AM)
    this.scrollToBusinessHours();
  }

  // Calculate the total width needed for the content area
  calculateContentWidth(): string {
    const dayCount = this.days().length;
    return `${60 + (dayCount * 150)}px`; // 60px for time gutter + (150px per day)
  }

  // Synchronize header scroll position with body scroll
  syncHeaderScroll(): void {
    if (!this.headerContent || !this.weekBodyScrollContainer) return;

    // Update the transform of the header content to match body scroll
    const scrollLeft = this.weekBodyScrollContainer.nativeElement.scrollLeft;
    this.headerContent.nativeElement.style.transform = `translateX(-${scrollLeft}px)`;
  }

  // Update the header position and ensure width matches body content
  updateHeaderPosition(): void {
    if (!this.headerContent || !this.weekBodyScrollContainer) return;

    // Ensure header content has the same width as body content
    const bodyWidth = this.calculateContentWidth();
    this.headerContent.nativeElement.style.width = bodyWidth;

    // Initial sync of scroll position
    this.syncHeaderScroll();

    // Trigger change detection to apply styles
    this.cdr.detectChanges();
  }

  // Scroll to normal business hours (e.g., 9 AM)
  scrollToBusinessHours(): void {
    setTimeout(() => {
      if (this.weekBodyScrollContainer) {
        const businessHourStart = 9; // 9 AM
        const hourHeight = this.hourSegmentHeight();
        const scrollTop = businessHourStart * hourHeight;

        this.weekBodyScrollContainer.nativeElement.scrollTop = scrollTop;
      }
    }, 100);
  }

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
