import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToasterComponent } from './shared/toaster.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToasterComponent],
  template: `
    <router-outlet></router-outlet>
    <app-toaster></app-toaster>
  `,
})
export class AppComponent {
  title = 'eand-sales-companion';
}
