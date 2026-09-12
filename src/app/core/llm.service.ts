import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import type { Lang, LangChoice } from './language.service';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmReply {
  reply: string;
  /** The language the reply is written in (useful when the request was "auto"). */
  language: Lang;
}

/**
 * Talks to the USP-Indirect backend, which in turn calls e&'s LLM.
 * The browser never holds an LLM credential.
 *
 * While `environment.useMockLlm` is true this returns localized canned
 * replies so the demo runs with no backend.
 */
@Injectable({ providedIn: 'root' })
export class LlmService {
  private readonly http = inject(HttpClient);
  private readonly sessionId = globalThis.crypto?.randomUUID?.() ?? `sess-${Date.now()}`;

  chat(messages: LlmMessage[], opts: { language: LangChoice }): Observable<LlmReply> {
    if (environment.useMockLlm) {
      return of(mockReply(messages, opts.language)).pipe(delay(650));
    }

    return this.http.post<LlmReply>(
      `${environment.uspBaseUrl}/sales-genie/chat`,
      { sessionId: this.sessionId, language: opts.language, messages },
      { withCredentials: true },
    );
  }
}

// ---------------------------------------------------------------------------
// Mock brain — remove once `useMockLlm` is off for good.
// ---------------------------------------------------------------------------

type Topic = 'family' | 'fibre' | 'price' | 'documents' | 'fallback';

function mockReply(messages: LlmMessage[], choice: LangChoice): LlmReply {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const language: Lang = choice === 'auto' ? detectLang(lastUser) : choice;
  return { reply: RESP[detectTopic(lastUser)][language], language };
}

function detectLang(text: string): Lang {
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[ঀ-৿]/.test(text)) return 'bn';
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return 'en';
}

const KEYWORDS: Record<Exclude<Topic, 'fallback'>, string[]> = {
  family: ['family', 'postpaid', 'عائلة', 'فوترة', 'परिवार', 'पोस्टपेड', 'পরিবার', 'পোস্টপেইড', 'കുടുംബ', 'പോസ്റ്റ്‌പെയ്ഡ്'],
  fibre: ['fibre', 'fiber', 'elife', 'wireless', 'ألياف', 'لاسلكي', 'फाइबर', 'वायरलेस', 'ফাইবার', 'ওয়্যারলেস', 'ഫൈബർ', 'വയർലെസ'],
  price: ['price', 'expensive', 'too high', 'سعر', 'مرتفع', 'غالي', 'कीमत', 'महंगा', 'ज़्यादा', 'দাম', 'বেশি', 'വില', 'കൂടുതൽ'],
  documents: ['document', 'kyc', 'business', 'مستند', 'وثائق', 'أعمال', 'दस्तावेज़', 'बिज़नेस', 'নথি', 'বিজনেস', 'রেখা', 'രേഖ', 'ബിസിനസ'],
};

function detectTopic(text: string): Topic {
  const q = text.toLowerCase();
  for (const topic of ['family', 'fibre', 'price', 'documents'] as const) {
    if (KEYWORDS[topic].some((kw) => q.includes(kw.toLowerCase()))) return topic;
  }
  return 'fallback';
}

