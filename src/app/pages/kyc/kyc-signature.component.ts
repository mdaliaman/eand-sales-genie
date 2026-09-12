import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArrowLeft, CheckCircle2, Eraser, FileText, LucideAngularModule } from 'lucide-angular';

import { KycStoreService, type KycData } from '../../core/kyc-store.service';
import { ToastService } from '../../core/toast.service';
import { ButtonComponent } from '../../shared/button.component';
import { StepsComponent } from '../../shared/steps.component';

@Component({
  selector: 'app-kyc-signature',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent, StepsComponent],
  templateUrl: './kyc-signature.component.html',
})
export class KycSignatureComponent implements AfterViewInit {
  readonly icons = { ArrowLeft, CheckCircle2, Eraser, FileText };

  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  hasSignature = false;
  accepted = false;
  data: KycData;
  done = false;

  private drawing = false;

  constructor(
    private readonly kycStore: KycStoreService,
    private readonly toast: ToastService,
    private readonly router: Router,
  ) {
    this.data = this.kycStore.load();
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasEl?.nativeElement;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
  }

  private pos(e: PointerEvent): { x: number; y: number } {
    const target = e.currentTarget as HTMLCanvasElement;
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  start(e: PointerEvent): void {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const ctx = this.canvasEl?.nativeElement.getContext('2d');
    if (!ctx) return;
    this.drawing = true;
    const { x, y } = this.pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  move(e: PointerEvent): void {
    if (!this.drawing) return;
    const ctx = this.canvasEl?.nativeElement.getContext('2d');
    if (!ctx) return;
    const { x, y } = this.pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    this.hasSignature = true;
  }

  end(): void {
    this.drawing = false;
  }

  clearSignature(): void {
    const canvas = this.canvasEl?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSignature = false;
  }

  submit(): void {
    if (!this.hasSignature) {
      this.toast.error('Please capture the customer signature.');
      return;
    }
    if (!this.accepted) {
      this.toast.error('The customer must accept the Terms & Conditions.');
      return;
    }
    this.kycStore.clear();
    this.done = true;
    this.toast.success('KYC submitted successfully');
  }

  backToDashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }

  back(): void {
    this.router.navigateByUrl('/kyc');
  }
}
