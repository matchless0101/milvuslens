/** Map Milvus collection state strings to Chinese labels. */
export function formatCollectionState(state: string | undefined | null): string {
  if (!state) return "—";
  const s = state.toLowerCase();
  if (s.includes("loaded") && !s.includes("not")) return "已加载";
  if (s.includes("notload") || s.includes("not_load") || s.includes("not load")) return "未加载";
  if (s.includes("loading")) return "加载中";
  if (s.includes("release")) return "释放中";
  return state;
}
