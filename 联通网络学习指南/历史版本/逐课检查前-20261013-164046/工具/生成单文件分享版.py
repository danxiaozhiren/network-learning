#!/usr/bin/env python3
"""Bundle the current reader documents and images without changing their sources."""
from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import re
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "分享" / "网络知识指南-单文件分享版.html"
DOCUMENTS = [
    ("catalog", "网络学习总目录.html", "网络知识指南"),
    ("foundation", "传输网/光网络基础知识图解.html", "光网络基础知识"),
    ("components", "传输网/光模块及光纤光缆通识.html", "光模块及光纤光缆通识"),
    ("fiber", "传输网/光纤光缆技术发展及应用.html", "光纤光缆技术发展及应用"),
    ("modules", "传输网/光模块关键技术及应用.html", "光模块关键技术及应用"),
    ("wdm", "传输网/WDM高速光传输技术发展及应用.html", "WDM 高速光传输技术发展及应用"),
    ("otn", "传输网/OTN技术发展及应用.html", "OTN 技术发展及应用"),
    ("roadm", "传输网/ROADM技术发展及应用.html", "ROADM 技术发展及应用"),
    ("optical-testing", "传输网/传输网络光层测试.html", "传输网络光层测试"),
    ("business-testing", "传输网/传输网的传输及业务测试.html", "传输网的传输及业务测试"),
    ("sdn", "传输网/光传送网SDN化管控.html", "光传送网SDN化管控"),
    ("intelligent-operations", "传输网/智能运维架构及关键技术.html", "智能运维架构及关键技术"),
    ("optical-operations", "传输网/光网络智能化运维.html", "光网络智能化运维"),
    ("rules", "传输网/讲义制作要求.html", "讲义制作要求"),
    ("example", "传输网/光网络基础知识-单屏交互样稿.html", "设备关系与业务过程图"),
]
PATH_TO_PAGE = {(ROOT / path).resolve(): key for key, path, _ in DOCUMENTS}
PATH_TO_PAGE[(ROOT / "传输网/传输网学习目录.html").resolve()] = "catalog"
PATH_TO_PAGE[(ROOT / "index.html").resolve()] = "catalog"
ASSETS: list[str] = []
ASSET_INDEX: dict[str, int] = {}
SOURCE_HASHES: dict[str, str] = {}


def asset_token(value: str) -> str:
    if value not in ASSET_INDEX:
        ASSET_INDEX[value] = len(ASSETS)
        ASSETS.append(value)
    return f"__GUIDE_ASSET_{ASSET_INDEX[value]}__"


def read_asset(path: Path) -> str:
    data = path.read_bytes()
    SOURCE_HASHES[str(path.relative_to(ROOT))] = hashlib.sha256(data).hexdigest()
    mime = mimetypes.guess_type(path.name)[0]
    if not mime or not mime.startswith("image/"):
        raise ValueError(f"Unsupported local asset: {path}")
    return asset_token(f"data:{mime};base64," + base64.b64encode(data).decode("ascii"))


def set_attribute(tag: str, name: str, value: str) -> str:
    pattern = re.compile(r"(?<![\w:-])" + re.escape(name) + r"\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", re.I)
    attribute = f'{name}="{escape(value, quote=True)}"'
    if pattern.search(tag):
        return pattern.sub(lambda _: attribute, tag, count=1)
    end = "/>" if tag.endswith("/>") else ">"
    return tag[:-len(end)] + " " + attribute + end


class DocumentRewriter(HTMLParser):
    def __init__(self, path: Path, source: str):
        super().__init__(convert_charrefs=False)
        self.path = path
        self.source = source
        self.offsets = [0]
        for match in re.finditer("\n", source):
            self.offsets.append(match.end())
        self.edits: list[tuple[int, int, str]] = []

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        raw = self.get_starttag_text()
        revised = raw
        src = attributes.get("src", "")
        if src and not src.startswith("data:"):
            if re.match(r"(?:[a-z]+:|//)", src, re.I):
                raise ValueError(f"Network dependency in {self.path.name}: {src}")
            revised = set_attribute(revised, "src", read_asset((self.path.parent / unescape(src)).resolve()))
        href = attributes.get("href", "")
        if tag == "a" and href and not href.startswith(("#", "data:")) and not re.match(r"(?:[a-z]+:|//)", href, re.I):
            local, separator, fragment = href.partition("#")
            target = (self.path.parent / unescape(local)).resolve()
            if target in PATH_TO_PAGE:
                revised = set_attribute(revised, "data-guide-page", PATH_TO_PAGE[target])
                revised = set_attribute(revised, "data-guide-anchor", unescape(fragment) if separator else "")
            elif target.is_file() and (mimetypes.guess_type(target.name)[0] or "").startswith("image/"):
                revised = set_attribute(revised, "href", read_asset(target))
                revised = set_attribute(revised, "data-guide-image", "true")
            else:
                raise ValueError(f"Unbundled local link in {self.path.name}: {href}")
        if revised != raw:
            line, column = self.getpos()
            start = self.offsets[line - 1] + column
            self.edits.append((start, start + len(raw), revised))

    def result(self) -> str:
        output = self.source
        for start, end, revised in reversed(self.edits):
            output = output[:start] + revised + output[end:]
        return re.sub(r"data:image/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+", lambda match: asset_token(match.group()), output)


