// Tests execute the delivered HTML, not a duplicated gameplay implementation.
// Whitespace normalization keeps extraction stable after source-only formatting.
export function compactJS(source) {
  let result = '';
  for (let i = 0; i < source.length;) {
    const c = source[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      result += source[i++];
      while (i < source.length) {
        const next = source[i++];
        result += next;
        if (next === '\\' && i < source.length) result += source[i++];
        else if (next === quote) break;
      }
    } else if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
    } else if (/\s/.test(c)) {
      while (/\s/.test(source[i] || '') && i < source.length) i++;
      if (/[\w$]/.test(result.at(-1) || '') && /[\w$]/.test(source[i] || '')) result += ' ';
    } else {
      result += c;
      i++;
    }
  }
  return result;
}
