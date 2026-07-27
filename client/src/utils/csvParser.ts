/**
 * Chunked CSV Parser for handling large files (up to 5M+ entries)
 * Parses CSV in chunks to avoid blocking the UI and memory issues.
 */

export interface ParsedEntry {
  ticketNumber: string;
  participantName: string;
}

export interface CSVParseResult {
  competitionId: string;    // Added to map to the new database tracking audit layers
  competitionTitle: string;
  entries: ParsedEntry[];
  totalEntries: number;
}

/**
 * Parse CSV file with chunked processing
 * @param file - The CSV file to parse
 * @param onProgress - Callback for progress updates (0-100)
 * @returns Parsed CSV data
 */
export async function parseCSVChunked(
  file: File,
  onProgress?: (progress: number) => void
): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const chunkSize = 2 * 1024 * 1024; // 2MB chunk buffer optimization
    let offset = 0;
    
    // Store lines iteratively to minimize raw string allocation footprints
    let lines: string[] = [];
    let partialLine = "";

    const readNextChunk = () => {
      const blob = file.slice(offset, offset + chunkSize);
      reader.readAsText(blob);
    };

    reader.onload = (e) => {
      try {
        const chunk = e.target?.result as string;
        if (!chunk) return;

        // Prepend any left-over text fragment from the previous chunk boundaries
        const combined = partialLine + chunk;
        const chunkLines = combined.split("\n");

        // The last element is either empty or an incomplete line segment
        partialLine = chunkLines.pop() || "";

        // Push completed segments to memory list
        for (let i = 0; i < chunkLines.length; i++) {
          lines.push(chunkLines[i]);
        }

        offset += chunkSize;
        const progress = Math.min((offset / file.size) * 100, 100);
        onProgress?.(progress);

        if (offset < file.size) {
          readNextChunk();
        } else {
          // Process trailing fragment if text exists
          if (partialLine.trim()) {
            lines.push(partialLine);
          }
          
          // Compile final standardized structure
          const result = compileParsedData(lines);
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    readNextChunk();
  });
}

/**
 * Iterates compiled lines to construct competition records safely
 */
function compileParsedData(lines: string[]): CSVParseResult {
  if (lines.length < 2) {
    throw new Error("CSV must have at least a title row and one entry row");
  }

  // Parse first row for competition title
  const titleRow = parseCSVLine(lines[0]);
  const competitionTitle = titleRow[0]?.trim() || "Untitled Competition";

  const entries: ParsedEntry[] = [];

  // Parse records iteratively
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue; // Skip blank lines

    const columns = parseCSVLine(line);
    const ticketNumber = columns[0]?.trim();
    const participantName = columns[1]?.trim();

    if (ticketNumber && participantName) {
      entries.push({
        ticketNumber,
        participantName,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error("No valid entries found in CSV");
  }

  return {
    competitionId: crypto.randomUUID(), // Automatically provision identifier
    competitionTitle,
    entries,
    totalEntries: entries.length,
  };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Validate CSV format structure bounds
 */
export function validateCSVFormat(file: File): string | null {
  if (!file) {
    return "No file selected";
  }

  const validExtensions = [".csv", ".xlsx", ".xls"];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return "Please upload a CSV, XLSX, or XLS file";
  }

  // Cap size constraints systematically at 100MB
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return "File size exceeds 100MB limit";
  }

  return null;
}