import slugify from "slugify";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function createBlogSlug(title: string) {
  return slugify(title, { lower: true, strict: true, trim: true }) || "untitled-post";
}

export function estimateReadingMinutes(content: string) {
  const words = content
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`>\[\]()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

export async function renderBlogContent(content: string) {
  const html = await marked.parse(content);
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "del",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}