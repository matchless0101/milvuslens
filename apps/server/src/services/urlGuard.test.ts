import { describe, expect, it } from "vitest";
import { validateEmbeddingUrl } from "./urlGuard";

describe("validateEmbeddingUrl", () => {
  it("accepts https public hosts", () => {
    const r = validateEmbeddingUrl("https://api.openai.com/v1");
    expect(r.ok).toBe(true);
  });

  it("accepts localhost for local embedding servers", () => {
    expect(validateEmbeddingUrl("http://127.0.0.1:11434/v1").ok).toBe(true);
    expect(validateEmbeddingUrl("http://localhost:8080").ok).toBe(true);
  });

  it("rejects non-http protocols", () => {
    expect(validateEmbeddingUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateEmbeddingUrl("gopher://evil").ok).toBe(false);
  });

  it("rejects cloud metadata endpoints", () => {
    expect(validateEmbeddingUrl("http://169.254.169.254/").ok).toBe(false);
    expect(validateEmbeddingUrl("http://metadata.google.internal/").ok).toBe(
      false
    );
  });

  it("rejects invalid URLs", () => {
    expect(validateEmbeddingUrl("not a url").ok).toBe(false);
  });
});
