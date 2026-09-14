/** Map Milvus collection load-state strings to Chinese labels. */
export function formatCollectionState(state: string | undefined | null): string {
  if (!state) return "—";
  const s = state.toLowerCase();
  if (s === "loadstateloaded" || s === "loaded") return "已加载";
  if (s === "loadstatenotload" || s === "notload" || s === "not_load") return "未加载";
  if (s === "loadstateloading" || s === "loading") return "加载中";
  if (s === "loadstatenotexist" || s === "notexist") return "不存在";
  if (s.includes("release")) return "释放中";
  if (s === "unknown") return "未知";
  return state;
}
