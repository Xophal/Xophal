export interface LearnPathParams {
  boardSlug?: string | null;
  classSlug?: string | null;
  subjectSlug?: string | null;
  chapterSlug?: string | null;
}

export function buildLearnPath(params: LearnPathParams) {
  const searchParams = new URLSearchParams();

  if (params.boardSlug) searchParams.set("boardSlug", params.boardSlug);
  if (params.classSlug) searchParams.set("classSlug", params.classSlug);
  if (params.subjectSlug) searchParams.set("subjectSlug", params.subjectSlug);
  if (params.chapterSlug) searchParams.set("chapterSlug", params.chapterSlug);

  const queryString = searchParams.toString();
  return queryString ? `/learn?${queryString}` : "/learn";
}
