#!/usr/bin/env python3
"""Build the standalone network learning catalog from verified JSON records.
Usage: python3 /private/tmp/build-network-catalog.py [data.json] [output.html]
Missing input is allowed for a clearly marked empty preview; it is not saved as JSON.
"""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
import argparse
import json
import re

ROOT = Path('/Users/abi/Documents/project/personal/网络知识学习')
DEFAULT_NAMES = [
    '网络规划标准化', '科技管理', '网络研究–网络IT', '网络研究–传输网',
    '网络研究–接入网', '网络研究–核心网', '网络研究–数据网', '网络研究–无线网',
    '应用技术研究–终端', '智库研究', '科创通识',
]


def esc(value):
    return escape(str(value), quote=True)


def clean_text(value, fallback='未核对'):
    return str(value).strip() if value is not None and str(value).strip() else fallback


def safe_url(value, local=False):
    if not isinstance(value, str) or not value.strip():
        return None
    value = value.strip()
    if any(ord(char) < 32 for char in value) or '\\' in value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme in ('http', 'https') and parsed.netloc:
        return value
    if local and not parsed.scheme and not parsed.netloc and not value.startswith('/'):
        return value
    return None


def positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def checked_page_count(value):
    if not isinstance(value, list) or not all(positive_int(page) for page in value):
        return None
    return len(set(value))


def pages_complete(expected, checked):
    return (positive_int(expected) and isinstance(checked, list)
            and all(positive_int(page) for page in checked)
            and len(checked) == expected
            and set(checked) == set(range(1, expected + 1)))


def hours_text(value):
    if value is None or str(value).strip() == '':
        return '未记录'
    value = str(value).strip()
    return value if '学时' in value else value + ' 学时'


def material_text(value):
    aliases = {
        'unknown': '未核对', 'unchecked': '未核对', 'not_checked': '未核对',
        'none': '已核对无附件', 'no_attachment': '已核对无附件',
        'checked_none': '已核对无附件', 'has_attachment': '已核对有附件',
        'available': '已核对有附件',
    }
    raw = clean_text(value)
    return aliases.get(raw, raw)


