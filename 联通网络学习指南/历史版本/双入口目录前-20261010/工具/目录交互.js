(() => {
  'use strict';
  const main = document.querySelector('.main');
  const panels = [...document.querySelectorAll('.module-panel')];
  const panelMap = new Map(panels.map(panel => [panel.dataset.module, panel]));
  const search = document.getElementById('course-search');
  const clearSearch = document.getElementById('clear-search');
  const readyButton = document.getElementById('ready-filter');
  const nav = document.getElementById('module-nav');
  const mobile = window.matchMedia('(max-width: 800px)');
  const header = document.getElementById('result-header');
  const sources = document.getElementById('sources');
  const empty = document.getElementById('empty');
  const legacy = document.body.dataset.legacyTransport === 'true';
  let selected = 'transport';
  let query = '';
  let readyOnly = false;
  let sourceMode = false;
  const isOverview = () => !location.hash || location.hash === '#top';
  nav.open = !mobile.matches || isOverview();
  mobile.addEventListener('change', event => { nav.open = !event.matches || isOverview(); });

  function render() {
    const filtering = Boolean(query.trim()) || readyOnly;
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    search.value = query;
    clearSearch.hidden = !query;
    readyButton.setAttribute('aria-pressed', String(readyOnly));
    main.classList.toggle('filtered', filtering);
    sources.hidden = !sourceMode;
    document.querySelector('.toolbar').hidden = sourceMode;
    document.querySelector('.list-end').hidden = sourceMode;
    header.hidden = sourceMode || !filtering;
    let shown = 0;
    let shownModules = 0;
    panels.forEach(panel => {
      const allowed = !sourceMode && (filtering || panel.dataset.module === selected);
      let matches = 0;
      panel.querySelectorAll('.course').forEach(row => {
        const match = allowed && (!readyOnly || row.dataset.ready === 'true') &&
          terms.every(term => row.dataset.search.includes(term));
        row.hidden = !match;
        if (match) matches++;
      });
      panel.querySelectorAll('.stage').forEach(stage => {
        stage.hidden = ![...stage.querySelectorAll('.course')].some(row => !row.hidden);
      });
      panel.hidden = !allowed || (filtering && matches === 0);
      const ready = [...panel.querySelectorAll('.course[data-ready="true"]')].length;
      panel.querySelector('.meta').textContent = filtering
        ? `${matches} 条匹配课程`
        : `${panel.dataset.total} 条课程 / ${ready} 份可读讲义`;
      if (!panel.hidden) shownModules++;
      shown += matches;
    });
    empty.hidden = sourceMode || !filtering || shown > 0;
    document.getElementById('result-title').textContent = query.trim() ? '搜索结果' : '可读讲义';
    document.getElementById('result-count').textContent = `${shown} 条${readyOnly ? '可读讲义' : '课程'} · ${shownModules} 个模块${query.trim() ? ' · “' + query.trim() + '”' : ''}`;
    const title = panelMap.get(selected).dataset.title;
    const back = document.getElementById('back-to-module');
    back.href = '#module-' + selected;
    back.textContent = '← 返回' + title;
    document.getElementById('mobile-selected').textContent = sourceMode ? '资料来源' : filtering ? (readyOnly ? '可读讲义' : '搜索结果') : title;
    document.querySelectorAll('[data-module-link]').forEach(link => {
      if (!sourceMode && !filtering && link.dataset.moduleLink === selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function readRoute(scroll = true) {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    query = ''; readyOnly = false; sourceMode = false;
    let target = null;
    if (hash.startsWith('search?')) {
      // Parse the original encoded string so a literal & inside a query stays intact.
      const params = new URLSearchParams(location.hash.slice(1).slice(7));
      query = params.get('q') || '';
      readyOnly = params.get('readable') === '1';
    } else if (hash === 'readable') readyOnly = true;
    else if (hash === 'sources' || hash === 'workflow') sourceMode = true;
    else if (legacy && hash === 'transport') { selected = 'transport'; target = document.getElementById('stage-transport'); }
    else if (panelMap.has(hash.replace(/^module-/, ''))) selected = hash.replace(/^module-/, '');
    else if (hash.startsWith('course-') || ['foundation', 'stage-transport', 'testing', 'operations', 'applications', 'frontier'].includes(hash)) {
      target = document.getElementById(hash);
      const panel = target && target.closest('.module-panel');
      if (panel) selected = panel.dataset.module;
    } else if (!hash || hash === 'top') selected = 'transport';
    render();
    if (scroll) {
      if (target) target.scrollIntoView({block: 'start'});
      else if (hash === 'catalog') main.scrollIntoView({block: 'start'});
      else window.scrollTo({top: 0, behavior: 'auto'});
    }
  }

  function navigate(hash, replace = false, scroll = true) {
    history[replace ? 'replaceState' : 'pushState'](null, '', '#' + hash);
    readRoute(scroll);
  }

  function filterRoute() {
    const value = search.value;
    if (value.trim()) {
      const params = new URLSearchParams({q: value});
      if (readyOnly) params.set('readable', '1');
      return 'search?' + params.toString();
    }
    return readyOnly ? 'readable' : 'module-' + selected;
  }

  search.addEventListener('input', () => navigate(filterRoute(), true, false));
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') { search.value = ''; navigate(filterRoute(), true, false); }
  });
  document.querySelector('.toolbar').addEventListener('submit', event => event.preventDefault());
  clearSearch.addEventListener('click', () => {
    search.value = ''; navigate(filterRoute(), true, false); search.focus();
  });
  readyButton.addEventListener('click', () => {
    readyOnly = !readyOnly; navigate(filterRoute(), false, false);
  });
  document.getElementById('reset-filters').addEventListener('click', () => {
    navigate('module-' + selected); search.focus();
  });
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-detail]');
    if (toggle) {
      const detail = document.getElementById(toggle.dataset.detail);
      detail.hidden = !detail.hidden;
      detail.closest('.course').querySelectorAll('[data-detail]').forEach(button => button.setAttribute('aria-expanded', String(!detail.hidden)));
      return;
    }
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    if (mobile.matches && anchor.matches('[data-module-link]')) nav.open = false;
    navigate(anchor.getAttribute('href').slice(1));
  });
  window.addEventListener('hashchange', () => readRoute());
  window.addEventListener('popstate', () => readRoute());
  readRoute(false);
  if (location.hash && !location.hash.startsWith('#search?')) readRoute(true);
})();
