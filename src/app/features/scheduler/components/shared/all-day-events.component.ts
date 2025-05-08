// all-day-events.component.ts (updated)
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DisplayCalendarEvent } from '../../models/calendar-event.model';
import { EventItemComponent } from '../event-item/event-item.component';

@Component({
  selector: 'app-all-day-events',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    EventItemComponent
  ],
  template: `
    <div class="all-day-events-container border-bottom">
      @for(event of events(); track event.id) {
        <div
          cdkDrag
          [cdkDragData]="event"
          (cdkDragEnded)="onDragEnded.emit($event)"
          class="all-day-event-wrapper"
          [class.multi-day-event]="event.isMultiDaySpan"
          [class.continues-before]="event.continuesBefore"
          [class.continues-after]="event.continuesAfter"
          role="button"
          tabindex="0"
          [attr.aria-label]="event.title + ' (All day)'"
          (dblclick)="onEventClick.emit({ event: event, domEvent: $event })"
          (click)="onEventClick.emit({ event: event, domEvent: $event })"
          [style.background-color]="event.color?.secondary || 'var(--event-default-bg)'"
        >
          <app-event-item
            [event]="event"
            [viewType]="viewType()"
            [currentLocale]="locale()"
            [currentTimeZone]="timeZone()"
            (eventEdited)="onEventClick.emit({ event: event, domEvent: $event })"
            (eventDeleted)="onEventDelete.emit({ event: event, domEvent: $event })"
          ></app-event-item>
          <div *cdkDragPlaceholder class="drag-placeholder bg-info-subtle"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .all-day-events-container {
      padding: 2px;
      min-height: 80px; /* Match the hour slot height */
      max-height: 160px; /* Increased max height */
      overflow-y: auto;
      background-color: rgba(var(--bs-tertiary-bg-rgb), 0.3);
      flex-shrink: 0;
    }

    .all-day-event-wrapper {
      margin-bottom: 2px;
      border-radius: 4px;
    }

    .multi-day-event {
      position: relative;
      margin: 4px 0;
      height: 30px;
      overflow: hidden;
      border-radius: 4px;
    }

    .continues-before {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: 0;
      border-left: none;
      padding-left: 0;
    }

    .continues-after {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      margin-right: 0;
      border-right: none;
      padding-right: 0;
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
  events = input.required<DisplayCalendarEvent[]>();
  viewType = input<'month' | 'week' | 'day'>('week');
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  onEventClick = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  onEventDelete = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  onDragEnded = output<any>();
}
