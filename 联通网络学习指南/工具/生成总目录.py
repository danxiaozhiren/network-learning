#!/usr/bin/env python3
"""生成可离线打开的网络学习路线和兼容的传输网入口。
用法：python3 工具/生成总目录.py [课程数据.json] [输出.html]
不指定输出时，同时更新总目录和传输网目录。原始课程数据保持不变。
"""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from html.parser import HTMLParser
import argparse
import json
import re

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / '工具'


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


def pages_complete(expected, checked):
    return (isinstance(expected, int) and not isinstance(expected, bool) and expected > 0
            and isinstance(checked, list) and all(type(p) is int for p in checked)
            and len(checked) == expected and set(checked) == set(range(1, expected + 1)))


def normalize(data, route):
    categories = data.get('categories')
    if not isinstance(categories, list) or not categories:
        raise ValueError('课程数据缺少 categories；不能生成完整路线。')
    result = {}
    for category in categories:
        slug = category.get('slug', '')
        if not re.fullmatch(r'[a-z0-9-]+', slug) or slug in result:
            raise ValueError(f'无效或重复的分类标识：{slug}')
        courses = category.get('courses')
        if not isinstance(courses, list) or any(not c.get('title') for c in courses):
            raise ValueError(f'{slug} 的课程列表无效。')
        result[slug] = category
    ordered = [slug for group in route['groups'] for slug in group['modules']]
    if len(ordered) != len(set(ordered)) or set(ordered) != set(result):
        raise ValueError('学习路线必须完整且不重复地引用全部平台分类。')
    ids = [str(c['course_id']) for stage in route['transport_stages'] for c in stage['courses']]
    actual = [str(c['course_id']) for c in result['transport']['courses']]
    if len(ids) != len(set(ids)) or set(ids) != set(actual):
        raise ValueError('传输网阶段必须完整且不重复地引用所有传输网课程。')
    return result


def local_url(value, legacy):
    url = safe_url(value, True)
    if url and legacy and not urlsplit(url).scheme:
        return '../' + url
    return url


def external_link(url, label):
    url = safe_url(url)
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)} ↗</a>' if url else ''


def course_dom_id(course, slug, index):
    return 'course-' + str(course.get('course_id') or f'{slug}-{index + 1}')


def validate_topics(topics, categories):
    if set(topics.get('modules', {})) != set(categories):
        raise ValueError('主题索引必须覆盖全部模块。')
    anchors = {}

    class AnchorParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.ids = set()

        def handle_starttag(self, tag, attrs):
            self.ids.update(value for key, value in attrs if key == 'id')

    for slug, group in topics['modules'].items():
        seen = set()
        covered = set()
        for topic in group['topics']:
            topic_id = topic.get('id', '')
            if not re.fullmatch(r'[a-z0-9-]+', topic_id) or topic_id in seen:
                raise ValueError(f'{slug} 的主题标识无效或重复：{topic_id}')
            seen.add(topic_id)
            for ref in topic.get('course_refs', []):
                target = categories.get(ref['slug'])
                if target is None or type(ref['index']) is not int or not 0 <= ref['index'] < len(target['courses']):
                    raise ValueError(f'{slug}/{topic_id} 的原课引用无效。')
                if ref['slug'] == slug:
                    covered.add(ref['index'])
            for reading in topic.get('readings', []):
                url = safe_url(reading['url'], True)
                if not url or urlsplit(url).scheme:
                    raise ValueError('主题讲解必须对应本地内容。')
                parsed = urlsplit(url)
                path = ROOT / parsed.path
                if not path.is_file():
                    raise ValueError(f'主题讲解文件不存在：{url}')
                if parsed.fragment:
                    if path not in anchors:
                        parser = AnchorParser()
                        parser.feed(path.read_text(encoding='utf-8'))
                        anchors[path] = parser.ids
                    if parsed.fragment not in anchors[path]:
                        raise ValueError(f'主题讲解锚点不存在：{url}')
        if covered != set(range(len(categories[slug]['courses']))):
            raise ValueError(f'{slug} 存在尚未归类的课程记录。')


