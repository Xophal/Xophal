import type { Locale, NotificationEventType } from "@/lib/notifications/types";

const TEMPLATE_VALUES: Record<NotificationEventType, Record<Locale, { title: string; body: string }>> = {
  test_published: {
    en: { title: "New test published", body: "A new test is available for your class. Open it and start preparing today." },
    hi: { title: "नया टेस्ट उपलब्ध है", body: "आपके क्लास के लिए नया टेस्ट उपलब्ध है। इसे खोलें और आज ही तैयारी शुरू करें।" },
    as: { title: "নতুন পৰীক্ষা উপলব্ধ", body: "আপোনাৰ শ্ৰেণীৰ বাবে এটা নতুন পৰীক্ষা উপলব্ধ হৈছে। ইয়াক খুলি আজি নিজকে সাজু কৰক।" },
  },
  result_ready: {
    en: { title: "Result ready", body: "Your test result is ready. Review your score and focus on the topics that need practice." },
    hi: { title: "परिणाम तैयार है", body: "आपका टेस्ट परिणाम तैयार है। अपना स्कोर देखें और उन विषयों पर ध्यान दें जिन्हें अभ्यास की जरूरत है।" },
    as: { title: "ফলাফল প্রস্তুত", body: "আপোনাৰ পৰীক্ষাৰ ফলাফল প্রস্তুত হৈছে। আপোনাৰ স্কোৰ চোৱা আৰু সেই বিষয়সমূহত মন দিয়া য’ত অনুশীলনৰ প্ৰয়োজন আছে।" },
  },
  weak_topic_detected: {
    en: { title: "Topic to revisit", body: "Your performance suggests a topic needs another revision session. Keep learning steadily." },
    hi: { title: "पुनः समीक्षा करने योग्य विषय", body: "आपके प्रदर्शन से पता चलता है कि एक विषय पर फिर से मेहनत करने की आवश्यकता है। शांतिपूर्वक सीखते रहें।" },
    as: { title: "পুনঃপৰ্যালোচনাত বিষয়", body: "আপোনাৰ কার্যক্ষমতা দেখুৱায় যে এটা বিষয়ৰ বাবে আকৌ অনুশীলনৰ প্ৰয়োজন আছে। স্থিৰে শিকি থাকক।" },
  },
  daily_quiz: {
    en: { title: "Daily quiz available", body: "A new daily quiz is ready for you. A short practice round can help build consistency." },
    hi: { title: "दैनिक क्विज़ उपलब्ध है", body: "आपके लिए दैनिक क्विज़ तैयार है। छोटी प्रैक्टिस सत्र आपके रोज़ के अभ्यास को मजबूत कर सकती है।" },
    as: { title: "দৈনিক কুইজ প্রস্তুত", body: "আপোনাৰ বাবে এটা দৈনিক কুইজ সাজু হৈছে। এটা চুটি অনুশীলন পৰিষ্কাৰ কৰি নিয়মিত উন্নতিৰ সহায় কৰিব পাৰে।" },
  },
  streak_at_risk: {
    en: { title: "Keep your streak alive", body: "A quick revision session will help you keep your learning streak going." },
    hi: { title: "अपना streak बनाए रखें", body: "एक छोटी रिवीजन सत्र से आपका सीखने का streak जारी रह सकता है।" },
    as: { title: "আপোনাৰ streak বজায় ৰাখক", body: "এটা সৰু অনুশীলন ছাত্ৰৰ পৰা আপুনি নিজৰ শিকাৰ ধাৰাবাহিকতা বজায় ৰাখিব পাৰে।" },
  },
  inactive_3d: {
    en: { title: "Return to your study plan", body: "You have been away for a few days. Resume with a short chapter or quiz to keep momentum." },
    hi: { title: "अपना अध्ययन फिर शुरू करें", body: "आप कुछ दिनों से अनुपस्थित हैं। एक छोटा अध्याय या क्विज़ करके फिर से शुरुआत करें।" },
    as: { title: "আপোনাৰ অধ্যয়ন পুনৰ আৰম্ভ কৰক", body: "আপুনি কিছুদিনি অনুপস্থিত আছিল। এটা চুটি অধ্যায় বা কুইজ কৰি পুনৰ আৰম্ভ কৰক।" },
  },
  weekly_progress: {
    en: { title: "Weekly progress summary", body: "Here is your weekly study summary with recent performance and suggested next steps." },
    hi: { title: "साप्ताहिक प्रगति सारांश", body: "यहाँ आपकी साप्ताहिक प्रगति का सारांश है, जिसमें हाल का प्रदर्शन और अगला कदम बताया गया है।" },
    as: { title: "সপ্তাহিক অগ্রগতি সারাংশ", body: "ইয়াত আপোনাৰ সপ্তাহীৰ অগ্রগতিৰ সারাংশ আছে, যাতে সাম্প্ৰতিক ফলাফল আৰু পৰৱৰ্তী পদক্ষেপ আছে।" },
  },
  exam_countdown: {
    en: { title: "Exam countdown", body: "Your examination is approaching. Use the remaining time for revision and practice." },
    hi: { title: "परीक्षा की घड़ी", body: "आपकी परीक्षा नज़दीक है। बचे हुए समय में रिवीजन और प्रैक्टिस करें।" },
    as: { title: "পৰীক্ষাৰ গণনা", body: "আপোনাৰ পৰীক্ষা নিকট হৈছে। বাকী সময়ত পৰ্যালোচনা আৰু অনুশীলন কৰক।" },
  },
  subscription_updated: {
    en: { title: "Account update", body: "Your subscription status has been updated. Review the current plan details for the next step." },
    hi: { title: "खाता अपडेट", body: "आपका सब्सक्रिप्शन अपडेट हो गया है। अगले कदम के लिए अपने प्लान की जानकारी देखें।" },
    as: { title: "একাউণ্ট আপডেট", body: "আপোনাৰ সাবস্ক্ৰিপশনৰ অৱস্থা আপডেট হৈছে। পৰৱৰ্তী পদক্ষেপৰ বাবে আপোনাৰ পৰিকল্পনা চোৱা।" },
  },
  account_security: {
    en: { title: "Security update", body: "We recorded an account security event. Please review your account activity if this was not expected." },
    hi: { title: "सुरक्षा अपडेट", body: "हमने आपके खाते की एक सुरक्षा गतिविधि दर्ज की है। यदि यह उम्मीद के बाहर है, तो अपने खाते की गतिविधि देखें।" },
    as: { title: "নিরাপত্তা আপডেট", body: "আমি আপোনাৰ একাউণ্টৰ নিরাপত্তা ঘটনাক লগ কৰা হৈছে। যদি ই অপ্রত্যাশিত হয়, এয়া পৰ্যালোচনা কৰক।" },
  },
  announcement_published: {
    en: { title: "Announcement", body: "A new announcement has been published for your learning community." },
    hi: { title: "घोषणा", body: "आपके सीखने के समुदाय के लिए नई घोषणा प्रकाशित की गई है।" },
    as: { title: "ঘোষণা", body: "আপোনাৰ শিকাৰ সমাজৰ বাবে এটা নতুন ঘোষণা প্ৰকাশ কৰা হৈছে।" },
  },
  parent_weekly_report: {
    en: { title: "Weekly parent summary", body: "Your child’s weekly progress summary is available and ready to review." },
    hi: { title: "साप्ताहिक अभिभावक सारांश", body: "आपके बच्चे की साप्ताहिक प्रगति का सारांश उपलब्ध है और देखने के लिए तैयार है।" },
    as: { title: "সপ্তাহিক অভিভাৱক সারাংশ", body: "আপোনাৰ শিশুৰ সপ্তাহিক অগ্রগতিৰ সারাংশ প্রস্তুত আৰু পৰ্যালোচনাৰ বাবে প্রস্তুত।" },
  },
};

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function getTemplateForEvent(eventType: NotificationEventType, locale: Locale = "en") {
  const fallback = TEMPLATE_VALUES[eventType]?.en ?? {
    title: "Platform update",
    body: "A platform update is available.",
  };

  return TEMPLATE_VALUES[eventType]?.[locale] ?? fallback;
}

export function renderTemplate(eventType: NotificationEventType, locale: Locale, values: Record<string, string | number | boolean | null | undefined>) {
  const template = getTemplateForEvent(eventType, locale);
  const safeValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value ?? "")]),
  );

  const textFields = [template.title, template.body] as const;
  const rendered = textFields.map((chunk) =>
    chunk.replace(VARIABLE_PATTERN, (_, key) => {
      if (!(key in safeValues)) {
        return "";
      }
      return escapeHtml(String(safeValues[key]));
    }),
  );

  return {
    title: rendered[0],
    body: rendered[1],
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateTemplateVariables(eventType: NotificationEventType, locale: Locale, values: Record<string, string | number | boolean | null | undefined>) {
  const template = getTemplateForEvent(eventType, locale);
  const matches = new Set(Array.from(String(template.title + template.body).matchAll(VARIABLE_PATTERN), (match) => match[1]));
  const provided = new Set(Object.keys(values));
  const missing = [...matches].filter((key) => !(key in values));
  const extra = [...provided].filter((key) => !matches.has(key));

  return { valid: missing.length === 0, missing, extra };
}
