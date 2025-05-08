import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'scheduler-demo',
    pathMatch: 'full'
  },
  {
    path: 'scheduler-demo',
    loadComponent: () => import('./features/scheduler/components/scheduler-demo/scheduler-demo.component')
      .then(c => c.SchedulerDemoComponent)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
