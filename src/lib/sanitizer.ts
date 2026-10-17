// Port of sanitize.js for safe client-side HTML rendering
const dangerousAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

const activeTags = new Set([
  'style', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 
  'source', 'script', 'object', 'embed', 'iframe', 'base', 'meta', 'applet', 
  'link', 'math', 'svg', 'noscript'
]);

const DANGEROUS_URI_CHARS_REGEX = /[\x00-\x20\x7F-\x9F\xA0\u1680\u180E\u2000-\u2029\u202F\u205F\u3000\u200B-\u200D\uFEFF\uFFFD]/g;

export function disarmHTML(htmlString: string): string {
  if (!htmlString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const nodesToRemove: Element[] = [];

  function processNode(node: Element) {
    const tagName = node.tagName.toLowerCase();
    if (activeTags.has(tagName)) {
      nodesToRemove.push(node);
      return;
    }

    // Process attributes
    const attrs = Array.from(node.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['style', 'src', 'srcset', 'background', 'poster', 'ping'].includes(name)) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (dangerousAttributes.has(name)) {
        let val = attr.value.toLowerCase().replace(DANGEROUS_URI_CHARS_REGEX, '');
        if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) {
          node.removeAttribute(attr.name);
        }
      }
    }

    // Process children
    const children = Array.from(node.children);
    for (const child of children) {
      processNode(child);
    }
  }

  processNode(doc.body);

  for (const el of nodesToRemove) {
    el.parentNode?.removeChild(el);
  }

  return doc.body.innerHTML;
}

export function extractLinksFromHtml(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["'](https?:\/\/[^"'>]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }
  return links;
}
