import { Fragment } from "react";

type AnalysisCardProps = {
  content: string;
  loadingText: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-green-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-green-primary">
          {part.slice(1, -1)}
        </strong>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function cleanLine(line: string) {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^\*([^*]+)\*$/, "$1")
    .trim();
}

function isTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function parseTableRow(line: string) {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

type TextBlock =
  | {
      type: "line";
      value: string;
    }
  | {
      type: "table";
      rows: string[][];
    };

function getBlocks(lines: string[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isTableLine(line)) {
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const rows = tableLines.map(parseTableRow).filter((row) => !isSeparatorRow(row));

      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
      }

      continue;
    }

    blocks.push({ type: "line", value: line });
    index += 1;
  }

  return blocks;
}

export function AnalysisCard({ content, loadingText }: AnalysisCardProps) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-border-subtle border-l-[3px] border-l-green-primary bg-bg-elevated p-5 text-sm leading-7 text-grey-300 shadow-[0_0_24px_rgba(26,255,102,0.08)]">
        {loadingText}
      </div>
    );
  }

  const blocks = getBlocks(lines);

  return (
    <div className="mt-5 space-y-5 rounded-2xl border border-border-subtle border-l-[3px] border-l-green-primary bg-bg-elevated p-6 shadow-[0_0_24px_rgba(26,255,102,0.08)]">
      {blocks.map((block, index) => {
        if (block.type === "table") {
          const [headerRow, ...bodyRows] = block.rows;

          return (
            <div
              key={`table-${index}`}
              className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-card"
            >
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {headerRow.map((cell) => (
                      <th
                        key={cell}
                        className="whitespace-nowrap px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                      >
                        {renderInline(cleanLine(cell))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rowIndex) => (
                    <tr
                      key={`${row.join("-")}-${rowIndex}`}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${cell}-${cellIndex}`}
                          className="px-4 py-3 align-top text-grey-100"
                        >
                          {renderInline(cleanLine(cell))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const line = block.value;

        if (/^-{3,}$/.test(line)) {
          return <hr key={`${line}-${index}`} className="border-border-subtle" />;
        }

        if (line.startsWith("# ")) {
          return (
            <h3
              key={`${line}-${index}`}
              className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-green-primary"
            >
              {cleanLine(line)}
            </h3>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <h4
              key={`${line}-${index}`}
              className="pt-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-green-primary"
            >
              {cleanLine(line)}
            </h4>
          );
        }

        if (line.startsWith("### ")) {
          return (
            <h5
              key={`${line}-${index}`}
              className="rounded-lg border border-border-subtle bg-bg-card px-4 py-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-grey-100"
            >
              {cleanLine(line)}
            </h5>
          );
        }

        if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
          return (
            <div
              key={`${line}-${index}`}
              className="rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-sm leading-7 text-grey-100"
            >
              <span className="mr-2 font-mono text-green-primary">⬡</span>
              {renderInline(cleanLine(line))}
            </div>
          );
        }

        return (
          <p key={`${line}-${index}`} className="text-sm leading-7 text-grey-300">
            {renderInline(cleanLine(line))}
          </p>
        );
      })}
    </div>
  );
}
