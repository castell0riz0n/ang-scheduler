import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayViewModel } from '../models/calendar-event.model';

@Component({
  selector: 'app-day-headers',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="day-headers-row d-flex sticky-top bg-body shadow-sm" role="row">
      <!-- Time gutter header placeholder -->
      <div class="time-gutter-header bg-body-tertiary" role="columnheader" aria-label="Time">
        <span class="visually-hidden">Time</span>
      </div>

      <!-- Day header cells -->
      @for (day of days(); track day.date.toISOString(); let dayIndex = $index) {
        <div
          class="day-header-cell flex-fill text-center p-2 border-start user-select-none"
          [id]="'dayHeader-' + dayIndex"
          [class.bg-primary-subtle]="day.isToday"
          [class.text-primary]="day.isToday"
          role="columnheader"
          [attr.aria-label]="formatDate(day.date)"
        >
          <div class="small text-uppercase">{{ dayNames()[dayIndex] }}</div>
          <div class="fw-bold fs-5">{{ formatDayNumber(day.date) }}</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .day-headers-row {
      display: flex;
      z-index: 10;
    }

    .time-gutter-header {
      flex: 0 0 60px;
      min-width: 60px;
      height: 64px;
      border-bottom: 1px solid var(--bs-border-color);
    }

    .day-header-cell {
      min-width: 150px;
      border-bottom: 1px solid var(--bs-border-color);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DayHeadersComponent {
  days = input.required<DayViewModel[]>();
  dayNames = input.required<string[]>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Date formatting helpers
  formatDate(date: Date): string {
    return date.toLocaleDateString(this.locale(), {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: this.timeZone()
    });
  }

  formatDayNumber(date: Date): string {
    return date.toLocaleDateString(this.locale(), {
      day: 'numeric',
      timeZone: this.timeZone()
    });
  }
}
