/**
 * Resolve the effective response mode of a question: an explicit
 * response_mode wins; otherwise infer from question_type.
 */
export function resolveResponseMode(q: {
  response_mode?: string;
  question_type: string;
}): string {
  if (q.response_mode) return q.response_mode;
  if (
    q.question_type === "multiple_choice" ||
    q.question_type === "multiple_select" ||
    q.question_type === "true_false" ||
    q.question_type === "listening" ||
    q.question_type === "listening_comprehension"
  ) {
    return "choice";
  }
  if (
    q.question_type === "speaking" ||
    q.question_type === "speaking_response"
  ) {
    return "speech";
  }
  return "text";
}
