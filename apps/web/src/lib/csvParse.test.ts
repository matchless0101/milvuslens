import { describe, expect, it } from "vitest";

// Mirror ImportDialog CSV helpers for unit coverage
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

describe("csv parse", () => {
  it("parses header and rows", () => {
    const rows = parseCsv("id,text\na,hello\nb,\"hi, there\"");
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("a");
    expect(rows[1].text).toBe("hi, there");
  });

  it("handles escaped quotes", () => {
    const rows = parseCsv('id,text\n1,"say ""hi"""');
    expect(rows[0].text).toBe('say "hi"');
  });

  it("returns empty for header only", () => {
    expect(parseCsv("id,text")).toEqual([]);
  });
});
