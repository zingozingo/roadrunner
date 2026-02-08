/**
 * Parses a structured summary string into sections and renders them
 * with proper formatting. Expects sections delimited by bold headers
 * like **Participants:**, **Current State:**, etc.
 */

const SECTION_HEADERS = [
  "Participants",
  "Current State",
  "Timeline",
  "Open Items",
  "Key Context",
] as const;

const HEADER_PATTERN = /\*\*([^*]+):\*\*/g;

interface SummarySection {
  header: string;
  content: string;
}

function parseSummary(raw: string): SummarySection[] {
  const sections: SummarySection[] = [];
  const matches = [...raw.matchAll(HEADER_PATTERN)];

  if (matches.length === 0) {
    // No structured headers found — return as single section
    return [{ header: "Summary", content: raw.trim() }];
  }

  for (let i = 0; i < matches.length; i++) {
    const header = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    const content = raw.slice(start, end).trim();
    if (content) {
      sections.push({ header, content });
    }
  }

  return sections;
}

function renderSectionContent(header: string, content: string) {
  if (header === "Timeline") {
    // Parse [YYYY-MM-DD] entries into date-badged list
    const lines = content.split("\n").filter((l) => l.trim());
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => {
          const dateMatch = line.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)/);
          if (dateMatch) {
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 rounded bg-border px-1.5 py-0.5 font-mono text-xs text-muted">
                  {dateMatch[1]}
                </span>
                <span className="text-foreground/90">{dateMatch[2]}</span>
              </li>
            );
          }
          return (
            <li key={i} className="text-sm text-foreground/90">{line}</li>
          );
        })}
      </ul>
    );
  }

  if (header === "Open Items") {
    const items = content
      .split("\n")
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
    return (
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (header === "Participants") {
    const lines = content.split("\n").filter((l) => l.trim());
    return (
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-foreground/90">{line.replace(/^[-•]\s*/, "")}</p>
        ))}
      </div>
    );
  }

  // Default: paragraphs
  return (
    <div className="space-y-1.5">
      {content.split("\n").filter(Boolean).map((para, i) => (
        <p key={i} className="text-sm text-foreground/90">{para}</p>
      ))}
    </div>
  );
}

export default function SummaryCard({ summary }: { summary: string }) {
  const sections = parseSummary(summary);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Summary
      </h2>
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i}>
            {section.header !== "Summary" && (
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted/70">
                {section.header}
              </h3>
            )}
            {renderSectionContent(section.header, section.content)}
            {i < sections.length - 1 && (
              <div className="mt-4 border-b border-border/50" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