def topic_html(topic, slug, categories, legacy):
    topic_id = f'topic-{slug}-{topic["id"]}'
    detail_id = 'detail-' + topic_id
    readings = topic.get('readings', [])
    title = esc(topic['title'])
    description = f'<span class="topic-description">{esc(topic["description"])}</span>' if topic.get('description') else ''
    ready = bool(readings)
    related_titles = [categories[r['slug']]['courses'][r['index']]['title'] for r in topic.get('course_refs', [])]
    search = ' '.join([topic['title'], topic['description'], slug, categories[slug]['name'],
                       *topic.get('keywords', []), *related_titles]).casefold()
    match_sources = [{'label': '关键词', 'text': word} for word in topic.get('keywords', [])]
    match_sources += [{'label': '相关课程', 'text': name} for name in related_titles]
    match_sources += [{'label': '领域', 'text': categories[slug]['name'] + ' ' + slug}]
    match_sources = esc(json.dumps(match_sources, ensure_ascii=False))
    status = '阅读 →' if ready else '待补充'
    label = f'<span class="topic-text"><span class="course-title">{title}</span>{description}</span><span class="course-status">{status}</span>'
    if ready:
        entry = f'<a class="course-entry topic-entry" href="{esc(local_url(readings[0]["url"], legacy))}" aria-label="阅读主题：{title}">{label}</a>'
    else:
        entry = f'<button type="button" class="course-entry topic-entry" data-detail="{detail_id}" aria-expanded="false" aria-controls="{detail_id}" aria-label="查看主题：{title}">{label}</button>'
    reading_links = ''.join(f'<li><a href="{esc(local_url(r["url"], legacy))}">{esc(r["label"])}</a></li>' for r in readings)
    reading_block = f'<ul class="topic-readings">{reading_links}</ul>' if ready else ''
    refs = []
    for ref in topic.get('course_refs', []):
        course = categories[ref['slug']]['courses'][ref['index']]
        refs.append(f'<li><a href="#{course_dom_id(course, ref["slug"], ref["index"])}">{esc(course["title"])}</a></li>')
    related = f'<details class="related-courses"><summary>相关课程 · {len(refs)}</summary><ul>{"".join(refs)}</ul></details>' if refs else ''
    return f'''<article class="topic catalog-item{' is-ready' if ready else ''}" id="{topic_id}" data-search="{esc(search)}" data-match-sources="{match_sources}" data-ready="{str(ready).lower()}"><div class="course-row">{entry}<button type="button" class="course-more" data-detail="{detail_id}" aria-expanded="false" aria-controls="{detail_id}" aria-label="主题详情：{title}"><span class="chevron" aria-hidden="true"></span></button></div><div class="course-detail topic-detail" id="{detail_id}" hidden>{reading_block}{related}</div></article>'''


def topic_module_html(slug, categories, route, topics, legacy):
    items = topics['modules'][slug]['topics']
    title = route['modules'][slug]['title']
    return f'''<section class="module-panel topic-panel" id="topics-{slug}" data-view="topics" data-module="{slug}" data-title="{esc(title)}" data-total="{len(items)}" hidden><div class="module-heading"><h1>{esc(title)}</h1><p class="meta" hidden></p></div><div class="stage topic-list">{''.join(topic_html(t, slug, categories, legacy) for t in items)}</div></section>'''


def course_html(course, number, slug, category, source_url, legacy, plan=None):
    plan = plan or {}
    title = esc(course['title'])
    course_id = str(course.get('course_id') or f'{slug}-{number}')
    row_id = f'course-{course_id}'
    detail_id = f'detail-{course_id}'
    lesson_url = local_url(course.get('lesson_url'), legacy)
    ready = bool(lesson_url)
    search = ' '.join([course['title'], category['name'], slug]).casefold()
    match_sources = esc(json.dumps([{'label': '领域', 'text': category['name'] + ' ' + slug}], ensure_ascii=False))
    status = '阅读讲义 →' if ready else '待补充'
    label = (f'<span class="course-number">{number:02d}</span><span class="course-title">{title}</span>'
             f'<span class="course-status">{status}</span>')
    if ready:
        entry = f'<a class="course-entry" href="{esc(lesson_url)}" aria-label="阅读讲义：{title}">{label}</a>'
    else:
        entry = (f'<button class="course-entry" type="button" data-detail="{detail_id}" '
                 f'aria-expanded="false" aria-controls="{detail_id}" aria-label="查看课程安排：{title}">{label}</button>')
    hours = clean_text(course.get('hours'), '未记录')
    hours = hours if '学时' in hours or hours == '未记录' else hours + ' 学时'
    material = clean_text(course.get('materials_status'))
    original = external_link(course.get('url'), '平台原课')
    if not original:
        original = external_link(source_url, '去平台按课程名查找')
    attachment = external_link(course.get('material_url'), '打开课件 PDF')
    question = f'<p class="question">{esc(plan["question"])}</p>' if plan.get('question') else ''
    topics = ''
    if plan.get('topics'):
        topics = '<details class="topics"><summary>本课学习顺序</summary><ol>' + ''.join(
            f'<li>{esc(topic)}</li>' for topic in plan['topics']) + '</ol></details>'
    return f'''<article class="course catalog-item{' is-ready' if ready else ''}" id="{row_id}" data-search="{esc(search)}" data-match-sources="{match_sources}" data-ready="{str(ready).lower()}">
<div class="course-row">{entry}<button type="button" class="course-more" data-detail="{detail_id}" aria-expanded="false" aria-controls="{detail_id}" aria-label="课程详情：{title}"><span class="chevron" aria-hidden="true"></span></button></div>
<div class="course-detail" id="{detail_id}" hidden>{question}<div class="detail-meta"><span>平台课程：{esc(hours)}</span><span>课件：{esc(material)}</span></div><div class="detail-links">{original}{attachment}</div>{topics}</div></article>'''


