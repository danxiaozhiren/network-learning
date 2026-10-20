/* Search highlighting only. Routing, filtering, keyboard shortcuts and styles belong to the catalog. */
(() => {
  'use strict';
  const OWNER = 'data-catalog-search';
  const LABELS = new Set(['关键词', '相关课程', '领域']);
  const SNIPPET_BUDGET = 100;

  function normalizeTerms(terms) {
    if (!Array.isArray(terms)) return [];
    return [...new Set(terms.filter(term => typeof term === 'string')
      .map(term => term.trim().toLocaleLowerCase()).filter(Boolean))];
  }

  // Preserve original UTF-16 offsets when case folding changes a character's length.
  function foldText(text) {
    let folded = '';
    const starts = [], ends = [];
    let offset = 0;
    for (const character of text) {
      const lower = character.toLocaleLowerCase();
      for (let i = 0; i < lower.length; i++) {
        starts.push(offset);
        ends.push(offset + character.length);
      }
      folded += lower;
      offset += character.length;
    }
    return { folded, starts, ends };
  }

  function mergeRanges(ranges) {
    const merged = [];
    ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(range => {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range.slice());
    });
    return merged;
  }

  function findRanges(text, terms) {
    if (!text || !terms.length) return [];
    const { folded, starts, ends } = foldText(text);
    const ranges = [];
    terms.forEach(term => {
      let from = 0;
      while (from < folded.length) {
        const index = folded.indexOf(term, from);
        if (index < 0) break;
        ranges.push([starts[index], ends[index + term.length - 1]]);
        from = index + 1;
      }
    });
    return mergeRanges(ranges);
  }

  function maskSize(mask) {
    let count = 0;
    while (mask) { mask &= mask - 1n; count++; }
    return count;
  }

  function chooseFields(sources, missingTerms) {
    if (!missingTerms.length) return [];
    const byMask = new Map();
    sources.forEach((source, index) => {
      const folded = foldText(source.text).folded;
      let mask = 0n;
      missingTerms.forEach((term, termIndex) => {
        if (folded.includes(term)) mask |= 1n << BigInt(termIndex);
      });
      if (!mask) return;
      const field = { ...source, index, mask };
      const old = byMask.get(mask);
      if (!old || field.text.length < old.text.length) byMask.set(mask, field);
    });
    let candidates = [...byMask.values()];
    // A field whose matches are a strict subset can never reduce the required field count.
    candidates = candidates.filter(field => !candidates.some(other =>
      field !== other && field.mask !== other.mask && (field.mask | other.mask) === other.mask));
    const target = candidates.reduce((mask, field) => mask | field.mask, 0n);
    if (!target) return [];

    // Greedy supplies an upper bound; the bounded search below finds the minimum field count.
    let covered = 0n;
    const greedy = [];
    while (covered !== target) {
      const next = candidates.slice().sort((a, b) =>
        maskSize(b.mask & ~covered) - maskSize(a.mask & ~covered) || a.text.length - b.text.length || a.index - b.index)[0];
      greedy.push(next); covered |= next.mask;
    }
    let best = greedy;
    const visited = new Map();
    function visit(mask, chosen) {
      if (mask === target) { if (chosen.length < best.length) best = chosen.slice(); return; }
      if (chosen.length + 1 >= best.length) return;
      if (visited.has(mask) && visited.get(mask) <= chosen.length) return;
      visited.set(mask, chosen.length);
      let options = null;
      for (let i = 0; i < missingTerms.length; i++) {
        const bit = 1n << BigInt(i);
        if (!(target & bit) || (mask & bit)) continue;
        const possible = candidates.filter(field => field.mask & bit);
        if (!options || possible.length < options.length) options = possible;
      }
      options.sort((a, b) => maskSize(b.mask & ~mask) - maskSize(a.mask & ~mask) || a.index - b.index)
        .forEach(field => visit(mask | field.mask, [...chosen, field]));
    }
    visit(0n, []);
    return best.sort((a, b) => a.index - b.index);
  }

  function makeSnippet(text, terms) {
    if (text.length <= SNIPPET_BUDGET) return text;
    // Keep one real occurrence of every term assigned to this field, rather than truncating the tail blindly.
    const core = mergeRanges(terms.map(term => findRanges(text, [term])[0]).filter(Boolean));
    if (!core.length) return '';
    const matchLength = core.reduce((sum, range) => sum + range[1] - range[0], 0);
    const context = Math.min(18, Math.max(0, Math.floor((SNIPPET_BUDGET - matchLength - core.length * 3) / (core.length * 2))));
    const ranges = mergeRanges(core.map(([start, end]) => {
      start = Math.max(0, start - context); end = Math.min(text.length, end + context);
      if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start])) start--;
      if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end])) end++;
      return [start, end];
    }));
    return (ranges[0][0] ? '…' : '') + ranges.map(([start, end]) => text.slice(start, end)).join(' … ') +
      (ranges[ranges.length - 1][1] < text.length ? '…' : '');
  }

  function clearMarks(row) {
    row.querySelectorAll(`mark[${OWNER}]`).forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function textSegments(element) {
    const segments = [];
    function collect(node, protectedMark = false) {
      if (node.nodeType === 3) { segments.push({ node, protectedMark }); return; }
      if (node.nodeType !== 1 || ['SCRIPT', 'STYLE'].includes(node.tagName) || node.hidden || node.getAttribute('aria-hidden') === 'true') return;
      [...node.childNodes].forEach(child => collect(child, protectedMark || node.tagName === 'MARK'));
    }
    collect(element);
    return segments;
  }

  function markText(element, terms) {
    const doc = element.ownerDocument;
    const segments = textSegments(element);
    const ranges = findRanges(segments.map(segment => segment.node.nodeValue).join(''), terms);
    let globalOffset = 0;
    segments.forEach(({ node, protectedMark }) => {
      const text = node.nodeValue;
      const offsetStart = globalOffset;
      globalOffset += text.length;
      if (protectedMark) return;
      const localRanges = ranges.filter(([start, end]) => end > offsetStart && start < globalOffset)
        .map(([start, end]) => [Math.max(0, start - offsetStart), Math.min(text.length, end - offsetStart)]);
      if (!localRanges.length) return;
      const fragment = doc.createDocumentFragment();
      let offset = 0;
      localRanges.forEach(([start, end]) => {
        if (start > offset) fragment.appendChild(doc.createTextNode(text.slice(offset, start)));
        const mark = doc.createElement('mark');
        mark.className = 'search-highlight';
        mark.setAttribute(OWNER, '');
        mark.textContent = text.slice(start, end);
        fragment.appendChild(mark);
        offset = end;
      });
      if (offset < text.length) fragment.appendChild(doc.createTextNode(text.slice(offset)));
      node.parentNode.replaceChild(fragment, node);
    });
  }

  function parseSources(row) {
    let sources;
    try { sources = JSON.parse(row.getAttribute('data-match-sources') || '[]'); } catch { return []; }
    if (!Array.isArray(sources)) return [];
    return sources.filter(source => source && LABELS.has(source.label) && typeof source.text === 'string' && source.text.trim());
  }

  function highlight(row, inputTerms) {
    if (!row || typeof row.querySelectorAll !== 'function') return;
    clearMarks(row);
    let explanation = row.querySelector(`.search-match[${OWNER}]`);
    if (explanation) { explanation.replaceChildren(); explanation.hidden = true; }
    const terms = normalizeTerms(inputTerms);
    if (!terms.length) return { sourceFields: 0, unexplainedTerms: [] };

    const targets = [...row.querySelectorAll('.course-title, .topic-description')].filter(element => {
      // The caller may reveal a parent panel later in the same render; trust its supplied terms.
      for (let ancestor = element; ancestor && ancestor !== row; ancestor = ancestor.parentElement) {
        if (ancestor.hidden || ancestor.getAttribute('aria-hidden') === 'true') return false;
      }
      return true;
    });
    const visibleTexts = targets.map(element => foldText(textSegments(element).map(segment => segment.node.nodeValue).join('')).folded);
    const missing = terms.filter(term => !visibleTexts.some(text => text.includes(term)));
    targets.forEach(element => markText(element, terms));
    const fields = chooseFields(parseSources(row), missing);
    const unexplainedTerms = missing.filter((term, index) => !fields.some(field => field.mask & (1n << BigInt(index))));
    const courseRow = row.querySelector('.course-row');
    if (!fields.length || !courseRow) return { sourceFields: 0, unexplainedTerms };

    const doc = row.ownerDocument;
    if (!explanation) {
      explanation = doc.createElement('p');
      explanation.className = 'search-match';
      explanation.setAttribute(OWNER, '');
    }
    courseRow.after(explanation);
    let explained = 0n;
    fields.forEach((field, fieldIndex) => {
      const neededTerms = missing.filter((term, index) => (field.mask & (1n << BigInt(index))) && !(explained & (1n << BigInt(index))));
      explained |= field.mask;
      if (fieldIndex) explanation.appendChild(doc.createTextNode(' · '));
      const item = doc.createElement('span');
      item.className = 'search-match-item';
      const label = doc.createElement('span');
      label.className = 'search-match-label';
      label.textContent = field.label + '：';
      const content = doc.createElement('span');
      content.className = 'search-match-text';
      content.textContent = makeSnippet(field.text, neededTerms);
      markText(content, terms);
      item.append(label, content);
      explanation.appendChild(item);
    });
    explanation.hidden = false;
    return { sourceFields: fields.length, unexplainedTerms };
  }

  window.CatalogSearch = Object.freeze({ highlight });
})();
