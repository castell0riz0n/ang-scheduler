import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DisplayCalendarEvent } from '../models/calendar-event.model';
import { EventItemComponent } from './event-item/event-item.component';

@Component({
  selector: 'app-all-day-events',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    EventItemComponent
  ],
  template: `
    <div
      class="all-day-events-section border-bottom p-2 bg-body-tertiary"
      role="rowgroup"
      cdkDropList
      [cdkDropListData]="{ isAllDayTarget: true }"
      (cdkDropListDropped)="onDropped.emit($event)"
    >
      <div class="all-day-header text-muted small ps-2 user-select-none" role="rowheader">All-day</div>

      @if (events().length === 0) {
        <div class="text-muted small p-2 fst-italic">No all-day events. Drag here to make an event all-day.</div>
      }

      @for (event of events(); track event.id) {
        <div
          cdkDrag
          [cdkDragData]="event"
          (cdkDragEnded)="onDragEnded.emit($event)"
          class="my-1"
          role="gridcell"
          (dblclick)="onEventClick.emit({ event, domEvent: $event })"
          (click)="onEventClick.emit({ event, domEvent: $event })"
          (keydown.enter)="onEventClick.emit({ event, domEvent: $event })"
          (keydown.space)="$event.preventDefault(); onEventClick.emit({ event, domEvent: $event })"
          tabindex="0"
        >
          <app-event-item
            [event]="event"
            [viewType]="viewType()"
            [currentLocale]="locale()"
            [currentTimeZone]="timeZone()"
            (eventEdited)="onEventClick.emit({ event, domEvent: $event })"
            (eventDeleted)="onEventDelete.emit({ event, domEvent: $event })"
          ></app-event-item>
          <div *cdkDragPlaceholder class="drag-placeholder bg-info-subtle"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .all-day-events-section {
      flex-shrink: 0;
      max-height: 150px;
      overflow-y: auto;
    }

    .all-day-header {
      margin-bottom: 4px;
      font-weight: 500;
    }

    .my-1 {
      margin-top: 0.25rem;
      margin-bottom: 0.25rem;
    }

    .drag-placeholder {
      border: 2px dashed var(--bs-primary);
      background: rgba(var(--bs-primary-rgb), 0.1);
      min-height: 30px;
      border-radius: 4px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllDayEventsComponent {
  // Inputs
  events = input.required<DisplayCalendarEvent[]>();
  viewType = input<'month' | 'week' | 'day'>('day');
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Outputs
  onEventClick = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  onEventDelete = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  onDropped = output<any>();
  onDragEnded = output<any>();
}
