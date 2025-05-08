import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  ChangeDetectorRef
} from '@angular/core';
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
import {debounceTime, fromEvent} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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
  currentViewDate = input.required<Date>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  hoursRange = input<{ start: number, end: number }>({ start: 0, end: 24 });

  eventDropped = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  slotClicked = output<string>();
  eventClicked = output<CalendarEvent>();

  public dateUtil = inject(DateUtilService);
  private cdr = inject(ChangeDetectorRef);

  public maxEventsPerCell = 3;
  public hourSegmentHeight = signal(60);

  // ViewChild references - updated to match new template
  @ViewChild('headerContent') headerContent?: ElementRef<HTMLElement>;
  @ViewChild('bodyScrollContainer') bodyScrollContainer?: ElementRef<HTMLElement>;

  // Define hour segments
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
    // Initial sync of scroll positions and header width
    this.updateHeaderPosition();
    this.scrollToToday();
  }

  // Calculate the total width needed for the content area
  calculateContentWidth(): string {
    const dayCount = this.days().length;
    return `${60 + (dayCount * 150)}px`; // 60px for time gutter + (150px per day)
  }

  // Synchronize header scroll position with body scroll
  syncHeaderScroll(): void {
    if (!this.headerContent || !this.bodyScrollContainer) return;

    // Update the transform of the header content to match body scroll
    const scrollLeft = this.bodyScrollContainer.nativeElement.scrollLeft;
    this.headerContent.nativeElement.style.transform = `translateX(-${scrollLeft}px)`;
  }

  // Update the header position and ensure width matches body content
  updateHeaderPosition(): void {
    if (!this.headerContent || !this.bodyScrollContainer) return;

    // Ensure header content has the same width as body content
    const bodyWidth = this.calculateContentWidth();
    this.headerContent.nativeElement.style.width = bodyWidth;

    // Initial sync of scroll position
    this.syncHeaderScroll();

    // Trigger change detection to apply styles
    this.cdr.detectChanges();
  }

  scrollToToday() {
    if (!this.bodyScrollContainer) return;

    setTimeout(() => {
      const todayColumn = this.bodyScrollContainer?.nativeElement.querySelector('.today-column');
      if (todayColumn) {
        todayColumn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        this.scrollToCurrentViewDate();
      }
    }, 100);
  }

  scrollToCurrentViewDate() {
    if (!this.bodyScrollContainer) return;

    const currentViewDateStr = this.currentViewDate().toISOString().split('T')[0];
    const targetColumn = this.bodyScrollContainer.nativeElement.querySelector(`[data-date^="${currentViewDateStr}"]`);

    if (targetColumn) {
      targetColumn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // The rest of your component methods stay the same
  handleTimeSlotClick(day: DayViewModel, hourSegment: HourSegment) {
    const clickedHour = getHours(hourSegment.date);
    const clickedMinute = getMinutes(hourSegment.date);
    const clickedDateTimeUtc = setMinutes(setHours(new Date(day.date), clickedHour), clickedMinute);
    this.slotClicked.emit(this.dateUtil.toIsoString(clickedDateTimeUtc));
  }

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

  getEventStyle(event: DisplayCalendarEvent): any {
    if (event.allDay) {
      return {
        top: '5px',
        left: '3%',
        width: '94%',
        height: '24px'
      };
    }

    const dayStart = this.hoursRange().start * 60;
    const eventStart = getHours(event.displayStart) * 60 + getMinutes(event.displayStart);
    const startMinutesFromDayStart = Math.max(0, eventStart - dayStart);

    const top = (startMinutesFromDayStart / 60) * this.hourSegmentHeight();
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

  dayTrackBy(index: number, day: DayViewModel) {
    return day.date.toISOString();
  }

  onEventClick(event: DisplayCalendarEvent, domEvent: MouseEvent) {
    domEvent.stopPropagation();
    this.eventClicked.emit(event.originalEvent);
  }

  onDragEnded(event: CdkDragEnd<DisplayCalendarEvent>) {
    // Implementation stays the same...
  }

  onSlotClick(day: DayViewModel) {
    this.slotClicked.emit(this.dateUtil.toIsoString(startOfDay(day.date)));
  }

  getEventsForCell(day: DayViewModel): DisplayCalendarEvent[] {
    return day.events.slice(0, this.maxEventsPerCell);
  }

  getOverflowCount(day: DayViewModel): number {
    return Math.max(0, day.events.length - this.maxEventsPerCell);
  }
}
