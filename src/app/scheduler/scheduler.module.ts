import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchedulerComponent } from './scheduler.component';
import { CalendarFiltersComponent } from './components/calendar-filters/calendar-filters.component';
import { MonthViewComponent } from './views/month-view/month-view.component';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {WeekViewComponent} from './views/week-view/week-view.component';
import { DayViewComponent } from './views/day-view/day-view.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { CalendarHeaderComponent } from './components/calendar-header/calendar-header.component';



@NgModule({
  declarations: [
    SchedulerComponent,
    MonthViewComponent,
    WeekViewComponent,
    DayViewComponent,
    CalendarFiltersComponent,
    CalendarHeaderComponent
  ],
  exports: [
    SchedulerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    ScrollingModule
  ]
})
export class SchedulerModule { }