const RESP: Record<Topic, Record<Lang, string>> = {
  family: {
    en: 'For a family of four, pitch Freedom 300 with 3 supplementary SIMs:\n\n• 300 GB shared data + unlimited local minutes\n• Free eLife 500 Mbps add-on for 3 months\n• AED 300/month, AED 90 per extra SIM\n\nClose with the 12-month device instalment — it lifts ARPU by about 18%.',
    ar: 'لعائلة من أربعة أفراد، اعرض باقة Freedom 300 مع 3 شرائح إضافية:\n\n• 300 غيغابايت بيانات مشتركة + دقائق محلية غير محدودة\n• إضافة eLife بسرعة 500 ميغابت/ث مجانًا لمدة 3 أشهر\n• 300 درهم شهريًا، و90 درهمًا لكل شريحة إضافية\n\nأنهِ البيع بتقسيط الجهاز على 12 شهرًا — يرفع متوسط الإيراد لكل مستخدم بنحو 18%.',
    hi: 'चार लोगों के परिवार के लिए, Freedom 300 प्लान 3 सप्लीमेंट्री सिम के साथ सुझाएँ:\n\n• 300 GB शेयर्ड डेटा + अनलिमिटेड लोकल मिनट\n• 3 महीने के लिए मुफ़्त eLife 500 Mbps ऐड-ऑन\n• AED 300/माह, हर अतिरिक्त सिम पर AED 90\n\n12 महीने की डिवाइस किस्त के साथ डील बंद करें — इससे ARPU लगभग 18% बढ़ता है।',
    bn: 'চারজনের পরিবারের জন্য, ৩টি সাপ্লিমেন্টারি সিমসহ Freedom 300 প্ল্যান দেখান:\n\n• ৩০০ GB শেয়ার্ড ডেটা + আনলিমিটেড লোকাল মিনিট\n• ৩ মাসের জন্য ফ্রি eLife 500 Mbps অ্যাড-অন\n• মাসে AED 300, প্রতিটি অতিরিক্ত সিমে AED 90\n\n১২ মাসের ডিভাইস কিস্তি দিয়ে ডিল শেষ করুন — এতে ARPU প্রায় ১৮% বাড়ে।',
    ml: 'നാലംഗ കുടുംബത്തിന്, 3 സപ്ലിമെന്ററി സിമ്മുകളോടെ Freedom 300 പ്ലാൻ നിർദേശിക്കുക:\n\n• 300 GB പങ്കിട്ട ഡാറ്റ + അൺലിമിറ്റഡ് ലോക്കൽ മിനിറ്റുകൾ\n• 3 മാസത്തേക്ക് സൗജന്യ eLife 500 Mbps ആഡ്-ഓൺ\n• മാസം AED 300, ഓരോ അധിക സിമ്മിനും AED 90\n\n12 മാസത്തെ ഉപകരണ ഇൻസ്റ്റാൾമെന്റോടെ ഇടപാട് പൂർത്തിയാക്കുക — ഇത് ARPU ഏകദേശം 18% വർധിപ്പിക്കും.',
  },
  fibre: {
    en: 'eLife fibre is best where coverage exists: symmetric speeds up to 1 Gbps, TV bundles and lower latency.\nHome Wireless suits villas or short leases — same-day self install, no civil works.\n\nQuick rule: if the address is fibre-ready, always lead with eLife.',
    ar: 'ألياف eLife هي الأفضل حيثما توفرت التغطية: سرعات متماثلة حتى 1 غيغابت/ث، وباقات تلفزيون، وزمن استجابة أقل.\nالإنترنت المنزلي اللاسلكي مناسب للفلل أو عقود الإيجار القصيرة — تركيب ذاتي في نفس اليوم دون أعمال إنشائية.\n\nقاعدة سريعة: إذا كان العنوان جاهزًا للألياف، ابدأ دائمًا بـ eLife.',
    hi: 'जहाँ कवरेज हो वहाँ eLife फाइबर सबसे बेहतर है: 1 Gbps तक सिमेट्रिक स्पीड, टीवी बंडल और कम लेटेंसी।\nहोम वायरलेस विला या छोटे लीज़ के लिए ठीक है — उसी दिन सेल्फ़ इंस्टॉल, कोई सिविल वर्क नहीं।\n\nसरल नियम: अगर पता फाइबर-रेडी है, तो हमेशा eLife से शुरुआत करें।',
    bn: 'যেখানে কভারেজ আছে সেখানে eLife ফাইবারই সেরা: ১ Gbps পর্যন্ত সিমেট্রিক স্পিড, টিভি বান্ডল ও কম লেটেন্সি।\nহোম ওয়্যারলেস ভিলা বা স্বল্পমেয়াদি লিজের জন্য উপযুক্ত — একই দিনে সেলফ ইনস্টল, কোনো নির্মাণকাজ নেই।\n\nসহজ নিয়ম: ঠিকানা ফাইবার-রেডি হলে সবসময় eLife দিয়ে শুরু করুন।',
    ml: 'കവറേജ് ഉള്ളിടത്ത് eLife ഫൈബറാണ് മികച്ചത്: 1 Gbps വരെ സിമെട്രിക് വേഗത, ടിവി ബണ്ടിലുകൾ, കുറഞ്ഞ ലേറ്റൻസി.\nഹോം വയർലെസ് വില്ലകൾക്കോ ഹ്രസ്വകാല വാടകയ്ക്കോ അനുയോജ്യം — അതേ ദിവസം സ്വയം ഇൻസ്റ്റാൾ, നിർമാണ പണികളില്ല.\n\nലളിതമായ നിയമം: വിലാസം ഫൈബർ-റെഡി ആണെങ്കിൽ എപ്പോഴും eLife കൊണ്ട് തുടങ്ങുക.',
  },
  price: {
    en: 'Reframe from price to value:\n\n1. Acknowledge: "I understand, budget matters."\n2. Break it down per day — AED 300/month is about AED 10/day for the whole family.\n3. Anchor on the free eLife add-on and the device instalment.\n4. Offer the step-down plan only as a last resort.',
    ar: 'حوّل الحديث من السعر إلى القيمة:\n\n1. تفهّم: "أتفهم، الميزانية مهمة."\n2. قسّم المبلغ يوميًا — 300 درهم شهريًا تعادل نحو 10 دراهم يوميًا للعائلة كلها.\n3. ركّز على إضافة eLife المجانية وتقسيط الجهاز.\n4. اعرض الباقة الأقل فقط كحل أخير.',
    hi: 'बात कीमत से हटाकर वैल्यू पर लाएँ:\n\n1. स्वीकार करें: "मैं समझता हूँ, बजट मायने रखता है।"\n2. रोज़ के हिसाब से बताएँ — AED 300/माह यानी पूरे परिवार के लिए लगभग AED 10 प्रतिदिन।\n3. मुफ़्त eLife ऐड-ऑन और डिवाइस किस्त पर ज़ोर दें।\n4. कम कीमत वाला प्लान सिर्फ़ आख़िरी विकल्प के तौर पर दें।',
    bn: 'দাম থেকে মূল্যের দিকে আলোচনা ঘোরান:\n\n১. স্বীকার করুন: "আমি বুঝি, বাজেট গুরুত্বপূর্ণ।"\n২. দৈনিক হিসেবে ভাঙুন — মাসে AED 300 মানে পুরো পরিবারের জন্য দিনে প্রায় AED 10।\n৩. ফ্রি eLife অ্যাড-অন ও ডিভাইস কিস্তির উপর জোর দিন।\n৪. কম দামের প্ল্যান কেবল শেষ উপায় হিসেবে দিন।',
    ml: 'സംഭാഷണം വിലയിൽ നിന്ന് മൂല്യത്തിലേക്ക് മാറ്റുക:\n\n1. അംഗീകരിക്കുക: "മനസ്സിലാകുന്നു, ബജറ്റ് പ്രധാനമാണ്."\n2. ദിവസക്കണക്കിൽ വിഭജിക്കുക — മാസം AED 300 എന്നാൽ കുടുംബത്തിന് ദിവസം ഏകദേശം AED 10.\n3. സൗജന്യ eLife ആഡ്-ഓണിലും ഉപകരണ ഇൻസ്റ്റാൾമെന്റിലും ഊന്നൽ നൽകുക.\n4. കുറഞ്ഞ പ്ലാൻ അവസാന ആശ്രയമായി മാത്രം നൽകുക.',
  },
  documents: {
    en: "For a business SIM you need: valid trade licence, Emirates ID of the authorised signatory, passport copy with visa page, and a stamped authorisation letter.\n\nYou can capture the signatory's details now in Customer KYC.",
    ar: 'لشريحة الأعمال تحتاج إلى: رخصة تجارية سارية، والهوية الإماراتية للمفوّض بالتوقيع، ونسخة من جواز السفر مع صفحة التأشيرة، وخطاب تفويض مختوم.\n\nيمكنك تسجيل بيانات المفوّض الآن في صفحة اعرف عميلك (KYC).',
    hi: 'बिज़नेस सिम के लिए आपको चाहिए: वैध ट्रेड लाइसेंस, अधिकृत हस्ताक्षरकर्ता का Emirates ID, वीज़ा पेज सहित पासपोर्ट कॉपी, और मुहर लगा अधिकार पत्र।\n\nआप हस्ताक्षरकर्ता का विवरण अभी Customer KYC में दर्ज कर सकते हैं।',
    bn: 'বিজনেস সিমের জন্য দরকার: বৈধ ট্রেড লাইসেন্স, অনুমোদিত স্বাক্ষরকারীর Emirates ID, ভিসা পেজসহ পাসপোর্ট কপি, এবং সিলমোহরযুক্ত অনুমোদনপত্র।\n\nআপনি এখনই Customer KYC-তে স্বাক্ষরকারীর তথ্য নিতে পারেন।',
    ml: 'ബിസിനസ് സിമ്മിന് വേണ്ടത്: സാധുവായ ട്രേഡ് ലൈസൻസ്, അധികൃത ഒപ്പിടുന്നയാളുടെ Emirates ID, വിസ പേജ് ഉൾപ്പെടെ പാസ്‌പോർട്ട് പകർപ്പ്, മുദ്രയുള്ള അധികാരപത്രം.\n\nഒപ്പിടുന്നയാളുടെ വിവരങ്ങൾ ഇപ്പോൾ Customer KYC-യിൽ രേഖപ്പെടുത്താം.',
  },
  fallback: {
    en: "Here's how I'd approach that:\n\n• Confirm the customer's current spend and main pain point\n• Match it to the nearest e& bundle — mobile, eLife or business\n• Lead with the added value, then the price\n\nAsk me for a specific plan comparison and I'll lay out the numbers.",
    ar: 'إليك كيف أتعامل مع ذلك:\n\n• تأكد من إنفاق العميل الحالي وأهم نقطة ألم لديه\n• طابقه مع أقرب باقة من e& — جوال أو eLife أو أعمال\n• ابدأ بالقيمة المضافة ثم السعر\n\nاطلب مني مقارنة باقة محددة وسأعرض لك الأرقام.',
    hi: 'मैं इसे ऐसे संभालूँगा:\n\n• ग्राहक का मौजूदा खर्च और मुख्य समस्या समझें\n• उसे नज़दीकी e& बंडल से मिलाएँ — मोबाइल, eLife या बिज़नेस\n• पहले अतिरिक्त वैल्यू बताएँ, फिर कीमत\n\nकिसी ख़ास प्लान की तुलना पूछें, मैं आँकड़े सामने रख दूँगा।',
    bn: 'আমি এভাবে এগোব:\n\n• গ্রাহকের বর্তমান খরচ ও মূল সমস্যা নিশ্চিত করুন\n• সেটিকে নিকটতম e& বান্ডলের সাথে মেলান — মোবাইল, eLife বা বিজনেস\n• আগে বাড়তি মূল্য, তারপর দাম বলুন\n\nনির্দিষ্ট প্ল্যান তুলনা চান, আমি সংখ্যাগুলো সাজিয়ে দেব।',
    ml: 'ഞാൻ ഇത് ഇങ്ങനെ കൈകാര്യം ചെയ്യും:\n\n• ഉപഭോക്താവിന്റെ നിലവിലെ ചെലവും പ്രധാന പ്രശ്നവും ഉറപ്പാക്കുക\n• അതിനെ ഏറ്റവും അടുത്ത e& ബണ്ടിലുമായി ചേർക്കുക — മൊബൈൽ, eLife അല്ലെങ്കിൽ ബിസിനസ്\n• ആദ്യം അധിക മൂല്യം, പിന്നെ വില\n\nഒരു നിർദിഷ്ട പ്ലാൻ താരതമ്യം ചോദിക്കൂ, ഞാൻ കണക്കുകൾ നിരത്താം.',
  },
};
