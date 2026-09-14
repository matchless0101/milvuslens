import { describe, expect, it } from "vitest";
import { translateError } from "./errors";

describe("translateError", () => {
  it("handles empty input", () => {
    expect(translateError(undefined)).toBe("未知错误");
    expect(translateError(null)).toBe("未知错误");
    expect(translateError("")).toBe("未知错误");
  });

  it("translates connection not found", () => {
    expect(translateError("Connection not found: abc")).toContain("连接已失效");
  });

  it("translates connection refused", () => {
    expect(translateError("connect ECONNREFUSED 127.0.0.1:19530")).toContain(
      "连接被拒绝"
    );
  });

  it("translates collection not loaded", () => {
    expect(translateError("collection not loaded")).toContain("集合未加载");
  });

  it("translates dimension mismatch", () => {
    expect(
      translateError("dimension mismatch: expected 128 got 768")
    ).toContain("向量维度不匹配");
  });

  it("returns short raw message with prefix", () => {
    expect(translateError("something odd")).toBe("操作失败：something odd");
  });
});
