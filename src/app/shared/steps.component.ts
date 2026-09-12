import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-steps',
  standalone: true,
  template: `
    <div class="flex items-center gap-3">
      @for (s of steps; track s; let i = $index) {
        <div class="flex items-center gap-3">
          <div
            class="flex size-7 items-center justify-center rounded-full text-xs font-bold"
            [class.bg-brand]="i + 1 <= current"
            [class.text-brand-foreground]="i + 1 <= current"
            [class.bg-secondary]="i + 1 > current"
            [class.text-muted-foreground]="i + 1 > current"
          >
            {{ i + 1 }}
          </div>
          <span
            class="text-sm font-medium"
            [class.text-foreground]="i + 1 <= current"
            [class.text-muted-foreground]="i + 1 > current"
          >
            {{ s }}
          </span>
          @if (i === 0) {
            <div class="h-px w-8 bg-border sm:w-16"></div>
          }
        </div>
      }
    </div>
  `,
})
export class StepsComponent {
  @Input() current: 1 | 2 = 1;
  steps = ['Customer details', 'Signature & T&C'];
}
