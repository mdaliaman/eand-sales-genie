import { Component } from '@angular/core';

import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toaster',
  standalone: true,
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-soft"
          [class.bg-card]="true"
          [class.border-border]="t.type === 'success'"
          [class.text-foreground]="t.type === 'success'"
          [class.border-destructive]="t.type === 'error'"
          [class.text-destructive]="t.type === 'error'"
        >
          {{ t.message }}
        </div>
      }
    </div>
  `,
})
export class ToasterComponent {
  constructor(readonly toast: ToastService) {}
}
