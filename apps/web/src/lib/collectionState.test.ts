import { describe, expect, it } from "vitest";
import { formatCollectionState } from "./collectionState";

describe("formatCollectionState", () => {
  it("maps LoadStateLoaded", () => {
    expect(formatCollectionState("LoadStateLoaded")).toBe("已加载");
    expect(formatCollectionState("loaded")).toBe("已加载");
  });

  it("maps LoadStateNotLoad", () => {
    expect(formatCollectionState("LoadStateNotLoad")).toBe("未加载");
  });

  it("maps loading and not exist", () => {
    expect(formatCollectionState("LoadStateLoading")).toBe("加载中");
    expect(formatCollectionState("LoadStateNotExist")).toBe("不存在");
  });

  it("handles empty and unknown", () => {
    expect(formatCollectionState("")).toBe("—");
    expect(formatCollectionState(undefined)).toBe("—");
    expect(formatCollectionState("Unknown")).toBe("未知");
  });
});
