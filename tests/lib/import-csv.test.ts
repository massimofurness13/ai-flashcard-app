import { describe, it, expect } from "vitest";
import { parseCSV } from "../../src/lib/import-csv";

describe("parseCSV", () => {
  it("parses comma-separated rows", () => {
    const csv = `front,back\nhello,hola\ngoodbye,adiós`;
    const cards = parseCSV(csv);
    expect(cards).toEqual([
      { front: "hello", back: "hola", hint: undefined, tags: undefined },
      { front: "goodbye", back: "adiós", hint: undefined, tags: undefined },
    ]);
  });

  it("parses tab-separated rows", () => {
    const csv = `front\tback\nhello\thola`;
    const cards = parseCSV(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("hello");
    expect(cards[0].back).toBe("hola");
  });

  it("detects header row by keyword", () => {
    const csv = `Question,Answer\nWhat is 2+2?,4`;
    const cards = parseCSV(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("What is 2+2?");
  });

  it("treats first row as data when no header keywords", () => {
    const csv = `apple,manzana\nhouse,casa`;
    const cards = parseCSV(csv);
    expect(cards).toHaveLength(2);
  });

  it("extracts optional hint and tags columns", () => {
    const csv = `front,back,hint,tags\ncat,gato,a pet,animals`;
    const cards = parseCSV(csv);
    expect(cards[0]).toEqual({
      front: "cat",
      back: "gato",
      hint: "a pet",
      tags: "animals",
    });
  });

  it("handles quoted fields with commas inside", () => {
    const csv = `front,back\n"Hello, friend","Hola, amigo"`;
    const cards = parseCSV(csv);
    expect(cards[0].front).toBe("Hello, friend");
    expect(cards[0].back).toBe("Hola, amigo");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = `front,back\n"She said ""hi""","Ella dijo ""hola"""`;
    const cards = parseCSV(csv);
    expect(cards[0].front).toBe('She said "hi"');
    expect(cards[0].back).toBe('Ella dijo "hola"');
  });

  it("filters out rows with missing front or back", () => {
    // Use a real header so first row isn't treated as data
    const csv = `front,back\n,onlyback\nonlyfront,\nvalid,card`;
    const cards = parseCSV(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("valid");
  });

  it("returns empty array for empty input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("   ")).toEqual([]);
  });

  it("picks tab delimiter when tabs outnumber commas", () => {
    const csv = `front\tback\thint\nhola\tgoodbye\tsimple`;
    const cards = parseCSV(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("hola");
    expect(cards[0].back).toBe("goodbye");
    expect(cards[0].hint).toBe("simple");
  });
});
