import { v4 as uuid } from "uuid";
import type { Question } from "@/types";

export const demoQuestions: Question[] = [
  {
    id: uuid(),
    question_type_id: "mcq",
    difficulty_level_id: null,
    language_id: null,
    topic_id: null,
    chapter_id: null,
    subject_id: null,
    question_text: "Which of the following is a chemical change?",
    question_html: null,
    explanation: "Rusting of iron is a chemical change where new substances are formed.",
    explanation_html: null,
    image_url: null,
    marks: 1,
    negative_marks: 0,
    time_seconds: 90,
    is_active: true,
    options: [
      { id: uuid(), question_id: "", option_text: "Melting of ice", option_html: null, image_url: null, is_correct: false, sort_order: 1 },
      { id: uuid(), question_id: "", option_text: "Rusting of iron", option_html: null, image_url: null, is_correct: true, sort_order: 2 },
      { id: uuid(), question_id: "", option_text: "Dissolving sugar in water", option_html: null, image_url: null, is_correct: false, sort_order: 3 },
      { id: uuid(), question_id: "", option_text: "Freezing of water", option_html: null, image_url: null, is_correct: false, sort_order: 4 },
    ],
  },
  {
    id: uuid(),
    question_type_id: "mcq",
    difficulty_level_id: null,
    language_id: null,
    topic_id: null,
    chapter_id: null,
    subject_id: null,
    question_text: "What is the value of x if 2x + 3 = 11?",
    question_html: null,
    explanation: "2x = 8, so x = 4.",
    explanation_html: null,
    image_url: null,
    marks: 1,
    negative_marks: 0,
    time_seconds: 60,
    is_active: true,
    options: [
      { id: uuid(), question_id: "", option_text: "2", option_html: null, image_url: null, is_correct: false, sort_order: 1 },
      { id: uuid(), question_id: "", option_text: "4", option_html: null, image_url: null, is_correct: true, sort_order: 2 },
      { id: uuid(), question_id: "", option_text: "6", option_html: null, image_url: null, is_correct: false, sort_order: 3 },
      { id: uuid(), question_id: "", option_text: "8", option_html: null, image_url: null, is_correct: false, sort_order: 4 },
    ],
  },
  {
    id: uuid(),
    question_type_id: "mcq",
    difficulty_level_id: null,
    language_id: null,
    topic_id: null,
    chapter_id: null,
    subject_id: null,
    question_text: "Which gas is released when vinegar reacts with baking soda?",
    question_html: null,
    explanation: "The reaction produces carbon dioxide gas.",
    explanation_html: null,
    image_url: null,
    marks: 1,
    negative_marks: 0,
    time_seconds: 90,
    is_active: true,
    options: [
      { id: uuid(), question_id: "", option_text: "Oxygen", option_html: null, image_url: null, is_correct: false, sort_order: 1 },
      { id: uuid(), question_id: "", option_text: "Hydrogen", option_html: null, image_url: null, is_correct: false, sort_order: 2 },
      { id: uuid(), question_id: "", option_text: "Carbon dioxide", option_html: null, image_url: null, is_correct: true, sort_order: 3 },
      { id: uuid(), question_id: "", option_text: "Nitrogen", option_html: null, image_url: null, is_correct: false, sort_order: 4 },
    ],
  },
];

// attach question_id to options for type consistency
for (const q of demoQuestions) {
  q.options = q.options?.map((o) => ({ ...o, question_id: q.id }));
}

export default demoQuestions;
