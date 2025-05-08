import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayViewModel } from '../../models/calendar-event.model';
import { DateUtilService } from '../../services/date.service';

@Component({
  selector: 'app-day-headers',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="week-header d-flex sticky-top bg-body shadow-sm" role="row">
      <div class="time-gutter-header bg-body-tertiary" role="columnheader" aria-label="Time">
        <span class="visually-hidden">Time</span>
      </div>
      @for (day of days(); track day.date.toISOString(); let dayIndex = $index) {
        <div
          class="week-header-cell flex-fill text-center p-2 border-start user-select-none"
          [id]="'weekDayHeader-' + dayIndex"
          [class.bg-primary-subtle]="day.isToday"
          [class.text-primary]="day.isToday"
          role="columnheader"
          [attr.aria-label]="dateUtil.formatInTimeZone(day.date, timeZone(), 'EEEE, MMM d', locale())"
        >
          <div class="small text-uppercase">{{ dayNames()[dayIndex] }}</div>
          <div class="fw-bold fs-5">{{ dateUtil.formatInTimeZone(day.date, timeZone(), 'd', locale()) }}</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .week-header {
      flex-shrink: 0;
      z-index: 10;
    }

    .time-gutter-header {
      flex: 0 0 60px;
      min-width: 60px;
      height: 64px;
      border-bottom: 1px solid var(--bs-border-color);
      border-right: 1px solid var(--bs-border-color);
      background-color: var(--bs-tertiary-bg);
    }

    .week-header-cell {
      min-width: 150px;
      border-bottom: 1px solid var(--bs-border-color);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayHeadersComponent {
  days = input.required<DayViewModel[]>();
  dayNames = input.required<string[]>();
  locale = input<string>('en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  constructor(public dateUtil: DateUtilService) {}
}
