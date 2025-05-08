import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HourViewModel, DisplayCalendarEvent } from '../../models/calendar-event.model';

@Component({
  selector: 'app-time-grid',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule
  ],
  template: `
    <div class="time-grid d-flex h-100">
      <!-- Time Gutter -->
      <div class="time-gutter-body sticky-left bg-body-tertiary user-select-none">
        @for (hour of hours(); track hour.date.toISOString()) {
          <div
            class="hour-label text-end pe-2 text-muted small d-flex align-items-center justify-content-end"
            [style.height.px]="hourHeight()"
            role="rowheader"
            [attr.aria-label]="hour.label"
          >
            {{ hour.label }}
          </div>
        }
      </div>

      <!-- Main Grid -->
      <div class="time-grid-content flex-grow-1 position-relative">
        @for (hour of hours(); track hour.date.toISOString()) {
          <div
            class="hour-slot border-bottom"
            [style.height.px]="hourHeight()"
            role="button"
            tabindex="0"
            (click)="hourClicked.emit(hour)"
            cdkDropList
            (cdkDropListDropped)="hourDropped.emit({ dropEvent: $event, hour: hour })"
          >
            <!-- Visual time indicators can go here -->
          </div>
        }

        <!-- Events overlay -->
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .time-grid {
      display: flex;
    }

    .time-gutter-body {
      flex: 0 0 60px;
      min-width: 60px;
      z-index: 5;
    }

    .hour-label {
      padding-right: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .hour-slot {
      transition: background-color 0.15s ease;
    }

    .hour-slot:hover {
      background-color: var(--bs-tertiary-bg);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeGridComponent {
  hours = input.required<HourViewModel[]>();
  hourHeight = input<number>(80);

  hourClicked = output<HourViewModel>();
  hourDropped = output<{ dropEvent: any, hour: HourViewModel }>();
}
