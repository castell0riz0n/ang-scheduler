import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed
} from '@angular/core';
import {formatInTimeZone, toZonedTime} from 'date-fns-tz';
import { parseISO } from 'date-fns';

@Component({
  selector: 'app-calendar-header',
  standalone: false,
  template: `
    <div class="calendar-header d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center">
        <button class="btn btn-outline-primary me-2"
                (click)="todayClicked.emit()"
                aria-label="Go to today">
          Today
        </button>
        <div class="btn-group me-3">
          <button class="btn btn-outline-secondary"
                  (click)="previousClicked.emit()"
                  aria-label="Previous period">
            <i class="bi bi-chevron-left"></i>
          </button>
          <button class="btn btn-outline-secondary"
                  (click)="nextClicked.emit()"
                  aria-label="Next period">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
        <h2 class="m-0 h5">{{ formattedDate() }}</h2>
      </div>

      <div class="btn-group">
        <button class="btn btn-outline-secondary"
                [class.active]="view$() === 'month'"
                (click)="viewClicked.emit('month')"
                aria-pressed="{{ view$() === 'month' }}"
                aria-label="Month view">
          Month
        </button>
        <button class="btn btn-outline-secondary"
                [class.active]="view$() === 'week'"
                (click)="viewClicked.emit('week')"
                aria-pressed="{{ view$() === 'week' }}"
                aria-label="Week view">
          Week
        </button>
        <button class="btn btn-outline-secondary"
                [class.active]="view$() === 'day'"
                (click)="viewClicked.emit('day')"
                aria-pressed="{{ view$() === 'day' }}"
                aria-label="Day view">
          Day
        </button>
      </div>
    </div>
  `,
  styles: [`
    .calendar-header {
      padding: 10px;
      border-bottom: 1px solid var(--scheduler-border-color);
      background-color: var(--scheduler-background-color);
    }

    @media (max-width: 768px) {
      .calendar-header {
        flex-direction: column;
        gap: 10px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarHeaderComponent {
  @Input() set centerDate(date: string) {
    this._centerDate.set(date);
  }

  @Input() set view(viewType: 'month' | 'week' | 'day') {
    this._view.set(viewType);
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale);
  }

  @Input() set timeZone(timeZone: string) {
    this._timeZone.set(timeZone);
  }

  @Output() previousClicked = new EventEmitter<void>();
  @Output() nextClicked = new EventEmitter<void>();
  @Output() todayClicked = new EventEmitter<void>();
  @Output() viewClicked = new EventEmitter<'month' | 'week' | 'day'>();

  private _centerDate = signal<string>(new Date().toISOString());
  private _view = signal<'month' | 'week' | 'day'>('month');
  private _locale = signal<string>('en-US');
  private _timeZone = signal<string>('UTC');

  readonly view$ = computed(() => this._view());

  readonly formattedDate = computed(() => {
    const date = toZonedTime(parseISO(this._centerDate()), this._timeZone());

    switch (this._view()) {
      case 'day':
        return formatInTimeZone(date, this._timeZone(), 'EEEE, MMMM d, yyyy', { locale: this._locale() });
      case 'week':
        // For week, we could compute start and end of week, but we'll keep it simple
        return formatInTimeZone(date, this._timeZone(), 'MMMM yyyy', { locale: this._locale() });
      case 'month':
      default:
        return formatInTimeZone(date, this._timeZone(), 'MMMM yyyy', { locale: this._locale() });
    }
  });
}
