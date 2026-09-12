import { Component } from '@angular/core';
import { Check, LucideAngularModule } from 'lucide-angular';

type Plan = { name: string; price: string; perks: string[] };

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './plans.component.html',
})
export class PlansComponent {
  readonly icons = { Check };

  readonly plans: Plan[] = [
    {
      name: 'Freedom 125',
      price: '125',
      perks: ['50 GB data', 'Unlimited local minutes', '1 month eLife trial'],
    },
    {
      name: 'Freedom 300',
      price: '300',
      perks: ['300 GB shared data', '3 supplementary SIMs', 'Free 500 Mbps eLife'],
    },
    {
      name: 'Business Pro',
      price: '450',
      perks: ['Unlimited data', 'Priority support', 'Cloud PBX add-on'],
    },
  ];
}
