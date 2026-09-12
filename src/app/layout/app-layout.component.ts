import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconData,
  Bot,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Users,
  X,
} from 'lucide-angular';

import { AuthService } from '../core/auth.service';
import { ButtonComponent } from '../shared/button.component';

type NavItem = { to: string; label: string; icon: LucideIconData; badge?: string };

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule, ButtonComponent],
  templateUrl: './app-layout.component.html',
})
export class AppLayoutComponent {
  readonly open = signal(false);

  readonly icons = { Bot, IdCard, LayoutDashboard, LogOut, Menu, Package, ScanLine, Users, X };

  readonly nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/sales-bot', label: 'e& Sales Genie', icon: Bot, badge: 'AI' },
    { to: '/kyc', label: 'Customer KYC', icon: IdCard },
    { to: '/plans', label: 'Plans & Offers', icon: Package },
    { to: '/leads', label: 'My Leads', icon: Users },
    { to: '/eid-mrz', label: 'EID MRZ Reader', icon: ScanLine },
  ];

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  closeMenu(): void {
    this.open.set(false);
  }

  toggleMenu(): void {
    this.open.update((v) => !v);
  }

  initial(): string {
    return this.auth.user()?.name.slice(0, 1) ?? '';
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
