import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerView } from '../../services/scheduler-state.service';

@Component({
  selector: 'app-scheduler-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scheduler-toolbar d-flex justify-content-between align-items-center p-2">
      <div class="btn-group" role="group" aria-label="Navigation">
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigatePrev.emit()" [attr.aria-label]="'Previous ' + currentView()">
          <
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigateToday.emit()" aria-label="Go to Today">
          Today
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigateNext.emit()" [attr.aria-label]="'Next ' + currentView()">
          >
        </button>
      </div>

      <h5 class="scheduler-title mb-0 mx-3 text-center flex-grow-1">{{ title() }}</h5>

      <div class="btn-group" role="group" aria-label="View Modes">
        <button type="button" class="btn btn-sm"
                [class.btn-primary]="currentView() === 'month'"
                [class.btn-outline-primary]="currentView() !== 'month'"
                (click)="viewChange.emit('month')">Month</button>
        <button type="button" class="btn btn-sm"
                [class.btn-primary]="currentView() === 'week'"
                [class.btn-outline-primary]="currentView() !== 'week'"
                (click)="viewChange.emit('week')">Week</button>
        <button type="button" class="btn btn-sm"
                [class.btn-primary]="currentView() === 'day'"
                [class.btn-outline-primary]="currentView() !== 'day'"
                (click)="viewChange.emit('day')">Day</button>
      </div>
    </div>
  `,
  styles: [`
    .scheduler-toolbar {
      border-bottom: 1px solid var(--bs-border-color);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulerHeaderComponent {
  // Inputs
  currentView = input.required<SchedulerView>();
  title = input.required<string>();

  // Outputs
  navigatePrev = output<void>();
  navigateNext = output<void>();
  navigateToday = output<void>();
  viewChange = output<SchedulerView>();
}
