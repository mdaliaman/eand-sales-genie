import { Component, ElementRef, ViewChild, AfterViewChecked, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Bot, LucideAngularModule, SendHorizonal, Sparkles, User } from 'lucide-angular';

import { LanguageService, type ChromeStrings, type LangChoice } from '../../core/language.service';
import { LlmService, type LlmMessage } from '../../core/llm.service';
import { ToastService } from '../../core/toast.service';
import { ButtonComponent } from '../../shared/button.component';

type Message = { id: number; role: 'bot' | 'user'; text: string };

const GREETING_ID = 0;

@Component({
  selector: 'app-sales-bot',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent],
  templateUrl: './sales-bot.component.html',
})
export class SalesBotComponent implements AfterViewChecked {
  readonly icons = { Bot, SendHorizonal, Sparkles, User };

  @ViewChild('endRef') endRef?: ElementRef<HTMLDivElement>;

  messages: Message[] = [{ id: GREETING_ID, role: 'bot', text: '' }];
  input = '';
  typing = false;

  private lastLength = 0;

  constructor(
    readonly lang: LanguageService,
    private readonly llm: LlmService,
    private readonly toast: ToastService,
  ) {
    // Keep the opening greeting in whatever language the UI is currently set to,
    // but only while the conversation hasn't really started.
    effect(() => {
      const greeting = this.lang.strings().greeting;
      if (this.messages.length === 1 && this.messages[0].id === GREETING_ID) {
        this.messages = [{ id: GREETING_ID, role: 'bot', text: greeting }];
      }
    });
  }

  get t(): ChromeStrings {
    return this.lang.strings();
  }

  ngAfterViewChecked(): void {
    if (this.messages.length !== this.lastLength) {
      this.lastLength = this.messages.length;
      this.endRef?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onLanguageChange(choice: LangChoice): void {
    this.lang.setChoice(choice);
  }

  send(text: string): void {
    const value = text.trim().slice(0, 1000);
    if (!value || this.typing) return;

    this.messages = [...this.messages, { id: Date.now(), role: 'user', text: value }];
    this.input = '';
    this.typing = true;

    const history: LlmMessage[] = this.messages.map((m) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.text,
    }));

    this.llm.chat(history, { language: this.lang.choice() }).subscribe({
      next: ({ reply, language }) => {
        this.lang.applyResolved(language);
        this.messages = [...this.messages, { id: Date.now() + 1, role: 'bot', text: reply }];
        this.typing = false;
      },
      error: () => {
        this.toast.error(this.t.errorMsg);
        this.typing = false;
      },
    });
  }

  onSubmit(): void {
    this.send(this.input);
  }
}
