import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

export interface HourLabel {
  label: string;
  date: Date;
}

@Component({
  selector: 'app-time-gutter',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule
  ],
  template: `
    <div class="time-gutter-body sticky-left bg-body-tertiary user-select-none" role="presentation">
      <cdk-virtual-scroll-viewport
        [itemSize]="hourHeight()"
        class="h-100"
        [style.height]="viewportHeight()"
      >
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
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styles: [`
    .time-gutter-body {
      flex-basis: 60px;
      flex-shrink: 0;
      overflow: hidden;
      border-right: 1px solid var(--bs-border-color);
      z-index: 5;
    }

    .hour-label {
      padding-right: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    cdk-virtual-scroll-viewport {
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeGutterComponent {
  hours = input.required<HourLabel[]>();
  hourHeight = input<number>(80);
  viewportHeight = input<string>('100%');
}
