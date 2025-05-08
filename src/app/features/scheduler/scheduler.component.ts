// Refactored SchedulerComponent - Main container component
import {Component, ChangeDetectionStrategy, input, output, inject, model, signal, effect} from '@angular/core';
import { CalendarEvent } from './models/calendar-event.model';
import { SchedulerView, SchedulerFilter, SchedulerStateService } from './services/scheduler-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { WeekViewComponent } from './components/week-view/week-view.component';
import { DayViewComponent } from './components/day-view/day-view.component';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MonthViewComponent,
    WeekViewComponent,
    DayViewComponent
  ],
  template: `
    <div class="scheduler-container card">
      <!-- Header Toolbar -->
      <div class="card-header scheduler-toolbar d-flex justify-content-between align-items-center p-2">
        <div class="btn-group" role="group" aria-label="Navigation">
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigate('prev')" [attr.aria-label]="'Previous ' + currentView()">
            <
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigate('today')" aria-label="Go to Today">
            Today
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="navigate('next')" [attr.aria-label]="'Next ' + currentView()">
            >
          </button>
        </div>

        <h5 class="scheduler-title mb-0 mx-3 text-center flex-grow-1">{{ state.viewTitle() }}</h5>

        <div class="btn-group" role="group" aria-label="View Modes">
          <button type="button" class="btn btn-sm"
                  [class.btn-primary]="currentView() === 'month'"
                  [class.btn-outline-primary]="currentView() !== 'month'"
                  (click)="setView('month')">Month</button>
          <button type="button" class="btn btn-sm"
                  [class.btn-primary]="currentView() === 'week'"
                  [class.btn-outline-primary]="currentView() !== 'week'"
                  (click)="setView('week')">Week</button>
          <button type="button" class="btn btn-sm"
                  [class.btn-primary]="currentView() === 'day'"
                  [class.btn-outline-primary]="currentView() !== 'day'"
                  (click)="setView('day')">Day</button>
        </div>
      </div>

      <!-- Optional Filter Bar -->
      @if (showFilters()) {
        <div class="scheduler-filters p-2 border-bottom d-flex gap-2 align-items-center">
          <input type="text" class="form-control form-control-sm" placeholder="Search events..."
                 (input)="updateFilterKeyword($event)">
          <button class="btn btn-sm btn-outline-secondary" (click)="openDateRangePicker()">Date Range</button>
          <!-- Multi-select for types -->
        </div>
      }

      <!-- Dynamic View Container -->
      <div class="card-body scheduler-view-port p-0" [attr.aria-live]="'polite'" [attr.aria-atomic]="'true'">
        @switch (currentView()) {
          @case ('month') {
            <app-month-view
              [days]="state.monthViewDays()"
              [weekDayNames]="state.weekDayNames()"
              [currentViewDate]="state.parsedCenterDate()"
              [hoursRange]="{ start: dayStartHour(), end: dayEndHour() }"
              [locale]="locale()"
              [timeZone]="timeZone()"
              (eventDropped)="handleEventDropped($event)"
              (eventMoveEdit)="handleEventMoveEdit($event)"
              (slotClicked)="handleSlotClicked($event)"
              (eventClicked)="handleEventClicked($event)"
              (eventDeleted)="handleEventDeleted($event)"
            ></app-month-view>
          }
          @case ('week') {
            <app-week-view
              [days]="state.weekViewDays()"
              [weekDayNames]="state.weekDayNames()"
              [currentViewDate]="state.parsedCenterDate()"
              [hoursRange]="{ start: dayStartHour(), end: dayEndHour() }"
              [locale]="locale()"
              [timeZone]="timeZone()"
              (eventDropped)="handleEventDropped($event)"
              (eventMoveEdit)="handleEventMoveEdit($event)"
              (slotClicked)="handleSlotClicked($event)"
              (eventClicked)="handleEventClicked($event)"
              (eventDeleted)="handleEventDeleted($event)"
            ></app-week-view>
          }
          @case ('day') {
            <app-day-view
              [events]="state.displayEvents()"
              [hours]="state.dayViewHours()"
              [currentViewDate]="state.parsedCenterDate()"
              [locale]="locale()"
              [timeZone]="timeZone()"
              (eventDropped)="handleEventDropped($event)"
              (eventMoveEdit)="handleEventMoveEdit($event)"
              (slotClicked)="handleSlotClicked($event)"
              (eventClicked)="handleEventClicked($event)"
              (eventDeleted)="handleEventDeleted($event)"
            ></app-day-view>
          }
          @default {
            <p class="p-3">Unknown view type: {{ currentView() }}</p>
          }
        }
      </div>
      <div class="visually-hidden" aria-live="polite" aria-atomic="true">{{ getAriaLiveMessage() }}</div>
    </div>
  `,
  styleUrls: ['./scheduler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulerComponent {
  // --- Simplified Inputs ---
  events = input.required<CalendarEvent[]>();
  initialView = input<SchedulerView>('month');
  initialCenterDate = input<string>(new Date().toISOString());
  filter = input<SchedulerFilter>({});
  locale = input<string>(navigator.language || 'en-US');
  timeZone = input<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  dayStartHour = input<number>(0);
  dayEndHour = input<number>(24);
  weekStartsOn = input<0 | 1 | 2 | 3 | 4 | 5 | 6>(1);
  eventTypeColors = input<Record<string, { background: string; border?: string; text?: string }>>({});
  showFilters = input<boolean>(false);

  // --- Outputs ---
  eventMoved = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();
  viewChanged = output<{ view: SchedulerView, centerDateISO: string, viewStartISO: string, viewEndISO: string }>();
  slotClicked = output<{ date: string, timeZone: string }>();
  eventEdited = output<CalendarEvent>();
  eventDeleted = output<CalendarEvent>();
  eventMoveRequested = output<{ event: CalendarEvent, newStart: string, newEnd: string }>();

  // --- State Management ---
  readonly state = inject(SchedulerStateService);

  // State that the parent can bind to
  currentView = model<SchedulerView>(this.initialView());
  pendingEventSlot = signal<{ date: string, timeZone: string } | null>(null);

  constructor() {
    // Initialize state
    this.state.setEvents(this.events());
    this.state.setView(this.initialView());
    this.state.setDate(this.initialCenterDate());
    this.state.setFilter(this.filter());
    this.state.setLocale(this.locale());
    this.state.setTimeZone(this.timeZone());

    // Set up watchers for input changes
    this.setupInputWatchers();

    // Emit view changed event when view or date changes
    this.setupViewChangedEmitter();
  }

  private setupInputWatchers(): void {
    // Set up watchers for input changes
    effect(() => {
      this.state.setEvents(this.events());
    });

    effect(() => {
      this.state.setFilter(this.filter());
    });

    effect(() => {
      this.state.setLocale(this.locale());
    });

    effect(() => {
      this.state.setTimeZone(this.timeZone());
    });
  }

  private setupViewChangedEmitter(): void {
    effect(() => {
      const view = this.currentView();
      const { start, end } = this.state.viewDateRange();

      this.viewChanged.emit({
        view,
        centerDateISO: this.state.parsedCenterDate().toISOString(),
        viewStartISO: start.toISOString(),
        viewEndISO: end.toISOString()
      });
    });
  }

  // --- Public API Methods ---
  setView(view: SchedulerView): void {
    this.currentView.set(view);
    this.state.setView(view);
  }

  navigate(direction: 'prev' | 'next' | 'today'): void {
    this.state.navigate(direction);
  }

  updateFilterKeyword(event: Event): void {
    const input = event.target as HTMLInputElement;

    const currentFilter = this.filter();
    this.state.setFilter({
      ...currentFilter,
      keyword: input.value
    });
  }

  // --- Event Handlers ---
  handleEventDropped(payload: { event: CalendarEvent, newStart: string, newEnd: string }): void {
    this.eventMoved.emit(payload);
  }

  handleSlotClicked(dateTimeIso: string): void {
    this.pendingEventSlot.set({
      date: dateTimeIso,
      timeZone: this.timeZone()
    });

    this.slotClicked.emit({
      date: dateTimeIso,
      timeZone: this.timeZone()
    });
  }

  handleEventClicked(event: CalendarEvent): void {
    this.eventEdited.emit(event);
  }

  handleEventDeleted(event: CalendarEvent): void {
    this.eventDeleted.emit(event);
  }

  handleEventMoveEdit(moveData: { event: CalendarEvent, newStart: string, newEnd: string }): void {
    this.eventMoveRequested.emit(moveData);
  }

  // --- Utility Methods ---
  getAriaLiveMessage(): string {
    return `Calendar view changed to ${this.currentView()}. Displaying dates around ${this.state.viewTitle()}.`;
  }

  // Placeholder for date range picker
  openDateRangePicker(): void {
    alert('Date range picker functionality to be implemented.');
  }
}