BRIDGE = r"""
(() => {
  const config = __GUIDE_CONFIG__;
  const originalReplace = history.replaceState.bind(history);
  const cleanHash = value => String(value || '').replace(/^#/, '');
  const notify = (replace = false) => parent.postMessage({guide: true, type: 'state', page: config.page, anchor: cleanHash(location.hash), replace}, '*');
  const writeHash = value => originalReplace(null, '', 'about:srcdoc' + (value ? '#' + value : ''));
  if (config.anchor) writeHash(config.anchor);
  history.pushState = function(state, unused, url) { originalReplace(state, unused, url); notify(false); };
  history.replaceState = function(state, unused, url) { originalReplace(state, unused, url); notify(true); };
  const scrollAnchor = hash => {
    let id; try { id = decodeURIComponent(hash); } catch { id = hash; }
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({block: 'start'});
    else if (!hash) window.scrollTo({top: 0, behavior: 'instant'});
  };
  const changeAnchor = hash => { writeHash(hash); dispatchEvent(new HashChangeEvent('hashchange')); scrollAnchor(hash); };
  addEventListener('message', event => {
    if (event.source === parent && event.data && event.data.guide && event.data.type === 'anchor') changeAnchor(event.data.anchor || '');
  });
  addEventListener('hashchange', () => notify(true));
  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[data-guide-page]').forEach(anchor => {
      const hash = '#/' + anchor.dataset.guidePage + (anchor.dataset.guideAnchor ? '/' + encodeURIComponent(anchor.dataset.guideAnchor) : '');
      anchor.href = config.file + hash;
    });
    document.querySelectorAll('a[href^="http://"],a[href^="https://"]').forEach(anchor => {
      if (!anchor.dataset.guidePage) { anchor.target = '_blank'; anchor.rel = 'noopener'; }
    });
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a');
      if (!anchor || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.dataset.guideImage) {
        event.preventDefault();
        let dialog = document.getElementById('guide-image-dialog');
        if (!dialog) {
          const style = document.createElement('style');
          style.textContent = '#guide-image-dialog{width:min(1200px,96vw);max-width:96vw;max-height:96vh;padding:15px;border:1px solid #dce3e8;border-radius:8px;background:white;color:#243343}#guide-image-dialog::backdrop{background:#17212d88}#guide-image-dialog button{display:block;margin:0 0 12px auto;border:1px solid #ccd5dc;border-radius:5px;background:white;padding:7px 18px;font:inherit;cursor:pointer}#guide-image-dialog img{display:block;width:100%;height:auto;max-height:none}';
          document.head.append(style);
          dialog = document.createElement('dialog'); dialog.id = 'guide-image-dialog'; dialog.setAttribute('aria-label', '实物图');
          const close = document.createElement('button'); close.textContent = '关闭'; close.addEventListener('click', () => dialog.close());
          const image = document.createElement('img'); image.alt = '设备与部件外形示意';
          dialog.append(close, image); document.body.append(dialog);
        }
        dialog.querySelector('img').src = anchor.href; dialog.showModal(); return;
      }
      if (anchor.dataset.guidePage) {
        event.preventDefault(); parent.postMessage({guide: true, type: 'navigate', page: config.page, target: anchor.dataset.guidePage, anchor: anchor.dataset.guideAnchor || ''}, '*'); return;
      }
      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#')) {
        event.preventDefault(); const hash = href.slice(1); writeHash(hash); notify(false); dispatchEvent(new HashChangeEvent('hashchange')); scrollAnchor(hash);
      }
    });
    scrollAnchor(config.anchor);
    parent.postMessage({guide: true, type: 'ready', page: config.page}, '*');
  });
})();
"""

