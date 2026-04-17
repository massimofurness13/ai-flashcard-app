import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseXML } from "../../src/lib/import-xml";

const fixturesDir = join(__dirname, "../fixtures");

describe("parseXML", () => {
  it("parses standard <cards><card><front>/<back> format", () => {
    const xml = `
      <cards>
        <card><front>Hello</front><back>Hola</back></card>
        <card><front>Goodbye</front><back>Adiós</back></card>
      </cards>
    `;
    const cards = parseXML(xml);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ front: "Hello", back: "Hola" });
    expect(cards[1]).toEqual({ front: "Goodbye", back: "Adiós" });
  });

  it("handles nested <deck><cards><card> wrapper", () => {
    const xml = `
      <deck>
        <cards>
          <card><front>foo</front><back>bar</back></card>
        </cards>
      </deck>
    `;
    const cards = parseXML(xml);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({ front: "foo", back: "bar" });
  });

  it("matches <question>/<answer> variant", () => {
    const xml = `<cards><card><question>2+2</question><answer>4</answer></card></cards>`;
    const cards = parseXML(xml);
    expect(cards).toEqual([{ front: "2+2", back: "4" }]);
  });

  it("matches <term>/<definition> variant", () => {
    const xml = `<cards><card><term>photosynthesis</term><definition>plants making food</definition></card></cards>`;
    const cards = parseXML(xml);
    expect(cards).toEqual([
      { front: "photosynthesis", back: "plants making food" },
    ]);
  });

  it("extracts optional hint and tags", () => {
    const xml = `
      <cards>
        <card>
          <front>Spain capital</front>
          <back>Madrid</back>
          <hint>Starts with M</hint>
          <tags>geography,europe</tags>
        </card>
      </cards>
    `;
    const cards = parseXML(xml);
    expect(cards[0]).toEqual({
      front: "Spain capital",
      back: "Madrid",
      hint: "Starts with M",
      tags: "geography,europe",
    });
  });

  it("handles single card (not array)", () => {
    const xml = `<cards><card><front>alone</front><back>solo</back></card></cards>`;
    const cards = parseXML(xml);
    expect(cards).toHaveLength(1);
  });

  it("filters out cards missing front or back", () => {
    const xml = `
      <cards>
        <card><front>only front</front></card>
        <card><back>only back</back></card>
        <card><front>valid</front><back>card</back></card>
      </cards>
    `;
    const cards = parseXML(xml);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("valid");
  });

  it("returns empty array for malformed XML", () => {
    expect(parseXML("<not closed")).toEqual([]);
    expect(parseXML("")).toEqual([]);
  });

  describe("attribute-based TTS format", () => {
    it("parses <tts name='Text'>/<tts name='Translation'> format", () => {
      const xml = `
        <deck name="Spanish Phrases">
          <cards>
            <card>
              <tts name='Text'>¡Pide un deseo!</tts>
              <tts name='Translation'>Make a wish!</tts>
            </card>
            <card>
              <tts name='Text'>No conocemos Madrid.</tts>
              <tts name='Translation'>We don't know Madrid.</tts>
            </card>
          </cards>
        </deck>
      `;
      const cards = parseXML(xml);
      expect(cards).toHaveLength(2);
      expect(cards[0].front).toBe("¡Pide un deseo!");
      expect(cards[0].back).toBe("Make a wish!");
      expect(cards[1].front).toBe("No conocemos Madrid.");
      expect(cards[1].back).toBe("We don't know Madrid.");
    });

    it("parses the real Verbos Utlies.xml file with 101 cards", () => {
      const content = readFileSync(
        join(fixturesDir, "verbos-utlies.xml"),
        "utf8"
      );
      const cards = parseXML(content);
      expect(cards.length).toBe(101);
      // Sanity-check a specific card round-trips correctly
      expect(cards[0].front).toBe("¡Pide un deseo!");
      expect(cards[0].back).toBe("Make a wish!");
      expect(cards[cards.length - 1].front).toBe("Salimos a comer.");
      expect(cards[cards.length - 1].back).toBe("We went out to eat.");
      // Every card must have non-empty front and back
      for (const card of cards) {
        expect(card.front.length).toBeGreaterThan(0);
        expect(card.back.length).toBeGreaterThan(0);
      }
    });
  });
});
