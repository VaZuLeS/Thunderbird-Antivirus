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

  const safeEl = doc.createElement('div');
  const safeHasAttributes = safeEl.hasAttributes;
  const safeRemoveAttribute = safeEl.removeAttribute;

  let protoForTagName = Object.getPrototypeOf(safeEl);
  while (protoForTagName && !Object.getOwnPropertyDescriptor(protoForTagName, 'tagName')) {
      protoForTagName = Object.getPrototypeOf(protoForTagName);
  }
  const safeGetTagName = Object.getOwnPropertyDescriptor(protoForTagName, 'tagName')!.get!;

  let protoForAttributes = Object.getPrototypeOf(safeEl);
  while (protoForAttributes && !Object.getOwnPropertyDescriptor(protoForAttributes, 'attributes')) {
      protoForAttributes = Object.getPrototypeOf(protoForAttributes);
  }
  const safeGetAttributes = Object.getOwnPropertyDescriptor(protoForAttributes, 'attributes')!.get!;

  let protoForParentNode = Object.getPrototypeOf(safeEl);
  while (protoForParentNode && !Object.getOwnPropertyDescriptor(protoForParentNode, 'parentNode')) {
      protoForParentNode = Object.getPrototypeOf(protoForParentNode);
  }
  const safeGetParentNode = Object.getOwnPropertyDescriptor(protoForParentNode, 'parentNode')!.get!;

  let protoForRemoveChild = Object.getPrototypeOf(safeEl);
  while (protoForRemoveChild && !Object.getOwnPropertyDescriptor(protoForRemoveChild, 'removeChild')) {
      protoForRemoveChild = Object.getPrototypeOf(protoForRemoveChild);
  }
  const safeRemoveChild = Object.getOwnPropertyDescriptor(protoForRemoveChild, 'removeChild')!.value;

  let protoForNodeType = Object.getPrototypeOf(safeEl);
  while (protoForNodeType && !Object.getOwnPropertyDescriptor(protoForNodeType, 'nodeType')) {
      protoForNodeType = Object.getPrototypeOf(protoForNodeType);
  }
  const safeGetNodeType = Object.getOwnPropertyDescriptor(protoForNodeType, 'nodeType')!.get!;

  const safeTemplate = doc.createElement('template');
  let protoForContent = Object.getPrototypeOf(safeTemplate);
  while (protoForContent && !Object.getOwnPropertyDescriptor(protoForContent, 'content')) {
      protoForContent = Object.getPrototypeOf(protoForContent);
  }
  const safeGetContent = Object.getOwnPropertyDescriptor(protoForContent, 'content')!.get!;

  function processRoot(root: Node) {
    const walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
    let el = walker.currentNode as Element;
    while (el) {
        if (safeGetNodeType.call(el) === 1) {
            const tagName = (safeGetTagName.call(el) as string).toLowerCase();
            if (activeTags.has(tagName)) {
                nodesToRemove.push(el);
            } else {
                if (safeHasAttributes.call(el)) {
                    const attrs = safeGetAttributes.call(el) as NamedNodeMap;
                    for (let j = attrs.length - 1; j >= 0; j--) {
                        const attrName = attrs[j].name.toLowerCase();
                        if (attrName.startsWith('on') || ['style', 'src', 'srcset', 'background', 'poster', 'ping'].includes(attrName)) {
                            safeRemoveAttribute.call(el, attrName);
                            continue;
                        }
                        if (dangerousAttributes.has(attrName)) {
                            let val = attrs[j].value.toLowerCase();
                            let cleanVal = val.replace(DANGEROUS_URI_CHARS_REGEX, '');
                            if (cleanVal.startsWith('javascript:') || cleanVal.startsWith('data:') || cleanVal.startsWith('vbscript:')) {
                                safeRemoveAttribute.call(el, attrName);
                            }
                        }
                    }
                }
                if (tagName === 'template') {
                    const content = safeGetContent.call(el) as DocumentFragment | null;
                    if (content) {
                        processRoot(content);
                    }
                }
            }
        }
        el = walker.nextNode() as Element;
    }
  }

  processRoot(doc.documentElement);

  for (let i = nodesToRemove.length - 1; i >= 0; i--) {
      const pNode = safeGetParentNode.call(nodesToRemove[i]) as Node | null;
      if (pNode) {
          safeRemoveChild.call(pNode, nodesToRemove[i]);
      }
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
