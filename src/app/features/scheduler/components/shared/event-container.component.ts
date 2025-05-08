import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DisplayCalendarEvent } from '../../models/calendar-event.model';
import { EventItemComponent } from '../event-item/event-item.component';

@Component({
  selector: 'app-event-container',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    EventItemComponent
  ],
  template: `
    <div class="event-container position-relative">
      @for (event of events(); track event.id) {
        <div
          cdkDrag
          [cdkDragData]="event"
          (cdkDragEnded)="onDragEnded($event)"
          class="event-wrapper position-absolute"
          [style]="getEventStyle()"
          style="pointer-events: auto;"
          role="button"
          tabindex="0"
          [attr.aria-label]="getEventAriaLabel(event)"
          (click)="handleEventClick(event, $event)"
          (dblclick)="handleEventClick(event, $event)"
          (keydown.enter)="handleEventClick(event, $event)"
          (keydown.space)="$event.preventDefault(); handleEventClick(event, $event)"
        >
          <app-event-item
            [event]="event"
            [viewType]="viewType()"
            [currentLocale]="locale()"
            [currentTimeZone]="timeZone()"
            (eventEdited)="handleEventClick(event, $event)"
            (eventDeleted)="handleEventDelete(event, $event)"
          ></app-event-item>
          <div *cdkDragPlaceholder class="drag-placeholder bg-info-subtle"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .event-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    .event-wrapper {
      pointer-events: auto;
      z-index: 10;
      transition: transform 0.2s ease;
    }

    .event-wrapper:hover {
      transform: scale(1.02);
      z-index: 100 !important;
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
export class EventContainerComponent {
  // Inputs
  events = input.required<DisplayCalendarEvent[]>();
  viewType = input<'month' | 'week' | 'day'>('day');
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  getEventStyle = input.required<(event: DisplayCalendarEvent) => any>();

  // Outputs
  eventClick = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  eventDelete = output<{ event: DisplayCalendarEvent, domEvent: MouseEvent }>();
  dragEnded = output<any>();

  // Event handlers
  handleEventClick(event: DisplayCalendarEvent, domEvent: MouseEvent): void {
    domEvent.stopPropagation();
    this.eventClick.emit({ event, domEvent });
  }

  handleEventDelete(event: DisplayCalendarEvent, domEvent: MouseEvent): void {
    domEvent.stopPropagation();
    this.eventDelete.emit({ event, domEvent });
  }

  onDragEnded(event: any): void {
    this.dragEnded.emit(event);
  }

  // ARIA accessibility
  getEventAriaLabel(event: DisplayCalendarEvent): string {
    // Creates a descriptive label for screen readers
    const title = event.title;
    const start = new Date(event.start).toLocaleTimeString(this.locale(), { timeZone: this.timeZone() });
    const end = new Date(event.end).toLocaleTimeString(this.locale(), { timeZone: this.timeZone() });

    return `${title}, from ${start} to ${end}`;
  }
}
