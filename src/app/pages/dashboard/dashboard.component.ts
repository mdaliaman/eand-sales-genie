import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowUpRight,
  Bot,
  IdCard,
  LucideAngularModule,
  LucideIconData,
  Target,
  TrendingUp,
  Users,
} from 'lucide-angular';

import { AuthService } from '../../core/auth.service';

type Stat = { label: string; value: string; delta: string; icon: LucideIconData };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly icons = { ArrowUpRight, Bot, IdCard };

  readonly stats: Stat[] = [
    { label: 'Activations today', value: '14', delta: '+22%', icon: TrendingUp },
    { label: 'Open leads', value: '38', delta: '+6', icon: Users },
    { label: 'Monthly target', value: '72%', delta: 'on track', icon: Target },
  ];

  constructor(readonly auth: AuthService) {}

  firstName(): string {
    return this.auth.user()?.name.split(' ')[0] ?? '';
  }
}
