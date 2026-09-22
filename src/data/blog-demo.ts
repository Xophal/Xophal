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
    slug: "assam-board-study-routine-for-class-10",
    title: "Assam Board Study Routine for Class 10 Students",
    excerpt:
      "A realistic weekly plan that balances SEBA subjects, revision, and recovery time for healthier exam prep.",
    category: "Study Tips",
    readTime: "5 min read",
    author: "Xophal Learning Desk",
    published_at: "2026-08-20T09:00:00.000Z",
    featured: true,
    coverTone: "from-emerald-600 via-teal-500 to-yellow-400",
    contentHtml: `
      <p>Class 10 students preparing for the Assam Board often feel pressure from multiple subjects at once. The best routine is not the longest one—it is the one that is realistic and repeatable.</p>
      <p>Start with a simple structure: two focused study blocks in the morning, one revision session in the afternoon, and a short recap before sleep. Keep English, Maths, Science, and Assamese in rotation so no subject feels neglected.</p>
      <p>Try this pattern:</p>
      <ul>
        <li>Morning: 45 minutes of concept learning</li>
        <li>Late morning: 30 minutes of practice questions</li>
        <li>Afternoon: one revision block + short break</li>
        <li>Evening: reading notes and quick recap</li>
      </ul>
      <p>Most importantly, track what feels difficult. A steady routine, consistent revision, and healthy sleep are often more powerful than last-minute cramming.</p>
    `,
  },
  {
    id: "2",
    slug: "how-to-revise-science-before-seba-exams",
    title: "How to Revise Science Before SEBA Exams",
    excerpt:
      "Simple methods to improve retention, solve diagrams faster, and stay calm during the science paper.",
    category: "Science",
    readTime: "4 min read",
    author: "Sharmah Academy",
    published_at: "2026-08-12T09:00:00.000Z",
    coverTone: "from-amber-500 via-orange-500 to-red-500",
    contentHtml: `
      <p>Science revision works best when it is active. Students should not only re-read textbook pages—they should attempt to explain concepts in their own words and draw key diagrams from memory.</p>
      <p>Set aside a short recap for each chapter: definitions, formulas, labelled diagrams, and one practice question. This makes revision more active and easier to remember.</p>
      <p>It also helps to keep a quick error notebook. Write down formula mistakes, confusing concepts, and repeated diagram errors. Revisit that page during the final week before the exam.</p>
      <p>Remember: quality revision beats quantity. Ten focused minutes of active recall are more useful than an hour of passive reading.</p>
    `,
  },
  {
    id: "3",
    slug: "building-confidence-in-assamese-english-writing",
    title: "Building Confidence in Assamese and English Writing",
    excerpt:
      "Useful writing habits for better grammar, clearer structure, and more confident answers in board exams.",
    category: "Language",
    readTime: "6 min read",
    author: "Classroom Connect",
    published_at: "2026-07-28T09:00:00.000Z",
    coverTone: "from-violet-600 via-indigo-500 to-cyan-400",
    contentHtml: `
      <p>Strong writing skills do not come from memorising perfect essays alone. They grow from practice, structure, and consistency.</p>
      <p>For Assamese and English writing, start with introductions, key points, and a conclusion. Students who follow a clear structure usually write more confidently even under time pressure.</p>
      <p>It is also useful to keep a small list of high-frequency vocabulary, expressions, and diagram labels. Familiarity creates calmness during the exam.</p>
      <p>When the answer is not perfectly polished, strong structure still earns credit. Clear writing is often more important than complex wording.</p>
    `,
  },
  {
    id: "4",
    slug: "daily-mock-test-plan-for-board-prep",
    title: "A Daily Mock Test Plan for Board Preparation",
    excerpt:
      "Use regular mini-tests to spot weak chapters, improve time management, and build confidence before the final exam.",
    category: "Mock Tests",
    readTime: "5 min read",
    author: "Xophal Team",
    published_at: "2026-07-09T09:00:00.000Z",
    coverTone: "from-sky-600 via-emerald-500 to-lime-400",
    contentHtml: `
      <p>Many students prepare for exams by reading long notes repeatedly, but mock tests sharpen accuracy and speed in a different way.</p>
      <p>A simple plan is to take one mini-test every 2–3 days. Use the results to identify weak chapters and revise them immediately rather than waiting for the next unit test.</p>
      <p>After every mock, spend five minutes reviewing mistakes. Ask three questions: What was the weak point? Was it due to concept confusion or careless reading? What will I do next time?</p>
      <p>That rhythm of test → review → revise helps students become more exam-ready without stress.</p>
    `,
  },
];

export function getDemoPostBySlug(slug: string) {
  return blogDemoPosts.find((post) => post.slug === slug);
}
