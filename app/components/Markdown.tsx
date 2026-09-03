import { Fragment, type ReactNode } from "react";

/**
 * A small, dependency-free markdown renderer covering what a chat reply
 * actually uses. It builds React elements directly — nothing is ever passed
 * through dangerouslySetInnerHTML, so model output can't inject markup.
 */

type Inline = { text: string; key: string };

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-i${i++}`;

    if (token.startsWith("`")) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const href = match[6];
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  let key = 0;
  const nextKey = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF while streaming)
      blocks.push(
        <pre key={nextKey()}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Headings
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const k = nextKey();
      const content = renderInline(heading[2], k);
      blocks.push(
        heading[1].length === 1 ? (
          <h1 key={k}>{content}</h1>
        ) : heading[1].length === 2 ? (
          <h2 key={k}>{content}</h2>
        ) : (
          <h3 key={k}>{content}</h3>
        ),
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(
        <hr key={nextKey()} style={{ border: 0, borderTop: "1px solid var(--line)" }} />,
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      const k = nextKey();
      blocks.push(<blockquote key={k}>{renderInline(body.join(" "), k)}</blockquote>);
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Inline[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push({ text: lines[i].replace(/^\s*\d+[.)]\s+/, ""), key: `o${i}` });
        i += 1;
      }
      blocks.push(
        <ol key={nextKey()}>
          {items.map((item) => (
            <li key={item.key}>{renderInline(item.text, item.key)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Bullet list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: Inline[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push({ text: lines[i].replace(/^\s*[-*•]\s+/, ""), key: `u${i}` });
        i += 1;
      }
      blocks.push(
        <ul key={nextKey()}>
          {items.map((item) => (
            <li key={item.key}>{renderInline(item.text, item.key)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```") &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    const k = nextKey();
    blocks.push(
      <p key={k}>
        {para.map((l, idx) => (
          <Fragment key={`${k}-l${idx}`}>
            {idx > 0 && <br />}
            {renderInline(l, `${k}-l${idx}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <>{blocks}</>;
}
