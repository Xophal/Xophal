import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { getMarketplaceConfig } from "@/lib/ebooks/config";

export async function GET() {
  try {
    const supabase = await createClient();
    const [{ data: categories, error: categoryError }, { data: subjects, error: subjectError }, { data: exams, error: examError }, config] = await Promise.all([
      supabase.from("ebook_categories").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("subjects").select("id, name, classes(name, boards(name))").eq("is_active", true).order("name").limit(500),
      supabase.from("exams").select("id, name").eq("is_active", true).order("name").limit(300),
      getMarketplaceConfig(),
    ]);
    if (categoryError) throw categoryError;
    if (subjectError) throw subjectError;
    if (examError) throw examError;
    return apiSuccess({ categories: categories ?? [], subjects: subjects ?? [], exams: exams ?? [], config });
  } catch (error) {
    return handleApiError(error);
  }
}
