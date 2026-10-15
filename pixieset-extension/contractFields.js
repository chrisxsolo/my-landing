// Update the session type in existing portrait-contract templates, including
// templates where bold/italic spans split the phrase across text nodes.
function replaceContractSessionType(textNodes, sessionType) {
  let offset = 0;
  const segments = textNodes.map(node => {
    const segment = { node, offset, length: node.nodeValue.length };
    offset += segment.length;
    return segment;
  });
  const text = textNodes.map(node => node.nodeValue).join("");
  const pattern = /\bportrait\s+session\s+of\s+([^\r\n]+?)(?=\s*\(\s*the\s+[“"]Portrait Session[”"]\s*\))/gi;
  const matches = [...text.matchAll(pattern)].filter(match => match[1] !== sessionType);
  const changedNodes = new Set();

  for (const match of matches.toReversed()) {
    const start = match.index + match[0].length - match[1].length;
    const end = start + match[1].length;
    for (const segment of segments) {
      if (segment.offset >= end || segment.offset + segment.length <= start) continue;
      const localStart = Math.max(0, start - segment.offset);
      const localEnd = Math.min(segment.length, end - segment.offset);
      const replacement = start >= segment.offset ? sessionType : "";
      segment.node.nodeValue = segment.node.nodeValue.slice(0, localStart)
        + replacement + segment.node.nodeValue.slice(localEnd);
      changedNodes.add(segment.node);
    }
  }

  for (const node of changedNodes) {
    node.parentElement?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return matches.length;
}
