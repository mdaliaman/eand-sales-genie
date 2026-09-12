import { Component } from '@angular/core';

type Lead = { name: string; interest: string; status: string };

@Component({
  selector: 'app-leads',
  standalone: true,
  templateUrl: './leads.component.html',
})
export class LeadsComponent {
  readonly leads: Lead[] = [
    { name: 'Aisha Al Mansoori', interest: 'Freedom 300', status: 'KYC pending' },
    { name: 'Rohit Menon', interest: 'eLife 500 Mbps', status: 'Contacted' },
    { name: 'Gulf Trade LLC', interest: 'Business Pro x12', status: 'Proposal sent' },
    { name: 'Sara Haddad', interest: 'Home Wireless', status: 'Activated' },
  ];
}
