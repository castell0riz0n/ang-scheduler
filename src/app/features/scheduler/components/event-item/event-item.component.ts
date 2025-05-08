// event-item.component.ts (updated)
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
import {DisplayCalendarEvent} from '../../models/calendar-event.model';
import {DateUtilService} from '../../services/date.service';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-event-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="scheduler-event"
      [ngClass]="eventClasses()"
      [style.background-color]="eventStyle().backgroundColor"
      [style.color]="eventStyle().textColor"
      [style.border-left-color]="eventStyle().borderColor"
      [attr.tabindex]="0"
      (dblclick)="edit()"
      (keydown.enter)="edit()"
      (keydown.space)="editPreventDefault(($event))"
      title="{{ event().title }} ({{ dateUtil.format(event().displayStart, 'p', currentLocale(), currentTimeZone()) }} - {{ dateUtil.format(event().displayEnd, 'p', currentLocale(), currentTimeZone()) }})"
    >
      <!-- Event Header -->
      <div class="event-content">
        <strong class="event-title">{{ event().title }}</strong>
        @if (!event().allDay && !isMonthView()) {
          <span class="event-time">
            {{ dateUtil.format(event().displayStart, 'p', currentLocale(), currentTimeZone()) }} -
            {{ dateUtil.format(event().displayEnd, 'p', currentLocale(), currentTimeZone()) }}
          </span>
        }
      </div>

      <!-- Action icons at the bottom -->
      @if (showActions()) {
        <div class="event-actions">
          <button type="button" class="action-btn edit-btn" (click)="edit(); $event.stopPropagation()">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="action-btn delete-btn" (click)="delete(); $event.stopPropagation()">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .scheduler-event {
      padding: 4px 5px;
      margin-bottom: 2px;
      border-radius: 4px;
      font-size: 0.8em;
      cursor: pointer;
      border-left: 3px solid var(--event-default-color, #0d6efd);
      background-color: var(--event-default-bg, #e7f1ff);
      color: var(--event-default-text, #000);
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 24px;
      transition: all 0.2s ease;
      height: 100%;
      overflow: hidden;
      width: 100%;
    }

    .scheduler-event:hover {
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      transform: scale(1.02);
      z-index: 100;
    }

    .event-content {
      flex-grow: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-title {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-time {
      display: block;
      font-size: 0.9em;
      opacity: 0.8;
      white-space: nowrap;
    }

    .event-actions {
      display: none;
      justify-content: flex-end;
      gap: 3px;
      margin-top: 4px;
      border-top: 1px solid rgba(0,0,0,0.1);
      padding-top: 3px;
    }

    .scheduler-event:hover .event-actions {
      display: flex;
    }

    .action-btn {
      border: none;
      background: transparent;
      font-size: 0.85em;
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
    }

    .action-btn:hover {
      opacity: 1;
      background-color: rgba(0,0,0,0.1);
    }

    .delete-btn:hover {
      color: var(--bs-danger);
    }

    /* Type-specific styling */
    .event-type-meeting {
      --event-specific-color: var(--bs-success);
      --event-specific-bg: var(--bs-success-bg-subtle);
      --event-specific-text: var(--bs-success-text-emphasis);
    }

    .event-type-task {
      --event-specific-color: var(--bs-warning);
      --event-specific-bg: var(--bs-warning-bg-subtle);
      --event-specific-text: var(--bs-warning-text-emphasis);
    }

    /* Multi-day indicators - Now implemented with pseudo-elements in the container */
    .continues-before::before {
      content: "◀";
      position: absolute;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8em;
      opacity: 0.7;
    }

    .continues-after::after {
      content: "▶";
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8em;
      opacity: 0.7;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventItemComponent {
  event = input.required<DisplayCalendarEvent>();
  viewType = input<'month' | 'week' | 'day'>();
  showActions = input<boolean>(true); // Control visibility of action buttons

  // Locale and timezone
  currentLocale = input<string>('en-US');
  currentTimeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Output events
  eventEdited = output<DisplayCalendarEvent>();
  eventDeleted = output<DisplayCalendarEvent>();

  constructor(public dateUtil: DateUtilService) {}

  eventClasses = computed(() => {
    const e = this.event();
    return {
      [`event-type-${e.type?.toLowerCase()}`]: !!e.type,
      'all-day-event': e.allDay,
      'multiday-span-event': e.isMultiDaySpan,
      'continues-before': e.continuesBefore,
      'continues-after': e.continuesAfter
    };
  });

  eventStyle = computed(() => {
    const e = this.event();
    const style: { backgroundColor?: string, textColor?: string, borderColor?: string } = {};
    if (e.color) {
      style.backgroundColor = e.color.secondary || e.color.primary; // Use secondary for background if available
      style.textColor = 'white'; // Assuming primary is dark, or add logic
      style.borderColor = e.color.primary;
    }
    return style;
  });

  isMonthView = computed(() => this.viewType() === 'month');

  edit() {
    this.eventEdited.emit(this.event());
  }

  delete() {
    this.eventDeleted.emit(this.event());
  }

  editPreventDefault(event: KeyboardEvent) {
    event.preventDefault(); // Prevent space from scrolling the page
    this.edit();
  }
}
