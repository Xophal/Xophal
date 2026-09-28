export type BlogDemoPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  author: string;
  published_at: string;
  featured?: boolean;
  coverTone: string;
  contentHtml: string;
};

export const blogDemoPosts: BlogDemoPost[] = [
  {
    id: "1",
    slug: "how-to-build-a-board-exam-routine-that-actually-works",
    title: "How to build a board exam routine that actually works",
    excerpt:
      "A realistic, sustainable study schedule for Class 10 and 12 students who want consistency instead of burnout.",
    category: "Study Strategy",
    readTime: "6 min read",
    author: "Xophol Editorial Desk",
    published_at: "2026-09-07T09:00:00.000Z",
    featured: true,
    coverTone: "from-emerald-600 via-teal-500 to-yellow-400",
    contentHtml: `
      <p>Most students do not fail because they study too little. They fail because their routine is too ambitious, too rigid, or too easy to abandon.</p>
      <p>The strongest revision plan is one you can repeat for 30 days without needing a reset. A realistic board-prep routine usually combines short, focused study blocks with protected revision time and a well-defined recovery window.</p>
      <p>For example, a healthy daily rhythm might look like this:</p>
      <ul>
        <li>45 minutes of concept revision in the morning</li>
        <li>30 minutes of active problem solving</li>
        <li>One chapter-wise recap in the afternoon</li>
        <li>15 minutes of quick formula or vocabulary recall before bed</li>
      </ul>
      <p>What matters most is not perfection. It is continuity. Students who repeat a manageable structure week after week create far more learning momentum than those who do intense work for a few days and then crash.</p>
      <p>If your routine feels heavy, trim it back. A sustainable system is always a better exam strategy than a heroic one.</p>
    `,
  },
  {
    id: "2",
    slug: "3-mistakes-students-make-in-mock-tests",
    title: "3 mistakes students make in mock tests",
    excerpt:
      "Mock tests are meant to reveal weak spots, not just generate a score. Here is how to use them properly.",
    category: "Mock Tests",
    readTime: "4 min read",
    author: "Nisha Dutta",
    published_at: "2026-08-29T09:00:00.000Z",
    coverTone: "from-amber-500 via-orange-500 to-red-500",
    contentHtml: `
      <p>One of the biggest mistakes students make is treating a mock test like a judgment day instead of a feedback tool. A mock is valuable only when you review it properly.</p>
      <p>First, many students skip the analysis after the timer ends. They glance at the score and move on. That is the fastest way to repeat the same mistakes in the real exam.</p>
      <p>Second, students often focus on speed without checking accuracy. If you finish faster but answer more questions incorrectly, the mock is not helping you improve.</p>
      <p>Third, students treat every incorrect answer as a personal failure. In reality, it is a signal. The right response is to identify the exact gap: concept issue, reading error, time pressure, or careless marking.</p>
      <p>Use each mock as a map. The point is not to get a perfect score. The point is to learn exactly where the next improvement should happen.</p>
    `,
  },
  {
    id: "3",
    slug: "how-to-revise-science-without-burning-out",
    title: "How to revise Science without burning out",
    excerpt:
      "Short, active revision cycles make science easier to remember than long sessions of passive rereading.",
    category: "Science",
    readTime: "5 min read",
    author: "Rituraj Sen",
    published_at: "2026-08-18T09:00:00.000Z",
    coverTone: "from-violet-600 via-indigo-500 to-cyan-400",
    contentHtml: `
      <p>Science revision works best when it is active. Students should recall the idea, explain it in simple language, and test themselves before looking at the answer page again.</p>
      <p>Start by revising formulas, definitions and diagrams in chunks rather than reading an entire chapter at once. A good cycle is: recall → practise → check → correct.</p>
      <p>Keep a small error notebook for mistakes that keep repeating. Labs, diagrams, and numerical questions often become far easier once you rewrite your own short explanations.</p>
      <p>When students revise for too long in one stretch, retention drops. Shorter sessions, completed consistently, will always outperform a single exhausting marathon.</p>
    `,
  },
  {
    id: "4",
    slug: "a-smarter-way-to-study-maths-before-your-exam",
    title: "A smarter way to study Maths before your exam",
    excerpt:
      "Build confidence in Maths by focusing on concepts, patterns, and a simple error log instead of memorisation alone.",
    category: "Mathematics",
    readTime: "5 min read",
    author: "Ananya Roy",
    published_at: "2026-08-07T09:00:00.000Z",
    coverTone: "from-sky-600 via-emerald-500 to-lime-400",
    contentHtml: `
      <p>Mathematics does not improve through passive reading. It improves through repeated pattern recognition and careful checking.</p>
      <p>Instead of solving a large number of questions with little reflection, focus on two things: understanding the method and spotting recurring errors. If a step is frequently wrong, that is exactly where your revision should go.</p>
      <p>Keep a mini notebook with formula rules, common traps, and one solved example for each chapter. This helps reduce panic during the exam and speeds up recall under time pressure.</p>
      <p>Strong Maths performance comes from calm repetition, not from rushing through the paper. Accuracy wins over speed if you build both steadily.</p>
    `,
  },
  {
    id: "5",
    slug: "how-to-write-stronger-answers-in-assamese-and-english",
    title: "How to write stronger answers in Assamese and English",
    excerpt:
      "Improve clarity, structure and confidence in language papers with simple, repeatable writing habits.",
    category: "Language",
    readTime: "6 min read",
    author: "Pallavi Gogoi",
    published_at: "2026-07-21T09:00:00.000Z",
    coverTone: "from-fuchsia-600 via-violet-500 to-blue-400",
    contentHtml: `
      <p>Language papers reward clarity more than complexity. Students who think clearly and structure answers well usually perform better than those who try to impress with difficult vocabulary.</p>
      <p>Before writing, identify the core idea, two supporting points, and a short closing sentence. That structure gives your answer a natural flow and makes it easier to stay on topic.</p>
      <p>For grammar, focus on consistent sentence length, subject-verb agreement, and correct punctuation. For essays and letters, practise opening lines, transitions, and concise concluding ideas.</p>
      <p>Writing confidently is a skill built from repetition. The more you write in a structured way, the calmer your exam writing becomes.</p>
    `,
  },
  {
    id: "6",
    slug: "the-last-30-days-before-your-board-exams",
    title: "The last 30 days before your board exams",
    excerpt:
      "A focused plan for the final month—how to revise, recover energy, and enter the exam hall calmer than before.",
    category: "Exam Strategy",
    readTime: "7 min read",
    author: "Xophol Learning Desk",
    published_at: "2026-07-02T09:00:00.000Z",
    coverTone: "from-cyan-600 via-sky-500 to-emerald-400",
    contentHtml: `
      <p>The final month before exams should not become a sprint of panic. It should become a plan of intention.</p>
      <p>At this stage, stop trying to cover everything in equal depth. Prioritise high-weight chapters, recurrent errors, and weaker topics you can still improve in a focused way.</p>
      <p>Use short revision blocks, daily recap, and a clear list of what must be completed before the exam. The goal is to sharpen recall, improve accuracy, and reduce unnecessary stress.</p>
      <p>Energy matters as much as knowledge. Sleep, hydration, breaks, and calm revision are not luxuries. They are part of the strategy.</p>
    `,
  },
];

export function getDemoPostBySlug(slug: string) {
  return blogDemoPosts.find((post) => post.slug === slug);
}