SHELL = r"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>网络知识指南</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}#reader{position:fixed;inset:0}#reader iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}#loading{position:fixed;inset:0;display:grid;place-items:center;color:#617080;font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;pointer-events:none}#loading[hidden]{display:none}noscript{padding:30px;display:block}</style></head>
<body><div id="reader"></div><div id="loading" role="status">正在打开讲义…</div><noscript>请启用浏览器 JavaScript 后打开讲义。</noscript>
<script id="guide-payload" type="application/json">__PAYLOAD__</script>
<script>
(() => {
  'use strict';
  const bundle = JSON.parse(document.getElementById('guide-payload').textContent);
  const bridge = __BRIDGE__;
  const reader = document.getElementById('reader'), loading = document.getElementById('loading');
  const frames = new Map(); let current = null;
  const file = location.href.split('#')[0];
  const routeHash = (page, anchor) => '#/' + page + (anchor ? '/' + encodeURIComponent(anchor) : '');
  function route() {
    const match = location.hash.match(/^#\/([^/]+)(?:\/(.*))?$/);
    if (!match || !bundle.pages[match[1]]) return {page: 'catalog', anchor: ''};
    let anchor = ''; try { anchor = decodeURIComponent(match[2] || ''); } catch {}
    return {page: match[1], anchor};
  }
  function show(page, anchor, force = false) {
    if (!bundle.pages[page]) return;
    if (current && current.page !== page) current.frame.style.display = 'none';
    let entry = frames.get(page);
    if (!entry) {
      const frame = document.createElement('iframe'); frame.dataset.page = page; frame.title = bundle.pages[page].title;
      entry = {page, frame, anchor, ready: false, pendingAnchor: false}; frames.set(page, entry);
      const config = JSON.stringify({page, anchor, file}).replace(/</g, '\\u003c');
      const script = bridge.replace('__GUIDE_CONFIG__', config);
      const source = bundle.pages[page].html.replace(/__GUIDE_ASSET_(\d+)__/g, (_, index) => bundle.assets[Number(index)]);
      frame.srcdoc = source.replace(/<head([^>]*)>/i, (_, attrs) => '<head' + attrs + '><base href="about:srcdoc"><script>' + script + '<' + '/script>');
      reader.append(frame);
    } else {
      entry.frame.style.display = 'block';
      if (force || entry.anchor !== anchor) {
        entry.anchor = anchor;
        if (entry.ready) entry.frame.contentWindow.postMessage({guide: true, type: 'anchor', anchor}, '*');
        else entry.pendingAnchor = true;
      }
    }
    current = entry; document.title = bundle.pages[page].title + (page === 'catalog' ? '' : ' · 网络知识指南'); loading.hidden = entry.ready;
    if (entry.ready) entry.frame.contentWindow.focus();
  }
  function navigate(page, anchor) {
    if (!bundle.pages[page]) return;
    const next = routeHash(page, anchor);
    if (location.hash !== next) history.pushState(null, '', next);
    show(page, anchor, current && current.page === page);
  }
  addEventListener('message', event => {
    const data = event.data;
    if (!data || !data.guide) return;
    if (data.type === 'ready') {
      const entry = frames.get(data.page);
      if (!entry || event.source !== entry.frame.contentWindow) return;
      entry.ready = true;
      if (entry.pendingAnchor) { entry.pendingAnchor = false; entry.frame.contentWindow.postMessage({guide: true, type: 'anchor', anchor: entry.anchor}, '*'); }
      if (entry === current) { loading.hidden = true; entry.frame.contentWindow.focus(); }
      return;
    }
    if (!current || event.source !== current.frame.contentWindow || data.page !== current.page) return;
    if (data.type === 'navigate') navigate(data.target, String(data.anchor || ''));
    else if (data.type === 'state') {
      current.anchor = String(data.anchor || ''); const next = routeHash(current.page, current.anchor);
      if (location.hash !== next) history[data.replace ? 'replaceState' : 'pushState'](null, '', next);
    }
  });
  const readRoute = () => { const state = route(); show(state.page, state.anchor); };
  addEventListener('popstate', readRoute); addEventListener('hashchange', readRoute); readRoute();
})();
</script></body></html>
"""


def script_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e")


def main():
    pages = {}
    for key, relative, title in DOCUMENTS:
        path = ROOT / relative
        source = path.read_text()
        SOURCE_HASHES[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        parser = DocumentRewriter(path, source); parser.feed(source)
        pages[key] = {"title": title, "source": relative, "html": parser.result()}
    payload = {"format": 1, "pages": pages, "assets": ASSETS, "sources": SOURCE_HASHES}
    output = SHELL.replace("__PAYLOAD__", script_json(payload)).replace("__BRIDGE__", script_json(BRIDGE))
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(output)
    lessons = sum(key not in {"catalog", "rules", "example"} for key, _, _ in DOCUMENTS)
    print(json.dumps({"file": str(OUTPUT), "lessons": lessons, "documents": len(pages), "images": len(ASSETS), "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
