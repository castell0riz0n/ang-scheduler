import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerComponent } from '../../scheduler.component';
import { DemoEventService } from '../../services/demo-event.service';
import { CalendarEvent } from '../../models/calendar-event.model';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { startOfDay, addHours } from 'date-fns';

@Component({
  selector: 'app-scheduler-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SchedulerComponent
  ],
  template: `
    <div class="container-fluid">
      <div class="row mb-3">
        <div class="col-12">
          <h2 class="mb-3">Angular Scheduler Demo</h2>
          <p class="text-muted">
            Features: Multiple views, drag & drop events, timezone support, recurring events
          </p>
        </div>
      </div>

      <div class="row">
        <div class="col-md-9">
          <app-scheduler
            [events]="events"
            [initialView]="'week'"
            [timeZone]="selectedTimeZone"
            [locale]="selectedLocale"
            [dayStartHour]="6"
            [dayEndHour]="20"
            (eventMoved)="onEventMoved($event)"
            (eventEdited)="onEventEdited($event)"
            (slotClicked)="onSlotClicked($event)"
          ></app-scheduler>
        </div>

        <div class="col-md-3">
          <div class="card mb-3">
            <div class="card-header">
              <h5 class="mb-0">Settings</h5>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="timezone" class="form-label">Timezone</label>
                <select
                  id="timezone"
                  class="form-select"
                  [(ngModel)]="selectedTimeZone">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>

              <div class="mb-3">
                <label for="locale" class="form-label">Locale</label>
                <select
                  id="locale"
                  class="form-select"
                  [(ngModel)]="selectedLocale">
                  <option value="en-US">English (US)</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="es-ES">Spanish</option>
                  <option value="ja-JP">Japanese</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header">
              <h5 class="mb-0">Event Types</h5>
            </div>
            <div class="card-body">
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="meeting-check" checked>
                <label class="form-check-label" for="meeting-check">
                  <span class="badge bg-primary">Meetings</span>
                </label>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="task-check" checked>
                <label class="form-check-label" for="task-check">
                  <span class="badge bg-warning">Tasks</span>
                </label>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="out-check" checked>
                <label class="form-check-label" for="out-check">
                  <span class="badge bg-info">Out of Office</span>
                </label>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="holiday-check" checked>
                <label class="form-check-label" for="holiday-check">
                  <span class="badge bg-success">Holidays</span>
                </label>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="reminder-check" checked>
                <label class="form-check-label" for="reminder-check">
                  <span class="badge bg-secondary">Reminders</span>
                </label>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Add New Event</h5>
            </div>
            <div class="card-body">
              <button class="btn btn-primary w-100" (click)="addQuickEvent()">
                Quick Add Event
              </button>
            </div>
          </div>
        </div>
      </div>

      @if (selectedEvent || currentSlot) {
        <div class="modal d-block" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  {{ selectedEvent ? 'Edit Event' : 'Create New Event' }}
                </h5>
                <button type="button" class="btn-close" (click)="closeModal()"></button>
              </div>
              <div class="modal-body">
                @if (editMode && eventForm) {
                  <form [formGroup]="eventForm">
                    <div class="mb-3">
                      <label for="title" class="form-label">Title</label>
                      <input type="text" class="form-control" id="title" formControlName="title">
                    </div>
                    <div class="mb-3">
                      <label for="type" class="form-label">Type</label>
                      <select class="form-select" id="type" formControlName="type">
                        <option value="meeting">Meeting</option>
                        <option value="task">Task</option>
                        <option value="out-of-office">Out of Office</option>
                        <option value="holiday">Holiday</option>
                        <option value="reminder">Reminder</option>
                      </select>
                    </div>
                    <div class="mb-3">
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="allDay" formControlName="allDay">
                        <label class="form-check-label" for="allDay">All Day</label>
                      </div>
                    </div>
                    <div class="row mb-3">
                      <div class="col-6">
                        <label for="startDate" class="form-label">Start Date</label>
                        <input type="date" class="form-control" id="startDate" formControlName="startDate">
                      </div>
                      <div class="col-6">
                        <label for="startTime" class="form-label">Start Time</label>
                        <input type="time" class="form-control" id="startTime" formControlName="startTime">
                      </div>
                    </div>
                    <div class="row mb-3">
                      <div class="col-6">
                        <label for="endDate" class="form-label">End Date</label>
                        <input type="date" class="form-control" id="endDate" formControlName="endDate">
                      </div>
                      <div class="col-6">
                        <label for="endTime" class="form-label">End Time</label>
                        <input type="time" class="form-control" id="endTime" formControlName="endTime">
                      </div>
                    </div>
                    <div class="mb-3">
                      <label for="description" class="form-label">Description</label>
                      <textarea class="form-control" id="description" formControlName="description" rows="3"></textarea>
                    </div>
                  </form>
                } @else {
                  <div>
                    <h4>{{ selectedEvent?.title }}</h4>
                    <p class="text-muted">
                      <span class="badge" [ngClass]="getTypeClass(selectedEvent?.type)">{{ selectedEvent?.type }}</span>
                    </p>
                    <p>
                      <strong>Start:</strong> {{ formatDate(selectedEvent?.start) }}<br>
                      <strong>End:</strong> {{ formatDate(selectedEvent?.end) }}
                    </p>
                    @if (selectedEvent?.data?.description) {
                      <h5>Description</h5>
                      <p>{{ selectedEvent?.data.description }}</p>
                    }
                  </div>
                }
              </div>
              <div class="modal-footer">
                @if (selectedEvent) {
                  <!-- Buttons for editing existing event -->
                  <button type="button" class="btn btn-danger me-auto" (click)="deleteEvent()">Delete</button>
                  <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                  <button type="button" class="btn btn-primary" (click)="saveEvent()">Save</button>
                } @else {
                  <!-- Buttons for creating new event -->
                  <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                  <button type="button" class="btn btn-primary" (click)="saveEvent()">Create Event</button>
                }
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop fade show"></div>
      }
    </div>
  `,
  styleUrls: ['./scheduler-demo.component.scss']
})
export class SchedulerDemoComponent implements OnInit {
  events: CalendarEvent[] = [];
  selectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  selectedLocale = 'en-US';
  currentSlot: { date: string, timeZone: string } | null = null;