def module_html(slug, category, route, source_url, legacy, topics):
    module = route['modules'][slug]
    courses = category['courses']
    content = []
    stage_nav = ''
    if slug == 'transport':
        short_titles = ['基础', '业务传送', '测试', '管控运维', '网络应用', '前沿']
        stage_links = []
        stage_options = []
        by_id = {str(c['course_id']): c for c in courses}
        number = 0
        for sindex, stage in enumerate(route['transport_stages'], 1):
            rows = []
            for plan in stage['courses']:
                number += 1
                rows.append(course_html(by_id[str(plan['course_id'])], number, slug, category, source_url, legacy, plan))
            stage_id = 'stage-transport' if stage['id'] == 'transport' else stage['id']
            stage_links.append(f'<a href="#{stage_id}" title="{esc(stage["title"])}">{sindex} {short_titles[sindex - 1]}</a>')
            stage_options.append(f'<option value="{stage_id}">{sindex} · {esc(stage["title"])}</option>')
            content.append(f'<section class="stage" id="{stage_id}" data-stage="{stage["id"]}"><div class="stage-heading"><span class="stage-number">{sindex}</span><h2>{esc(stage["title"])}</h2></div>{"".join(rows)}</section>')
        stage_nav = f'<nav class="stage-nav" id="stage-nav" aria-label="学习阶段" hidden><div class="stage-links">{"".join(stage_links)}</div><select class="stage-select" aria-label="跳转学习阶段">{"".join(stage_options)}</select></nav>'
    else:
        included = set()
        number = 0
        sindex = 0
        for topic in topics['modules'][slug]['topics']:
            rows = []
            for ref in topic.get('course_refs', []):
                if ref['slug'] != slug or ref['index'] in included:
                    continue
                included.add(ref['index'])
                number += 1
                row = course_html(courses[ref['index']], ref['index'] + 1, slug, category, source_url, legacy)
                # Keep source identity stable while numbering the suggested reading order.
                row = row.replace(f'<span class="course-number">{ref["index"] + 1:02d}</span>', f'<span class="course-number">{number:02d}</span>', 1)
                rows.append(row)
            if rows:
                sindex += 1
                content.append(f'<section class="stage"><div class="stage-heading"><span class="stage-number">{sindex}</span><h2>{esc(topic["title"])}</h2></div>{"".join(rows)}</section>')
    return f'''<section class="module-panel" id="module-{slug}" data-view="route" data-module="{slug}" data-title="{esc(module['title'])}" data-total="{len(courses)}" {'hidden' if slug != 'transport' else ''}>
<div class="module-heading"><h1>{esc(module['title'])}</h1><p class="meta" hidden></p></div>{stage_nav}{''.join(content)}</section>'''


def sources_html(data, categories):
    rows = []
    for c in categories.values():
        verified = c.get('complete') is True and pages_complete(c.get('pages_expected'), c.get('pages_checked'))
        checked = len(set(c.get('pages_checked') or []))
        rows.append(f'<tr><td>{esc(c["name"])}</td><td>{len(c["courses"])}</td><td>{checked} / {esc(c.get("pages_expected", "?"))} 页 · {"已核对" if verified else "待核对"}</td></tr>')
    return f'''<section class="sources-view" id="sources" hidden><h1>资料来源</h1>
<p>课程来自 {external_link(data.get('source_url'), '联通学习平台主题专区')}。核对时间：{esc(data.get('checked_at', '未记录'))}。</p>
<details class="source-details"><summary>查看分类核对记录</summary><table class="source-table"><thead><tr><th>平台分类</th><th>课程记录</th><th>核对范围</th></tr></thead><tbody>{''.join(rows)}</tbody></table></details>
<a class="back-link" href="#module-transport">← 返回传输网</a></section>'''


