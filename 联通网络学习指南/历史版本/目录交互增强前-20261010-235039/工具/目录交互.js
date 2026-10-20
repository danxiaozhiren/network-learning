(() => {
  'use strict';
  const main = document.querySelector('.main');
  const panels = [...document.querySelectorAll('.module-panel')];
  const panelMap = new Map(panels.filter(p => p.dataset.view === 'route').map(p => [p.dataset.module, p]));
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
  let view = 'route';
  let query = '';
  let readyOnly = false;
  let sourceMode = false;
  const isOverview = () => !location.hash || ['#top', '#topics'].includes(location.hash);
  nav.open = !mobile.matches || isOverview();
  mobile.addEventListener('change', event => { nav.open = !event.matches || isOverview(); });
  const moduleHash = (mode = view) => (mode === 'topics' ? 'topics-' : 'module-') + selected;

  function filterRoute(mode = view) {
    const value = search.value;
    if (value.trim() || readyOnly) {
      const params = new URLSearchParams({view: mode, module: selected});
      if (value.trim()) params.set('q', value);
      if (readyOnly) params.set('readable', '1');
      return 'search?' + params.toString();
    }
    return moduleHash(mode);
  }

  function render() {
    const isTopics = view === 'topics';
    const filtering = Boolean(query.trim()) || readyOnly;
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    search.value = query;
    search.placeholder = isTopics ? '搜索知识主题，例如 OTN、光模块' : '搜索全部课程，例如 OTN、接入网';
    document.querySelector('label[for="course-search"]').textContent = isTopics ? '搜索知识主题' : '搜索全部课程';
    clearSearch.hidden = !query;
    readyButton.setAttribute('aria-pressed', String(readyOnly));
    readyButton.querySelector('.filter-label').textContent = isTopics ? '可读主题' : '可读讲义';
    readyButton.querySelector('.filter-count').textContent = isTopics ? document.body.dataset.topicReady : document.body.dataset.lessonReady;
    main.classList.toggle('filtered', filtering);
    document.body.classList.toggle('topic-mode', isTopics);
    sources.hidden = !sourceMode;
    document.querySelector('.toolbar').hidden = sourceMode;
    document.querySelector('.list-end').hidden = sourceMode;
    header.hidden = sourceMode || !filtering;
    let shown = 0;
    let shownModules = 0;
    panels.forEach(panel => {
      const allowed = !sourceMode && panel.dataset.view === view && (filtering || panel.dataset.module === selected);
      let matches = 0;
      panel.querySelectorAll('.catalog-item').forEach(row => {
        const match = allowed && (!readyOnly || row.dataset.ready === 'true') && terms.every(term => row.dataset.search.includes(term));
        row.hidden = !match;
        if (match) matches++;
      });
      panel.querySelectorAll('.stage').forEach(stage => {
        stage.hidden = ![...stage.querySelectorAll('.catalog-item')].some(row => !row.hidden);
      });
      panel.hidden = !allowed || (filtering && matches === 0);
      const meta = panel.querySelector('.meta');
      meta.hidden = !filtering;
      meta.textContent = filtering ? `${matches} ${isTopics ? '个匹配主题' : '条匹配课程'}` : '';
      if (!panel.hidden) shownModules++;
      shown += matches;
    });
    empty.hidden = sourceMode || !filtering || shown > 0;
    empty.querySelector('strong').textContent = isTopics ? '没有找到匹配主题' : '没有找到匹配课程';
    empty.querySelector('p').textContent = isTopics ? '试试中文名、缩写，或清除筛选。' : '试试更短的关键词，或清除筛选。';
    document.getElementById('result-title').textContent = query.trim() ? '搜索结果' : isTopics ? '可读主题' : '可读讲义';
    document.getElementById('result-count').textContent = `${shown} ${isTopics ? '个主题' : '条课程'} · ${shownModules} 个领域${query.trim() ? ' · “' + query.trim() + '”' : ''}`;
    const title = panelMap.get(selected).dataset.title;
    const back = document.getElementById('back-to-module');
    back.href = '#' + moduleHash();
    back.textContent = '← 返回' + title + (isTopics ? '主题' : '路线');
    document.getElementById('nav-title').textContent = isTopics ? '知识领域' : '学习模块';
    document.querySelector('#module-nav nav').setAttribute('aria-label', isTopics ? '知识领域' : '学习模块');
    document.getElementById('mobile-selected').textContent = sourceMode ? '资料来源' : filtering ? '筛选结果' : title;
    document.querySelectorAll('[data-module-link]').forEach(link => {
      const count = isTopics ? link.dataset.topics : link.dataset.courses;
      link.href = '#' + (isTopics ? 'topics-' : 'module-') + link.dataset.moduleLink;
      link.querySelector('.count').textContent = count;
      link.querySelector('.count').setAttribute('aria-label', count + (isTopics ? ' 个主题' : ' 条课程'));
      if (!sourceMode && !filtering && link.dataset.moduleLink === selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-view-link]').forEach(link => {
      link.href = '#' + filterRoute(link.dataset.viewLink);
      if (!sourceMode && link.dataset.viewLink === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function setDetail(detail, open) {
    detail.hidden = !open;
    detail.closest('.catalog-item').querySelectorAll('[data-detail]').forEach(button => button.setAttribute('aria-expanded', String(open)));
  }

  function readRoute(scroll = true) {
    const raw = location.hash.slice(1);
    let hash;
    try { hash = decodeURIComponent(raw); } catch { hash = ''; }
    query = ''; readyOnly = false; sourceMode = false;
    let target = null;
    if (raw.startsWith('search?')) {
      const params = new URLSearchParams(raw.slice(7));
      query = params.get('q') || '';
      readyOnly = params.get('readable') === '1';
      view = params.get('view') === 'topics' ? 'topics' : 'route';
      if (panelMap.has(params.get('module'))) selected = params.get('module');
    } else if (hash === 'readable') { view = 'route'; readyOnly = true; }
    else if (hash === 'sources' || hash === 'workflow') sourceMode = true;
    else if (hash === 'topics') { view = 'topics'; selected = 'transport'; }
    else if (hash.startsWith('topics-') && panelMap.has(hash.slice(7))) { view = 'topics'; selected = hash.slice(7); }
    else if (legacy && hash === 'transport') { view = 'route'; selected = 'transport'; target = document.getElementById('stage-transport'); }
    else if (panelMap.has(hash.replace(/^module-/, ''))) { view = 'route'; selected = hash.replace(/^module-/, ''); }
    else if (hash.startsWith('course-') || hash.startsWith('topic-') || ['foundation', 'stage-transport', 'testing', 'operations', 'applications', 'frontier'].includes(hash)) {
      target = document.getElementById(hash);
      const panel = target && target.closest('.module-panel');
      if (panel) { selected = panel.dataset.module; view = panel.dataset.view; }
      if (target && target.classList.contains('course')) setDetail(target.querySelector('.course-detail'), true);
    } else if (!hash || hash === 'top') { selected = 'transport'; view = 'route'; }
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

  search.addEventListener('input', () => navigate(filterRoute(), true, false));
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') { search.value = ''; navigate(filterRoute(), true, false); }
  });
  document.querySelector('.toolbar').addEventListener('submit', event => event.preventDefault());
  clearSearch.addEventListener('click', () => {
    search.value = ''; navigate(filterRoute(), true, false); search.focus();
  });
  readyButton.addEventListener('click', () => { readyOnly = !readyOnly; navigate(filterRoute(), false, false); });
  document.getElementById('reset-filters').addEventListener('click', () => { navigate(moduleHash()); search.focus(); });
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-detail]');
    if (toggle) { const detail = document.getElementById(toggle.dataset.detail); setDetail(detail, detail.hidden); return; }
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
