export type QuestionAccessContext = {
  viewerId: string | null;
  viewerRole?: string | null;
  authorId: string;
  instructorId: string;
  visibility: "PUBLIC" | "PRIVATE";
  isEnrolled?: boolean;
};

export function canReadQuestion(context: QuestionAccessContext): boolean {
  if (context.visibility === "PUBLIC") return true;
  return Boolean(
    context.viewerId &&
      (context.viewerId === context.authorId ||
        context.viewerId === context.instructorId ||
        context.viewerRole === "ADMIN"),
  );
}

export function canAnswerQuestion(context: QuestionAccessContext): boolean {
  if (!canReadQuestion(context) || !context.viewerId) return false;
  if (
    context.viewerId === context.instructorId ||
    context.viewerRole === "ADMIN"
  ) {
    return true;
  }
  if (context.visibility === "PRIVATE") {
    return context.viewerId === context.authorId;
  }
  return Boolean(context.isEnrolled);
}