def generate(data, legacy=False, route=None, topics=None):
    route = route or json.loads((TOOLS / '学习路线配置.json').read_text(encoding='utf-8'))
    topics = topics or json.loads((TOOLS / '知识主题配置.json').read_text(encoding='utf-8'))
    categories = normalize(data, route)
    validate_topics(topics, categories)
    ready = len({urlsplit(c['lesson_url'])._replace(fragment='').geturl() for cat in categories.values() for c in cat['courses'] if safe_url(c.get('lesson_url'), True)})
    topic_ready = sum(bool(t.get('readings')) for m in topics['modules'].values() for t in m['topics'])
    groups = []
    modules = []
    topic_modules = []
    for index, group in enumerate(route['groups'], 1):
        links = []
        for slug in group['modules']:
            c = categories[slug]
            module = route['modules'][slug]
            current = ' aria-current="page"' if slug == 'transport' else ''
            links.append(f'<a class="module-link" href="#module-{slug}" data-module-link="{slug}" data-courses="{len(c["courses"])}" data-topics="{len(topics["modules"][slug]["topics"])}"{current}><span>{esc(module["title"])}</span><span class="count" aria-label="{len(c["courses"])} 条课程">{len(c["courses"])}</span></a>')
            modules.append(module_html(slug, c, route, data.get('source_url'), legacy, topics))
            topic_modules.append(topic_module_html(slug, categories, route, topics, legacy))
        groups.append(f'<section class="module-group"><h3><span class="group-number">{index:02d}</span>{esc(group["title"])}</h3>{"".join(links)}</section>')
    rules_url = '讲义制作要求.html' if legacy else '传输网/讲义制作要求.html'
    style = (TOOLS / '目录样式.css').read_text(encoding='utf-8')
    script = (TOOLS / '目录搜索.js').read_text(encoding='utf-8') + '\n' + (TOOLS / '目录交互.js').read_text(encoding='utf-8')
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="网络知识学习指南：按路线学习，按知识主题查阅现有 HTML 讲义。"><title>{'传输网 · ' if legacy else ''}网络知识学习指南</title><style>{style}</style><noscript><style>.module-panel[hidden]{{display:block!important;margin-bottom:35px}}.nav-disclosure>nav{{display:block}}.toolbar,.course-more{{display:none}}.course-detail[hidden]{{display:block!important}}</style></noscript></head>
<body id="top" data-legacy-transport="{str(legacy).lower()}" data-lesson-ready="{ready}" data-topic-ready="{topic_ready}"><a class="skip-link" href="#catalog">跳到目录</a><header class="topbar"><a class="brand" href="#top">网络知识指南</a><a class="rules-link" href="{rules_url}">讲义制作要求</a></header>
<aside class="sidebar"><details class="nav-disclosure" id="module-nav" open><summary><span id="nav-title">学习模块</span><span class="nav-summary-count"><span id="mobile-selected">传输网</span></span></summary><nav aria-label="学习模块"><div class="module-groups">{''.join(groups)}</div></nav></details><div class="sidebar-footer"><a href="#sources">资料来源 <span aria-hidden="true">›</span></a></div></aside>
<main class="main" id="catalog"><nav class="view-switch" aria-label="阅读方式"><a href="#module-transport" data-view-link="route" aria-current="page">按路线学习</a><a href="#topics-transport" data-view-link="topics">按主题查阅</a></nav><form class="toolbar" role="search"><div class="search-wrap"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><label class="sr-only" for="course-search">搜索全部课程</label><input class="search" id="course-search" type="search" placeholder="搜索全部课程，例如 OTN、接入网" autocomplete="off" aria-keyshortcuts="/ Meta+K Control+K"><kbd class="search-key" aria-hidden="true">/</kbd><button class="clear-search" id="clear-search" type="button" aria-label="清空搜索" hidden>×</button></div><button class="ready-filter" type="button" id="ready-filter" aria-pressed="false"><span class="filter-label">可读讲义</span> <span class="filter-count">{ready}</span></button></form>
<div class="result-header" id="result-header" hidden><h1 id="result-title">搜索结果</h1><p class="result-description" id="result-count" role="status" aria-live="polite"></p><a class="back-link" id="back-to-module" href="#module-transport">← 返回传输网</a></div><div id="empty" class="empty" hidden><strong>没有找到匹配课程</strong><p>试试更短的关键词，或查看全部课程。</p><button type="button" id="reset-filters">清除筛选</button></div>
<div id="module-panels">{''.join(modules)}{''.join(topic_modules)}</div>{sources_html(data, categories)}<footer class="list-end"><a href="#sources">资料来源</a></footer><noscript><p>当前未启用脚本，已展开路线与主题；可直接打开已有讲义。</p></noscript></main><script>{script}</script></body></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', nargs='?', type=Path, default=ROOT / '课程目录数据.json')
    parser.add_argument('output', nargs='?', type=Path)
    args = parser.parse_args()
    data = json.loads(args.data.read_text(encoding='utf-8'))
    outputs = [(args.output, False)] if args.output else [
        (ROOT / '网络学习总目录.html', False),
        (ROOT / '传输网' / '传输网学习目录.html', True)]
    for path, legacy in outputs:
        content = generate(data, legacy)
        path.write_text(content, encoding='utf-8')
        print(json.dumps({'output': str(path), 'bytes': len(content.encode('utf-8'))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
