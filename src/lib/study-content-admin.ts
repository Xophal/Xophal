export const STUDY_CONTENT_RESOURCES = [
  { key: "boards", label: "Boards" },
  { key: "classes", label: "Classes" },
  { key: "subjects", label: "Subjects" },
  { key: "chapters", label: "Chapters" },
  { key: "topics", label: "Topics" },
  { key: "questions", label: "Questions" },
  { key: "mock_tests", label: "Mock tests" },
  { key: "notes", label: "Notes" },
] as const;

export type StudyContentResource = (typeof STUDY_CONTENT_RESOURCES)[number]["key"];
export type StudyContentScope = StudyContentResource | "all";

export const STUDY_CONTENT_RESOURCE_LABELS = Object.fromEntries(
  STUDY_CONTENT_RESOURCES.map(({ key, label }) => [key, label])
) as Record<StudyContentResource, string>;

export const DELETE_ALL_STUDY_CONTENT_CONFIRMATION = "DELETE ALL STUDY CONTENT";

export function getDeleteSectionConfirmation(resource: StudyContentResource) {
  return `DELETE ALL ${STUDY_CONTENT_RESOURCE_LABELS[resource].toUpperCase()}`;
}
