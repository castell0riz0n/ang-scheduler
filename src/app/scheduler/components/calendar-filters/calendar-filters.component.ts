import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect
} from '@angular/core';
import {
  FormBuilder,
  FormGroup
} from '@angular/forms';
import {
  startOfDay,
  endOfDay,
  addDays,
  parseISO
} from 'date-fns';

import { CalendarFilter } from '../../../models/calendar-event.model';
import {formatDate} from '@angular/common';

// Import the date picker component lazily
const DatePickerComponent = () => import('../components/date-picker.component')
  .then(m => m.DatePickerComponent);

@Component({
  selector: 'app-calendar-filters',
  standalone: false,
  templateUrl: './calendar-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarFiltersComponent {
  @Input() set filter(filter: CalendarFilter) {
    this._filter.set(filter);
    this.updateForm(filter);
  }

  @Input() set locale(locale: string) {
    this._locale.set(locale);
  }

  @Input() set timeZone(timeZone: string) {
    this._timeZone.set(timeZone);
  }

  @Output() filterChanged = new EventEmitter<CalendarFilter>();

  private _filter = signal<CalendarFilter>({});
  private _locale = signal<string>('en-US');
  private _timeZone = signal<string>('UTC');

  readonly currentFilter = computed(() => this._filter());

  // Event types for the dropdown (would typically come from a service)
  readonly eventTypes = [
    { id: 'meeting', name: 'Meeting' },
    { id: 'appointment', name: 'Appointment' },
    { id: 'deadline', name: 'Deadline' },
    { id: 'vacation', name: 'Vacation' }
  ];

  // Predefined date ranges
  readonly dateRanges = [
    { id: 'all', name: 'All Dates' },
    { id: 'today', name: 'Today' },
    { id: 'tomorrow', name: 'Tomorrow' },
    { id: 'thisWeek', name: 'This Week' },
    { id: 'nextWeek', name: 'Next Week' },
    { id: 'thisMonth', name: 'This Month' },
    { id: 'nextMonth', name: 'Next Month' },
    { id: 'custom', name: 'Custom Range' }
  ];

  // Form for filters
  filterForm: FormGroup;

  // UI state
  showCustomRange = signal(false);
  selectedDateRange = signal('all');

  constructor(private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      keyword: [''],
      types: [[]],
      dateRange: ['all'],
      fromDate: [''],
      toDate: ['']
    });

    // Listen for form changes and emit filter updates
    effect(() => {
      const form = this.filterForm.value;

      if (form) {
        const newFilter: CalendarFilter = {};

        // Add keyword if present
        if (form.keyword) {
          newFilter.keyword = form.keyword;
        }

        // Add types if selected
        if (form.types && form.types.length > 0) {
          newFilter.types = form.types;
        }

        // Handle date range
        if (form.dateRange && form.dateRange !== 'all') {
          if (form.dateRange === 'custom' && form.fromDate && form.toDate) {
            newFilter.from = startOfDay(parseISO(form.fromDate)).toISOString();
            newFilter.to = endOfDay(parseISO(form.toDate)).toISOString();
          } else {
            const dates = this.getDateRangeValues(form.dateRange);
            if (dates) {
              newFilter.from = dates.from;
              newFilter.to = dates.to;
            }
          }
        }

        // Update the filter if different from current
        const currentFilter = this._filter();
        if (JSON.stringify(newFilter) !== JSON.stringify(currentFilter)) {
          this.filterChanged.emit(newFilter);
        }
      }
    });
  }

  // Update form values when filter input changes
  private updateForm(filter: CalendarFilter): void {
    if (!filter) {
      return;
    }

    // Update keyword
    this.filterForm.patchValue({ keyword: filter.keyword || '' });

    // Update types
    this.filterForm.patchValue({ types: filter.types || [] });

    // Update date range
    if (filter.from && filter.to) {
      // Check if it matches a predefined range
      const range = this.detectDateRange(filter.from, filter.to);

      if (range && range !== 'custom') {
        this.filterForm.patchValue({ dateRange: range });
        this.selectedDateRange.set(range);
        this.showCustomRange.set(false);
      } else {
        // It's a custom range
        this.filterForm.patchValue({
          dateRange: 'custom',
          fromDate: filter.from,
          toDate: filter.to
        });
        this.selectedDateRange.set('custom');
        this.showCustomRange.set(true);
      }
    } else {
      // No date range specified
      this.filterForm.patchValue({ dateRange: 'all' });
      this.selectedDateRange.set('all');
      this.showCustomRange.set(false);
    }
  }

  // Handler for date range dropdown changes
  onDateRangeChange(range: string): void {
    this.selectedDateRange.set(range);

    if (range === 'custom') {
      this.showCustomRange.set(true);

      // Initialize custom range to current month if not set
      if (!this.filterForm.value.fromDate || !this.filterForm.value.toDate) {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.filterForm.patchValue({
          fromDate: startOfMonth.toISOString().split('T')[0],
          toDate: endOfMonth.toISOString().split('T')[0]
        });
      }
    } else {
      this.showCustomRange.set(false);

      // Apply the predefined range
      this.filterForm.patchValue({ dateRange: range });

      // Clear custom dates if not using custom
      if (range === 'all') {
        this.filterForm.patchValue({
          fromDate: '',
          toDate: ''
        });
      }
    }
  }

  // Reset all filters
  resetFilters(): void {
    this.filterForm.reset({
      keyword: '',
      types: [],
      dateRange: 'all',
      fromDate: '',
      toDate: ''
    });

    this.selectedDateRange.set('all');
    this.showCustomRange.set(false);

    // Emit empty filter
    this.filterChanged.emit({});
  }

  // Get date values for predefined ranges
  private getDateRangeValues(range: string): { from: string, to: string } | null {
    const today = new Date();
    const now = today.toISOString();

    switch (range) {
      case 'today':
        return {
          from: startOfDay(today).toISOString(),
          to: endOfDay(today).toISOString()
        };
      case 'tomorrow':
        const tomorrow = addDays(today, 1);
        return {
          from: startOfDay(tomorrow).toISOString(),
          to: endOfDay(tomorrow).toISOString()
        };
      case 'thisWeek':
        const thisWeekStart = startOfDay(today);
        const thisWeekEnd = endOfDay(addDays(today, 7 - today.getDay()));
        return {
          from: thisWeekStart.toISOString(),
          to: thisWeekEnd.toISOString()
        };
      case 'nextWeek':
        const nextWeekStart = startOfDay(addDays(today, 7 - today.getDay() + 1));
        const nextWeekEnd = endOfDay(addDays(nextWeekStart, 6));
        return {
          from: nextWeekStart.toISOString(),
          to: nextWeekEnd.toISOString()
        };
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          from: startOfDay(thisMonthStart).toISOString(),
          to: endOfDay(thisMonthEnd).toISOString()
        };
      case 'nextMonth':
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        return {
          from: startOfDay(nextMonthStart).toISOString(),
          to: endOfDay(nextMonthEnd).toISOString()
        };
      case 'all':
      default:
        return null;
    }
  }

  // Detect if filter dates match a predefined range
  private detectDateRange(fromStr: string, toStr: string): string | null {
    const from = parseISO(fromStr);
    const to = parseISO(toStr);

    // Check each predefined range
    Object.keys(this.dateRanges).forEach((rangeId) => {
      if (rangeId !== 'all' && rangeId !== 'custom') {
        const range = this.getDateRangeValues(rangeId);

        if (range) {
          const rangeFrom = parseISO(range.from);
          const rangeTo = parseISO(range.to);

          if (from.getTime() === rangeFrom.getTime() && to.getTime() === rangeTo.getTime()) {
            return rangeId;
          } else {return null}
        } else {return null}
      } else {return null}
    });

    // No match, it's a custom range
    return 'custom';
  }

  protected readonly formatDate = formatDate;
}
