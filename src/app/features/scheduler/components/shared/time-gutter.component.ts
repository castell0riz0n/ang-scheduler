
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TimeSegment {
  date: Date;
  displayLabel: string;
}

@Component({
  selector: 'app-time-gutter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="time-gutter-body sticky-left bg-body-tertiary user-select-none" role="presentation">
      @for (hour of hours(); track hour.date.toISOString()) {
        <div
          class="hour-label text-end pe-2 text-muted small d-flex align-items-center justify-content-end"
          [style.height.px]="hourHeight()"
          role="rowheader"
          [attr.aria-label]="hour.displayLabel"
        >
          {{ hour.displayLabel }}
        </div>
      }
    </div>
  `,
  styles: [`
    .time-gutter-body {
      position: sticky;
      left: 0;
      flex: 0 0 60px;
      min-width: 60px;
      z-index: 20;
      background-color: var(--bs-tertiary-bg);
      border-right: 1px solid var(--bs-border-color);
    }

    .hour-label {
      padding-right: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeGutterComponent {
  hours = input.required<TimeSegment[]>();
  hourHeight = input<number>(80);
}
