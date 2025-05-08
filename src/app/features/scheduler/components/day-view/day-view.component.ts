import {Component, ChangeDetectionStrategy, ViewChild, AfterViewInit, ElementRef, input} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { BaseViewComponent } from '../shared/base-view.component';
import { EventItemComponent } from '../event-item/event-item.component';
import { HourViewModel } from '../../models/calendar-event.model';
import { computed } from '@angular/core';
import {getHours, getMinutes} from 'date-fns';

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
export class DayViewComponent extends BaseViewComponent {

  hours = input.required<HourViewModel[]>();

  // For virtual scrolling
  @ViewChild('eventsViewport') eventsViewport?: CdkVirtualScrollViewport;
  @ViewChild('timeGutterViewport') timeGutterViewport?: CdkVirtualScrollViewport;

  // Computed values specific to day view
  allTimedEvents = computed(() => {
    const uniqueEvents = new Map();
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
    const uniqueEvents = new Map();
    this.hours().forEach(hourVM => {
      hourVM.events.filter(e => e.allDay || e.isMultiDaySpan).forEach(event => {
        if (!uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    return Array.from(uniqueEvents.values());
  });

  // Override abstract method
  protected override initializeView(): void {
    if (this.eventsViewport && this.timeGutterViewport) {
      this.eventsViewport.elementScrolled().subscribe(() => {
        if (this.eventsViewport && this.timeGutterViewport) {
          this.timeGutterViewport.scrollTo({ top: this.eventsViewport.measureScrollOffset('top') });
        }
      });
    }
  }

  // Handle time slot click specific to day view
  handleTimeSlotClickLocal(hour: HourViewModel): void {
    this.slotClicked.emit(this.dateUtil.toIsoString(hour.date));
  }

  // Handle drop in day view
  onTimeSlotDropLocal(dropEvent: any, hour: HourViewModel): void {
    super.onTimeSlotDrop(dropEvent, this.currentViewDate()!, getHours(hour.date), getMinutes(hour.date));
  }
}
