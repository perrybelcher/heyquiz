/** Resolve a visual outline drop against storage order, which can interleave pages. */
export function outlineDropTarget(
  questions: readonly { id: string; pageId?: string }[],
  outlineIds: readonly string[],
  activeId: string,
  overId: string,
  fallbackPageId: string,
): { beforeId: string | null; targetPageId: string } | null {
  const from = outlineIds.indexOf(activeId), to = outlineIds.indexOf(overId);
  const target = questions.find(question => question.id === overId);
  if (from < 0 || to < 0 || from === to || !target) return null;
  const remaining = questions.filter(question => question.id !== activeId);
  const targetIndex = remaining.findIndex(question => question.id === overId);
  return {
    beforeId: from < to ? remaining[targetIndex + 1]?.id || null : overId,
    targetPageId: target.pageId || fallbackPageId,
  };
}
