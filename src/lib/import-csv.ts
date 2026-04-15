export interface ParsedCard {
  front: string;
  back: string;
  hint?: string;
  tags?: string;
}

export function parseCSV(content: string): ParsedCard[] {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return [];

  // Auto-detect delimiter
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  // Check if first row is a header
  const firstRow = parseLine(firstLine, delimiter);
  const hasHeader =
    firstRow.some((cell) =>
      ["front", "question", "term", "word"].includes(cell.toLowerCase())
    ) ||
    firstRow.some((cell) =>
      ["back", "answer", "definition", "meaning"].includes(cell.toLowerCase())
    );

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cells = parseLine(line, delimiter);
      if (cells.length < 2) return null;

      return {
        front: cells[0].trim(),
        back: cells[1].trim(),
        hint: cells[2]?.trim() || undefined,
        tags: cells[3]?.trim() || undefined,
      };
    })
    .filter((card): card is NonNullable<typeof card> & ParsedCard => card !== null && card.front.length > 0 && card.back.length > 0);
}

function parseLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}