def generate(data):
    if not isinstance(data, dict) or not isinstance(data.get('categories', []), list):
        raise ValueError('顶层必须是对象，categories 必须是数组。')
    categories = data.get('categories', [])
    if not categories:
        categories = [dict(name=name, slug='category-' + str(index), complete=False,
                           pages_expected=None, pages_checked=None, courses=[])
                      for index, name in enumerate(DEFAULT_NAMES, 1)]
    normalized = []
    used_ids = set()
    for index, category in enumerate(categories, 1):
        if not isinstance(category, dict) or not category.get('name'):
            raise ValueError(f'第 {index} 个分类缺少 name。')
        courses = category.get('courses') or []
        if not isinstance(courses, list):
            raise ValueError(f'{category["name"]} 的 courses 必须是数组。')
        slug = re.sub(r'[^a-zA-Z0-9_-]', '-', str(category.get('slug') or f'category-{index}'))
        slug = slug.strip('-') or f'category-{index}'
        if slug in used_ids:
            slug = f'{slug}-{index}'
        used_ids.add(slug)
        raw_checked = category.get('pages_checked')
        raw_expected = category.get('pages_expected')
        checked = checked_page_count(raw_checked)
        expected = raw_expected if positive_int(raw_expected) else None
        # Require actual page IDs 1..N; equal counts alone do not prove coverage.
        complete = category.get('complete') is True and pages_complete(raw_expected, raw_checked)
        for course in courses:
            if not isinstance(course, dict) or not clean_text(course.get('title'), ''):
                raise ValueError(f'{category["name"]} 有课程缺少 title。')
        normalized.append(dict(category, courses=courses, dom_id=slug,
                               checked=checked, expected=expected, verified_complete=complete))
    total = sum(len(item['courses']) for item in normalized)
    complete_total = sum(item['verified_complete'] for item in normalized)
    lesson_total = sum(bool(safe_url(course.get('lesson_url'), True))
                       for item in normalized for course in item['courses'])
    source_url = safe_url(data.get('source_url'))
    source_link = (f'<a href="{esc(source_url)}" target="_blank" rel="noopener noreferrer">打开平台专题页 ↗</a>'
                   if source_url else '<span>平台专题链接待补充</span>')
    checked_at = clean_text(data.get('checked_at'), '核对日期待补充')
    note = clean_text(data.get('note'), '目录正在逐栏目核对；未收录的课程不代表平台没有。')
    summary_items = []
    course_sections = []
    filter_options = ['<option value="all">全部分类</option>']
    for index, category in enumerate(normalized, 1):
        name = esc(category['name'])
        dom_id = category['dom_id']
        count = len(category['courses'])
        status = '目录已核对' if category['verified_complete'] else '待核对'
        status_class = 'verified' if category['verified_complete'] else 'pending'
        checked = '—' if category['checked'] is None else str(category['checked'])
        expected = '未知' if category['expected'] is None else str(category['expected'])
        page_label = f'核对 {checked} / {expected} 页'
        filter_options.append(f'<option value="{esc(dom_id)}">{name}</option>')
        summary_items.append(f'''<a class="category-overview" href="#{esc(dom_id)}">
          <span class="category-name">{name}</span><span class="category-total">{count} 条已收录</span>
          <span class="category-check"><span class="badge {status_class}">{status}</span><span>{page_label}</span></span>
        </a>''')
        category_note = clean_text(category.get('note'), '')
        category_note_html = f'<p class="category-note">{esc(category_note)}</p>' if category_note else ''
        rows = []
        for cindex, course in enumerate(category['courses'], 1):
            title = esc(course['title'])
            course_note = clean_text(course.get('note'), '')
            course_note_html = f'<span class="course-note">{esc(course_note)}</span>' if course_note else ''
            original_url = safe_url(course.get('url'))
            lesson_url = safe_url(course.get('lesson_url'), True)
            original_link = (f'<a href="{esc(original_url)}" target="_blank" rel="noopener noreferrer" aria-label="打开原课：{title}">原课 ↗</a>'
                             if original_url else '<span class="lookup">在原站按课程名查找</span>')
            lesson_status = clean_text(course.get('lesson_status'), '讲义待制作')
            lesson = (f'<a href="{esc(lesson_url)}" aria-label="查看讲义：{title}">查看讲义</a><span class="lesson-state">{esc(lesson_status)}</span>'
                      if lesson_url else f'<span class="lesson-state standalone">{esc(lesson_status)}</span>')
            material = material_text(course.get('materials_status'))
            material_class = 'unknown' if material == '未核对' else ''
            search_text = esc(str(course['title']).lower() + ' ' + str(category['name']).lower())
            rows.append(f'''<tr data-search="{search_text}">
              <th scope="row"><span class="course-number">{cindex:02d}</span><span>{title}{course_note_html}</span></th>
              <td data-label="学时">{esc(hours_text(course.get('hours')))}</td>
              <td data-label="配套资料"><span class="{material_class}">{esc(material)}</span></td>
              <td data-label="HTML 讲义">{lesson}</td>
              <td class="source-cell" data-label="原课入口">{original_link}</td>
            </tr>''')
        table = (f'''<div class="table-wrap"><table><caption class="sr-only">{name}课程目录</caption>
          <thead><tr><th scope="col">课程名称</th><th scope="col">学时</th><th scope="col">配套资料</th><th scope="col">HTML 讲义</th><th scope="col">原课入口</th></tr></thead>
          <tbody>{''.join(rows)}</tbody></table></div>'''
                 if rows else '<p class="empty-category">课程名称尚待核对，核对后补入此处。</p>')
        course_sections.append(f'''<section class="course-section" id="{esc(dom_id)}" data-category="{esc(dom_id)}">
          <div class="section-heading"><div><span class="section-number">{index:02d}</span><h2>{name}</h2></div>
          <div class="section-meta"><span>{count} 条已收录</span><span>{page_label}</span><span class="badge {status_class}">{status}</span></div></div>
          {category_note_html}{table}</section>''')
    stylesheet = r''':root{--ink:#25382f;--muted:#66756b;--green:#226451;--green-soft:#e9efe7;--line:#dce2d7;--paper:#f6f4ee;--white:#fffefb;--amber:#896121;--amber-soft:#f5ead6}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--green);text-underline-offset:4px}a:hover{color:#103f32}a,button,input,select{touch-action:manipulation}a:focus-visible,input:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #b78743;outline-offset:4px}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:default}h1,h2,p{margin:0}.wrap{width:min(1200px,100%);margin:0 auto;padding:28px 32px 56px}.topnav{display:flex;gap:12px 26px;flex-wrap:wrap;align-items:center;padding-bottom:18px;border-bottom:1px solid var(--line);font-size:14px}.topnav a{text-decoration:none}.topnav .home{font-weight:700;margin-right:auto;color:var(--ink)}.hero{padding:42px 0 30px}.eyebrow{font-size:12px;color:var(--green);font-weight:750;letter-spacing:.13em}h1{font-size:clamp(32px,5vw,48px);line-height:1.2;letter-spacing:-.04em;margin:12px 0 16px}.intro{max-width:820px;color:var(--muted)}.metrics{display:flex;flex-wrap:wrap;gap:26px;margin-top:26px}.metric{font-size:13px;color:var(--muted)}.metric strong{font-size:27px;color:var(--ink);font-weight:650;margin-right:5px;font-variant-numeric:tabular-nums}.catalog-note{border-left:3px solid #c49d5d;background:var(--amber-soft);padding:12px 16px;font-size:13px;color:#614c2b}.catalog-note p+p{margin-top:5px}.overview{margin:28px 0}.overview-header{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}.overview-header h2{font-size:19px}.small{font-size:13px;color:var(--muted)}.category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line);background:var(--white);border-radius:9px;overflow:hidden}.category-overview{display:grid;grid-template-columns:1fr auto;gap:8px 12px;padding:15px 17px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-decoration:none}.category-overview:hover{background:var(--green-soft)}.category-name{font-size:14px;font-weight:650;color:var(--ink)}.category-total{font-size:12px;color:var(--muted);white-space:nowrap}.category-check{grid-column:1/-1;display:flex;gap:10px;align-items:center;font-size:11px;color:var(--muted)}.badge{display:inline-block;border-radius:4px;padding:1px 7px;font-size:11px;line-height:1.8;white-space:nowrap}.verified{background:var(--green-soft);color:var(--green)}.pending{background:var(--amber-soft);color:var(--amber)}.route{padding:16px 19px;border:1px solid var(--line);border-radius:9px;margin:24px 0 28px;background:var(--white)}.route summary{color:var(--green);font-size:14px;font-weight:650;cursor:pointer}.route p{font-size:14px;margin-top:12px}.route .small{font-size:12px}.filters{display:grid;grid-template-columns:minmax(0,1fr) 235px auto;gap:12px;align-items:end;padding:20px;background:var(--green-soft);border-radius:9px}.field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650}.field input,.field select{width:100%;height:44px;border:1px solid #c3d0c1;border-radius:5px;background:var(--white);color:var(--ink);padding:9px 12px;font-size:14px;min-width:0}.reset{height:44px;border:1px solid #b5c5b3;border-radius:5px;background:transparent;color:var(--green);padding:8px 16px;font-size:14px}.result-count{margin:12px 1px 26px;font-size:13px;color:var(--muted)}.course-section{margin:0 0 34px;scroll-margin-top:24px}.section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:10px 20px;padding-bottom:12px;border-bottom:2px solid #97af9e}.section-heading>div:first-child{display:flex;gap:12px;align-items:baseline}.section-number{color:var(--green);font-size:12px;font-weight:750}.section-heading h2{font-size:21px;line-height:1.45}.section-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--muted)}table{width:100%;border-collapse:collapse;text-align:left;table-layout:fixed;font-size:13px}thead{color:var(--muted);font-size:11px}th,td{padding:14px 11px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}thead th{font-weight:550}thead th:nth-child(1){width:40%;padding-left:0}thead th:nth-child(2){width:9%}thead th:nth-child(3){width:20%}thead th:nth-child(4){width:17%}thead th:nth-child(5){width:14%}tbody th{font-size:15px;font-weight:550;padding-left:0;position:relative}tbody th>span:last-child{display:block;padding-left:30px}.course-number{position:absolute;left:0;top:16px;font-size:11px;color:#819084;font-weight:400}tbody tr:hover{background:rgba(233,239,231,.45)}.lesson-state{display:block;color:var(--muted);font-size:11px;margin-top:3px}.lesson-state.standalone{font-size:12px;margin-top:0}.unknown{color:#849084}.lookup{color:var(--muted);font-size:11px;display:block}.source-cell a{white-space:nowrap}.category-note{font-size:12px;color:var(--muted);margin:12px 0}.course-note{display:block;font-size:11px;line-height:1.6;font-weight:400;color:var(--muted);margin-top:5px}.empty-category,.no-results{color:var(--muted);font-size:14px;padding:22px 0}.no-results{background:var(--white);border:1px solid var(--line);padding:30px;text-align:center;border-radius:9px}.source-note{font-size:13px;color:var(--muted);margin-top:45px;padding-top:22px;border-top:1px solid var(--line)}.source-note p+p{margin-top:8px}.footer-links{display:flex;gap:18px;flex-wrap:wrap;margin-top:15px}.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}[hidden]{display:none!important}@media(max-width:950px){.category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-heading{align-items:flex-start;flex-direction:column}.section-meta{padding-left:27px}.wrap{padding:24px}}@media(max-width:640px){.wrap{padding:20px 18px 40px}.topnav{gap:9px 16px;font-size:12px}.topnav .home{width:100%}.hero{padding:30px 0 24px}.intro{font-size:14px}.metrics{gap:12px 23px;margin-top:20px}.metric{font-size:12px}.metric strong{font-size:23px}.category-grid{grid-template-columns:1fr}.category-overview{padding:13px 14px}.overview-header{display:block}.overview-header .small{display:block;margin-top:4px}.filters{grid-template-columns:minmax(0,1fr) auto;padding:15px;gap:12px 10px}.field:first-child{grid-column:1/-1}.field input,.field select{font-size:16px}.reset{padding:8px 12px}.section-heading h2{font-size:19px}.section-meta{gap:8px 12px}.table-wrap{width:100%}table,tbody,tr,td,tbody th{display:block;width:100%}thead{display:none}tbody tr{display:grid;grid-template-columns:1fr 1fr;column-gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}tbody th{grid-column:1/-1;padding:0 0 10px;border:0;font-size:16px}tbody th>span:last-child{padding-left:27px}.course-number{top:3px}td{padding:3px 0;border:0;font-size:12px}td::before{content:attr(data-label);display:block;font-size:10px;color:var(--muted);margin-bottom:1px}.source-cell{align-self:start}.lesson-state{font-size:11px}.lookup{font-size:11px}.route{padding:14px}.route p{font-size:13px}.result-count{font-size:12px}.course-section{margin-bottom:27px}.source-note{font-size:12px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{body{background:white;font-size:11pt}.wrap{width:auto;padding:0}.topnav,.filters,.reset,.result-count,.overview,.route{display:none}.hero{padding:0 0 20px}h1{font-size:25pt}.course-section{break-inside:auto}.section-heading{break-after:avoid}tr{break-inside:avoid}.course-section[hidden],tr[hidden]{display:revert!important}.badge{border:1px solid #bbb;background:white}.source-note{margin-top:20px}a{color:inherit}}'''
    script = r'''(() => {
      const search = document.getElementById('course-search');
      const select = document.getElementById('category-filter');
      const sections = Array.from(document.querySelectorAll('.course-section'));
      const result = document.getElementById('result-count');
      const empty = document.getElementById('no-results');
      const total = Number(document.body.dataset.total);
      function applyFilter() {
        const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        let shown = 0;
        let categoryShown = 0;
        sections.forEach(section => {
          const allowed = select.value === 'all' || select.value === section.dataset.category;
          let matches = 0;
          const rows = Array.from(section.querySelectorAll('tbody tr'));
          rows.forEach(row => {
            const match = allowed && terms.every(term => row.dataset.search.includes(term));
            row.hidden = !match;
            if (match) matches++;
          });
          section.hidden = !allowed || (terms.length > 0 && matches === 0);
          if (!section.hidden) categoryShown++;
          shown += matches;
        });
        result.textContent = `显示 ${shown} / ${total} 条已收录课程记录 · ${categoryShown} 个分类`;
        empty.hidden = categoryShown > 0;
      }
      search.addEventListener('input', applyFilter);
      select.addEventListener('change', applyFilter);
      document.getElementById('reset-filters').addEventListener('click', () => {
        search.value = ''; select.value = 'all'; applyFilter(); search.focus();
      });
      document.querySelectorAll('.category-overview').forEach(link => {
        link.addEventListener('click', () => {
          search.value = ''; select.value = 'all'; applyFilter();
        });
      });
      applyFilter();
    })();'''
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="按联通学习平台栏目整理的网络课程目录，记录课程入口、资料核对和 HTML 讲义状态。"><title>网络学习总目录</title><style>{stylesheet}</style></head>
<body data-total="{total}"><div class="wrap">
<nav class="topnav" aria-label="主导航"><a class="home" href="#top">网络学习总目录</a><a href="传输网/传输网学习目录.html">传输网学习安排</a><a href="传输网/讲义制作要求.html">讲义制作要求</a>{source_link}</nav>
<header class="hero" id="top"><div class="eyebrow">课程索引 · 持续补充讲义</div><h1>网络学习总目录</h1><p class="intro">先从目录选一门课，再逐课制作通俗、图文结合的 HTML 讲义。这里保留平台原有分类和课程名称，学习顺序另作安排。</p><div class="metrics"><div class="metric"><strong>{len(normalized)}</strong>个分类</div><div class="metric"><strong>{total}</strong>条课程记录</div><div class="metric"><strong>{complete_total}/{len(normalized)}</strong>分类目录已核对</div><div class="metric"><strong>{lesson_total}</strong>份可阅读讲义</div></div></header>
<div class="catalog-note"><p>{esc(note)}</p><p>“目录已核对”仅指课程列表；“资料未核对”不能理解为没有课件。已有讲义也不代表已经学会。</p></div>
<section class="overview" aria-labelledby="overview-title"><div class="overview-header"><h2 id="overview-title">按平台栏目查找</h2><span class="small">点击栏目可跳到课程列表</span></div><div class="category-grid">{''.join(summary_items)}</div></section>
<details class="route"><summary>建议怎样安排学习顺序</summary><p>先理解一条信息怎样传送，再认识接入网与数据网，接着学习无线网与核心网；网络 IT、运维及规划知识结合工作需要补充，前沿技术按兴趣选读。</p><p class="small">这是便于入门的建议，不是平台顺序，也不表示各类网络之间存在唯一的学习先后关系。现有传输网的分阶段安排可从上方入口查看。</p></details>
<main id="catalog"><form class="filters" role="search" onsubmit="return false"><label class="field" for="course-search">搜索课程名称或分类<input id="course-search" type="search" placeholder="例如：光网络、接入网、5G" autocomplete="off"></label><label class="field" for="category-filter">分类<select id="category-filter">{''.join(filter_options)}</select></label><button id="reset-filters" class="reset" type="button">重置</button></form><p id="result-count" class="result-count" aria-live="polite">共收录 {total} 条课程记录</p><noscript><p class="small">当前浏览器未启用脚本，下方仍可阅读完整目录；搜索和筛选暂不可用。</p></noscript><p class="no-results" id="no-results" hidden>没有找到匹配的课程。试试缩短关键词，或重置筛选。</p>{''.join(course_sections)}</main>
<footer class="source-note" id="sources"><p>核对时间：{esc(checked_at)}。课程名称、分类和学时按已读取的平台页面记录；空缺信息保留待核对状态。</p><p>配套资料与讲义分开记录。没有课程直达链接的条目，请打开平台专题页，在原站按完整课程名查找。</p><div class="footer-links">{source_link}<a href="传输网/讲义制作要求.html">讲义制作要求</a><a href="#top">回到顶部 ↑</a></div></footer>
</div><script>{script}</script></body></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', nargs='?', type=Path, default=ROOT / '课程目录数据.json')
    parser.add_argument('output', nargs='?', type=Path, default=ROOT / '网络学习总目录.html')
    args = parser.parse_args()
    if args.data.exists():
        data = json.loads(args.data.read_text(encoding='utf-8'))
        status = '真实 JSON 数据'
    else:
        data = {'categories': [], 'note': '结构预览：课程数据尚未写入，此页不能视为完整目录。'}
        status = '空数据结构预览'
    content = generate(data)
    args.output.write_text(content, encoding='utf-8')
    print(json.dumps({'output': str(args.output), 'mode': status,
                      'bytes': len(content.encode('utf-8'))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
