import { Injectable, computed, signal } from '@angular/core';

/** Languages the Sales Genie can converse in. */
export type Lang = 'en' | 'ar' | 'bn' | 'hi' | 'ml';

/** What the agent picks in the header — a fixed language or "let the model decide". */
export type LangChoice = Lang | 'auto';

export type Dir = 'ltr' | 'rtl';

export interface ChromeStrings {
  greeting: string;
  subtitle: string;
  typing: string;
  placeholder: string;
  language: string;
  autoDetect: string;
  errorMsg: string;
  suggestions: string[];
}

/** Native-name labels for the header picker. */
export const LANGUAGE_OPTIONS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ml', label: 'മലയാളം' },
];

const TR: Record<Lang, ChromeStrings> = {
  en: {
    greeting:
      "Hi! I'm the e& Sales Genie. Ask me about plans, bundles, pricing or how to handle an objection.",
    subtitle: 'Your AI selling companion',
    typing: 'Genie is typing…',
    placeholder: 'Ask the Sales Genie anything…',
    language: 'Language',
    autoDetect: 'Auto-detect',
    errorMsg: "Couldn't reach the Sales Genie. Please try again.",
    suggestions: [
      'Best postpaid plan for a family of four',
      'Compare Home Wireless vs eLife fibre',
      'Customer says the price is too high — what do I say?',
      'What documents do I need for a business SIM?',
    ],
  },
  ar: {
    greeting:
      'مرحبًا! أنا جيني المبيعات من e&. اسألني عن الباقات أو الحزم أو الأسعار أو كيفية التعامل مع اعتراض العميل.',
    subtitle: 'رفيقك الذكي في المبيعات',
    typing: 'الجيني يكتب…',
    placeholder: 'اسأل جيني المبيعات عن أي شيء…',
    language: 'اللغة',
    autoDetect: 'كشف تلقائي',
    errorMsg: 'تعذّر الوصول إلى جيني المبيعات. حاول مرة أخرى.',
    suggestions: [
      'أفضل باقة فوترة لعائلة من أربعة أفراد',
      'قارن بين الإنترنت المنزلي اللاسلكي وألياف eLife',
      'يقول العميل إن السعر مرتفع جدًا — بماذا أرد؟',
      'ما المستندات التي أحتاجها لشريحة أعمال؟',
    ],
  },
  hi: {
    greeting:
      'नमस्ते! मैं e& सेल्स जिनी हूँ। मुझसे प्लान, बंडल, कीमत या ग्राहक की आपत्ति संभालने के बारे में पूछें।',
    subtitle: 'आपका एआई बिक्री साथी',
    typing: 'जिनी टाइप कर रहा है…',
    placeholder: 'सेल्स जिनी से कुछ भी पूछें…',
    language: 'भाषा',
    autoDetect: 'स्वतः पहचान',
    errorMsg: 'सेल्स जिनी तक नहीं पहुँच सके। कृपया पुनः प्रयास करें।',
    suggestions: [
      'चार लोगों के परिवार के लिए सबसे अच्छा पोस्टपेड प्लान',
      'होम वायरलेस बनाम eLife फाइबर की तुलना करें',
      'ग्राहक कहता है कीमत बहुत ज़्यादा है — मैं क्या कहूँ?',
      'बिज़नेस सिम के लिए मुझे कौन-से दस्तावेज़ चाहिए?',
    ],
  },
  bn: {
    greeting:
      'হ্যালো! আমি e& সেলস জিনি। প্ল্যান, বান্ডল, দাম বা গ্রাহকের আপত্তি সামলানো নিয়ে আমাকে জিজ্ঞাসা করুন।',
    subtitle: 'আপনার এআই বিক্রয় সঙ্গী',
    typing: 'জিনি টাইপ করছে…',
    placeholder: 'সেলস জিনিকে যেকোনো কিছু জিজ্ঞাসা করুন…',
    language: 'ভাষা',
    autoDetect: 'স্বয়ংক্রিয় শনাক্ত',
    errorMsg: 'সেলস জিনির সাথে সংযোগ করা যায়নি। আবার চেষ্টা করুন।',
    suggestions: [
      'চারজনের পরিবারের জন্য সেরা পোস্টপেইড প্ল্যান',
      'হোম ওয়্যারলেস বনাম eLife ফাইবার তুলনা করুন',
      'গ্রাহক বলছেন দাম অনেক বেশি — আমি কী বলব?',
      'বিজনেস সিমের জন্য আমার কোন কোন নথি লাগবে?',
    ],
  },
  ml: {
    greeting:
      'ഹായ്! ഞാൻ e& സെയിൽസ് ജിനി ആണ്. പ്ലാനുകൾ, ബണ്ടിലുകൾ, വില, അല്ലെങ്കിൽ ഉപഭോക്തൃ എതിർപ്പ് കൈകാര്യം ചെയ്യുന്നത് എന്നിവയെക്കുറിച്ച് എന്നോട് ചോദിക്കൂ.',
    subtitle: 'നിങ്ങളുടെ എഐ വിൽപ്പന സഹായി',
    typing: 'ജിനി ടൈപ്പ് ചെയ്യുന്നു…',
    placeholder: 'സെയിൽസ് ജിനിയോട് എന്തും ചോദിക്കൂ…',
    language: 'ഭാഷ',
    autoDetect: 'സ്വയം കണ്ടെത്തൽ',
    errorMsg: 'സെയിൽസ് ജിനിയുമായി ബന്ധപ്പെടാനായില്ല. വീണ്ടും ശ്രമിക്കുക.',
    suggestions: [
      'നാലംഗ കുടുംബത്തിന് ഏറ്റവും മികച്ച പോസ്റ്റ്‌പെയ്ഡ് പ്ലാൻ',
      'ഹോം വയർലെസും eLife ഫൈബറും താരതമ്യം ചെയ്യുക',
      'വില വളരെ കൂടുതലാണെന്ന് ഉപഭോക്താവ് പറയുന്നു — ഞാൻ എന്ത് പറയണം?',
      'ബിസിനസ് സിമ്മിന് എനിക്ക് എന്ത് രേഖകളാണ് വേണ്ടത്?',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** The agent's raw pick, including "auto". */
  readonly choice = signal<LangChoice>('auto');

  /** The concrete language currently driving the UI (chrome + direction). */
  readonly resolved = signal<Lang>('en');

  readonly dir = computed<Dir>(() => (this.resolved() === 'ar' ? 'rtl' : 'ltr'));

  readonly strings = computed<ChromeStrings>(() => TR[this.resolved()]);

  readonly options = LANGUAGE_OPTIONS;

  /** Called from the header picker. */
  setChoice(choice: LangChoice): void {
    this.choice.set(choice);
    if (choice !== 'auto') this.resolved.set(choice);
  }

  /** Called with the language the backend/model actually answered in. */
  applyResolved(lang: Lang): void {
    if (this.choice() === 'auto') this.resolved.set(lang);
  }
}