  selectedEvent: CalendarEvent | null = null;
  editMode = false;
  eventForm: FormGroup | null = null;

  constructor(
    private demoEventService: DemoEventService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.events = this.demoEventService.events;
    this.demoEventService.events$.subscribe(events => {
      this.events = events;
    });
  }

  onEventMoved(eventData: { event: CalendarEvent, newStart: string, newEnd: string }): void {
    this.demoEventService.moveEvent(
      eventData.event.id,
      eventData.newStart,
      eventData.newEnd,
      eventData.event.allDay
    );
  }

  onEventEdited(event: CalendarEvent): void {
    this.selectedEvent = event;
    this.editMode = false;
  }

  onSlotClicked(slotData: { date: string, timeZone: string }): void {
    // Just store the slot information
    this.currentSlot = slotData;

    // Show the event creation modal
    this.selectedEvent = null;  // Clear any existing selected event
    this.createNewEventForm();  // Create a form for a new event
    this.editMode = true;       // Enable edit mode for the form
  }

  createNewEventForm(): void {
    if (!this.currentSlot) return;

    const startTime = new Date(this.currentSlot.date);
    const endTime = addHours(startTime, 1);

    this.eventForm = this.fb.group({
      title: ['New Event', Validators.required],
      type: ['meeting', Validators.required],
      allDay: [false],
      startDate: [this.formatDateForInput(startTime), Validators.required],
      startTime: [this.formatTimeForInput(startTime), Validators.required],
      endDate: [this.formatDateForInput(endTime), Validators.required],
      endTime: [this.formatTimeForInput(endTime), Validators.required],
      description: ['']
    });
  }

  addQuickEvent(): void {
    const now = new Date();
    const end = addHours(now, 1);

    const quickEvent: Omit<CalendarEvent, 'id'> = {
      title: 'Quick Event',
      type: 'meeting',
      start: now.toISOString(),
      end: end.toISOString(),
      data: { description: 'This is a quick add event' }
    };

    this.demoEventService.addEvent(quickEvent);
  }

  enableEditMode(): void {
    this.editMode = true;

    if (this.selectedEvent) {
      const start = new Date(this.selectedEvent.start);
      const end = new Date(this.selectedEvent.end);

      this.eventForm = this.fb.group({
        title: [this.selectedEvent.title, Validators.required],
        type: [this.selectedEvent.type, Validators.required],
        allDay: [this.selectedEvent.allDay || false],
        startDate: [this.formatDateForInput(start), Validators.required],
        startTime: [this.formatTimeForInput(start), Validators.required],
        endDate: [this.formatDateForInput(end), Validators.required],
        endTime: [this.formatTimeForInput(end), Validators.required],
        description: [this.selectedEvent.data?.description || '']
      });
    }
  }

  saveEvent(): void {
    if (!this.eventForm || (!this.selectedEvent && !this.currentSlot)) return;

    if (this.eventForm.valid) {
      const formValues = this.eventForm.value;

      const startDate = new Date(formValues.startDate);
      const startTime = formValues.startTime.split(':');
      startDate.setHours(parseInt(startTime[0], 10), parseInt(startTime[1], 10));

      const endDate = new Date(formValues.endDate);
      const endTime = formValues.endTime.split(':');
      endDate.setHours(parseInt(endTime[0], 10), parseInt(endTime[1], 10));

      if (this.selectedEvent) {
        // Update existing event
        const updatedEvent: CalendarEvent = {
          ...this.selectedEvent,
          title: formValues.title,
          type: formValues.type,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          allDay: formValues.allDay,
          data: {
            ...this.selectedEvent.data,
            description: formValues.description
          }
        };

        this.demoEventService.updateEvent(updatedEvent);
      } else {
        // Create new event
        const newEvent: Omit<CalendarEvent, 'id'> = {
          title: formValues.title,
          type: formValues.type,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          allDay: formValues.allDay,
          data: { description: formValues.description }
        };

        this.demoEventService.addEvent(newEvent);
      }

      this.closeModal();
    }
  }


  deleteEvent(): void {
    if (this.selectedEvent) {
      this.demoEventService.deleteEvent(this.selectedEvent.id);
      this.closeModal();
    }
  }
  closeModal(): void {
    this.selectedEvent = null;
    this.currentSlot = null;
    this.editMode = false;
    this.eventForm = null;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString(this.selectedLocale, {
      timeZone: this.selectedTimeZone,
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatTimeForInput(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'meeting': return 'bg-primary';
      case 'task': return 'bg-warning';
      case 'out-of-office': return 'bg-info';
      case 'holiday': return 'bg-success';
      case 'reminder': return 'bg-secondary';
      case 'client': return 'bg-danger';
      default: return 'bg-primary';
    }
  }
}
