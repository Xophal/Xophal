import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-utils";

const TEMPLATES: Record<string, { headers: string[]; sample: string[] }> = {
  single_correct: {
    headers: ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["What is the capital of India?", "Mumbai", "Delhi", "Kolkata", "Chennai", "B", "Delhi is the capital.", "Geography", "Capitals", "easy", "1", "0", "en"],
  },
  multiple_correct: {
    headers: ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["Which are metals?", "Iron", "Oxygen", "Gold", "Carbon", "A,C", "Iron and Gold are metals.", "Chemistry", "Elements", "medium", "2", "0", "en"],
  },
  true_false: {
    headers: ["question", "option_a", "option_b", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["The Earth is flat.", "True", "False", "B", "The Earth is spherical.", "Science", "Earth", "easy", "1", "0", "en"],
  },
  fill_blank: {
    headers: ["question", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["The chemical symbol for water is ____.", "H2O", "Water contains two hydrogen atoms and one oxygen atom.", "Chemistry", "Compounds", "easy", "1", "0", "en"],
  },
  match_following: {
    headers: ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["Match each planet with its position.", "A=Mercury", "B=Earth", "C=Third", "D=First", "A-D,B-C", "Mercury is first and Earth is third.", "Science", "Solar System", "medium", "2", "0", "en"],
  },
  numerical: {
    headers: ["question", "correct_answer", "explanation", "chapter", "topic", "difficulty", "marks", "negative_marks", "language"],
    sample: ["What is 7 multiplied by 8?", "56", "7 times 8 equals 56.", "Mathematics", "Multiplication", "easy", "1", "0", "en"],
  },
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    await requireAdminAuth();
    const { type } = await context.params;
    const template = TEMPLATES[type];
    if (!template) throw new ApiError(404, "Template not found", "NOT_FOUND");

    const encode = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [template.headers, template.sample].map((row) => row.map(encode).join(","));
    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="xophal-${type}-template.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}