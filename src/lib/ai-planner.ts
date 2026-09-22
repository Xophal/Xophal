export interface StudyPlanInput {
  goal: string;
  board?: string;
  className?: string;
  topics?: string[];
}

export interface StudyPlanDay {
  day: string;
  theme: string;
  focus: string;
  durationMinutes: number;
}

export interface StudyPlan {
  title: string;
  summary: string;
  days: StudyPlanDay[];
}

export function buildFallbackStudyPlan(input: StudyPlanInput): StudyPlan {
  const board = input.board ?? "CBSE";
  const className = input.className ?? "Class 10";
  const topics = input.topics?.length ? input.topics : ["Core concepts", "Practice questions"];

  const days: StudyPlanDay[] = [
    { day: "Day 1", theme: "Foundation", focus: `Review ${topics[0]}`, durationMinutes: 60 },
    { day: "Day 2", theme: "Practice", focus: `Solve practice questions for ${topics[0]}`, durationMinutes: 70 },
    { day: "Day 3", theme: "Retention", focus: `Revise notes and weak points around ${topics[0]}`, durationMinutes: 55 },
    { day: "Day 4", theme: "Application", focus: `Work through ${topics[1]}`, durationMinutes: 65 },
    { day: "Day 5", theme: "Mixed Review", focus: `Attempt a short mixed quiz covering both topics`, durationMinutes: 75 },
    { day: "Day 6", theme: "Exam Simulation", focus: "Take a timed mock test and review errors", durationMinutes: 90 },
    { day: "Day 7", theme: "Recovery", focus: "Clean up notes and plan next week", durationMinutes: 45 },
  ];

  return {
    title: `${board} ${className} study plan`,
    summary: `A practical 7-day starter plan for ${input.goal}.`,
    days,
  };
}
