import { describe, expect, it } from "vitest";
import { parseEngineVocab } from "@/components/admin/EngineQuestionEditor";

const validVocab = {
  topics: [],
  subtopics: [],
  types: ["mcq"],
  statuses: ["draft"],
  reviewCounts: { draft: 1 },
};

describe("parseEngineVocab", () => {
  it("accepts array-shaped vocabulary from the API", () => {
    expect(parseEngineVocab(validVocab)).toEqual(validVocab);
  });

  it.each(["topics", "subtopics", "types", "statuses"] as const)(
    "rejects a non-array %s field before the UI maps it",
    (field) => {
      expect(() => parseEngineVocab({ ...validVocab, [field]: { value: "unexpected" } }))
        .toThrow(`Invalid question vocabulary response: ${field} must be an array.`);
    }
  );

  it("rejects a non-object reviewCounts value", () => {
    expect(() => parseEngineVocab({ ...validVocab, reviewCounts: [] }))
      .toThrow("Invalid question vocabulary response: reviewCounts must be an object.");
  });
});
