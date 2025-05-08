import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { SchedulerComponent } from './scheduler.component';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { WeekViewComponent } from './components/week-view/week-view.component';
import { DayViewComponent } from './components/day-view/day-view.component';
import { EventItemComponent } from './components/event-item/event-item.component';
// import { FilterBarComponent } from './components/filter-bar/filter-bar.component'; // If making it separate

// DateUtilService is providedIn: 'root' by default. If not, provide it here.

@NgModule({
  declarations: [
    SchedulerComponent,
    MonthViewComponent,
    WeekViewComponent,
    DayViewComponent,
    EventItemComponent,
    // FilterBarComponent,
  ],
  imports: [
    CommonModule,
    DragDropModule,
    ScrollingModule,
    // FormsModule, ReactiveFormsModule // If using template/reactive forms for filters
  ],
  exports: [
    SchedulerComponent
  ],
  // providers: [DateUtilService] // If not providedIn: 'root'
})
export class SchedulerModule { }
