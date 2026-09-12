import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';
import { AppLayoutComponent } from './layout/app-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SalesBotComponent } from './pages/sales-bot/sales-bot.component';
import { KycFormComponent } from './pages/kyc/kyc-form.component';
import { KycSignatureComponent } from './pages/kyc/kyc-signature.component';
import { LeadsComponent } from './pages/leads/leads.component';
import { PlansComponent } from './pages/plans/plans.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    component: LoginComponent,
    title: 'Sign in — e& Sales Workspace',
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard — e& Sales Workspace' },
      { path: 'sales-bot', component: SalesBotComponent, title: 'e& Sales Genie — AI Assistant' },
      { path: 'kyc', component: KycFormComponent, title: 'Customer KYC — e& Sales Workspace' },
      {
        path: 'kyc/signature',
        component: KycSignatureComponent,
        title: 'Signature & Terms — e& Customer KYC',
      },
      { path: 'plans', component: PlansComponent, title: 'Plans & Offers — e& Sales Workspace' },
      { path: 'leads', component: LeadsComponent, title: 'My Leads — e& Sales Workspace' },
      {
        // Lazy: keeps the MRZ SDK out of the initial bundle for the many
        // sessions that never open the scanner.
        path: 'eid-mrz',
        loadComponent: () =>
          import('./pages/eid-mrz/eid-mrz.component').then((m) => m.EidMrzComponent),
        title: 'EID MRZ Reader — e& Sales Workspace',
      },
    ],
  },
  { path: '**', component: NotFoundComponent },
];
