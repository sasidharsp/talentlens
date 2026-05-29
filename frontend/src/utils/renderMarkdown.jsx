/**
 * Simple markdown renderer for question text.
 * Handles: bold, italic, bullet lists, numbered lists, inline code, line breaks.
 */
export function renderMarkdown(text) {
  if (!text) return null;
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    // Unordered list block
    if (/^[-*•]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin:'6px 0', paddingLeft:20, lineHeight:1.8 }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom:2 }}>{inlineFormat(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+[.)]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin:'6px 0', paddingLeft:20, lineHeight:1.8 }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom:2 }}>{inlineFormat(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,3})/)[1].length;
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      const size = [18,16,14][level-1] || 14;
      elements.push(
        <div key={`h-${i}`} style={{ fontWeight:700, fontSize:size, color:'var(--text)', margin:'10px 0 4px' }}>
          {inlineFormat(content)}
        </div>
      );
      i++; continue;
    }

    // Regular line
    elements.push(
      <div key={`p-${i}`} style={{ lineHeight:1.75, marginBottom:2 }}>
        {inlineFormat(trimmed)}
      </div>
    );
    i++;
  }
  return <>{elements}</>;
}

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part)) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (/^\*.*\*$/.test(part))     return <em key={i}>{part.slice(1,-1)}</em>;
    if (/^`.*`$/.test(part))       return <code key={i} style={{ background:'var(--surface-2)', padding:'1px 5px', borderRadius:4, fontSize:'0.9em', fontFamily:'monospace' }}>{part.slice(1,-1)}</code>;
    return part;
  });
}
