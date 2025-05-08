import { Component, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { DisplayCalendarEvent } from '../../models/calendar-event.model';
import {DateUtilService} from '../../services/date.service';

@Component({
  selector: 'app-event-item',
  standalone: false,
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
      (keydown.space)="editPreventDefault($event)"
      title="{{ event().title }} ({{ event().displayStart | date:'shortTime' }} - {{ event().displayEnd | date:'shortTime' }})"
    >
      <strong class="event-title">{{ event().title }}</strong>
      @if (!event().allDay && !isMonthView()) {
        <span class="event-time">
         {{ this.dateUtil.format(event().displayStart, 'p', currentLocale(), currentTimeZone()) }} -
         {{ this.dateUtil.format(event().displayEnd, 'p', currentLocale(), currentTimeZone()) }}
        </span>
      }
    </div>
  `,
  styles: [`
    .scheduler-event {
      padding: 2px 5px;
      margin-bottom: 2px;
      border-radius: 4px;
      font-size: 0.8em;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-left: 3px solid var(--event-default-color, #0d6efd); /* Default color */
      background-color: var(--event-default-bg, #e7f1ff);
      color: var(--event-default-text, #000);
    }
    /* Example type-specific theming via CSS vars */
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
    .scheduler-event {
      border-left-color: var(--event-specific-color, var(--event-default-color));
      background-color: var(--event-specific-bg, var(--event-default-bg));
      color: var(--event-specific-text, var(--event-default-text));
    }
    .event-time { display: block; font-size: 0.9em; opacity: 0.8; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventItemComponent {
  event = input.required<DisplayCalendarEvent>();
  viewType = input<'month' | 'week' | 'day'>();

  // These would typically come from a shared service or parent component context
  currentLocale = input<string>('en-US');
  currentTimeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  eventEdited = output<DisplayCalendarEvent>();

  // Exposing dateUtil for template. Can also be injected.
  constructor(public dateUtil: DateUtilService) {}


  eventClasses = computed(() => {
    const e = this.event();
    return {
      [`event-type-${e.type?.toLowerCase()}`]: !!e.type,
      'all-day-event': e.allDay,
      'multiday-span-event': e.isMultiDaySpan
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
    // CSS custom properties will take precedence if defined for the type
    return style;
  });

  isMonthView = computed(() => this.viewType() === 'month');

  edit() {
    this.eventEdited.emit(this.event());
  }

  editPreventDefault(event: KeyboardEvent) {
    event.preventDefault(); // Prevent space from scrolling the page
    this.edit();
  }
}
