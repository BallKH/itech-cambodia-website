#!/usr/bin/env python3
"""iTech Cambodia — AI website assistant — knowledge index builder.

Parses every top-level *.html page and extracts a flat list of searchable
"entries" (heading + the text that follows it, up to the next heading),
tagged with the nearest addressable ancestor — a real `id` attribute if one
exists (e.g. services.html's .svc-panel tabs), else the nearest
`data-robot-section` value the robot mascot already uses for section
awareness. That anchor is what search.js's results point browser
navigation at.

Run this whenever page content changes:
    python scripts/build_website_index.py

Writes assets/website-index.json, committed like any other asset (no
Vercel build step needed — the site stays purely static).
"""
import html
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "about.html", "services.html", "partners.html", "customers.html", "contact.html"]

VOID_TAGS = {"br", "img", "input", "meta", "link", "hr", "source", "area", "base", "col", "embed", "track", "wbr"}
SKIP_CONTENT_TAGS = {"script", "style", "noscript", "template"}
HEADING_TAGS = {"h1", "h2", "h3", "h4"}
MAX_ENTRY_CHARS = 700


class PageExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []  # [{tag, id, section}]
        self.skip_depth = 0  # >0 while inside a SKIP_CONTENT_TAGS element
        self.title = ""
        self.in_title = False

        self.entries = []
        self.current = None  # {anchor, heading, text}
        self.in_heading = False
        self.heading_buf = []

    # ---------- anchor tracking ----------
    def _current_anchor(self):
        for frame in reversed(self.stack):
            if frame["id"]:
                return frame["id"]
        for frame in reversed(self.stack):
            if frame["section"]:
                return frame["section"]
        return None

    # ---------- HTMLParser hooks ----------
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag in SKIP_CONTENT_TAGS:
            self.skip_depth += 1
        if tag not in VOID_TAGS:
            self.stack.append({"tag": tag, "id": attrs.get("id"), "section": attrs.get("data-robot-section")})

        if self.skip_depth:
            return

        if tag in HEADING_TAGS:
            self._flush()
            self.in_heading = True
            self.heading_buf = []
            self.current = {"anchor": self._current_anchor(), "heading": "", "text": ""}

    def handle_startendtag(self, tag, attrs):
        # self-closing void tags (e.g. <br/>) — no stack push, nothing else to do
        pass

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in HEADING_TAGS and self.in_heading:
            self.in_heading = False
            if self.current is not None:
                self.current["heading"] = " ".join("".join(self.heading_buf).split())
        if tag in SKIP_CONTENT_TAGS and self.skip_depth:
            self.skip_depth -= 1
        # pop the matching (innermost) open frame for this tag, if any
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.skip_depth:
            return
        if self.in_heading:
            self.heading_buf.append(data)
        elif self.current is not None:
            if len(self.current["text"]) < MAX_ENTRY_CHARS:
                self.current["text"] += data if data.strip() else " "

    def _flush(self):
        if self.current and (self.current["heading"] or self.current["text"].strip()):
            text = " ".join(self.current["text"].split())[:MAX_ENTRY_CHARS]
            if self.current["heading"] or text:
                self.entries.append(
                    {
                        "anchor": self.current["anchor"],
                        "heading": self.current["heading"],
                        "text": text,
                    }
                )
        self.current = None

    def close(self):
        self._flush()
        super().close()


def extract(page_file):
    raw = (ROOT / page_file).read_text(encoding="utf-8")
    parser = PageExtractor()
    parser.feed(raw)
    parser.close()
    title = html.unescape(" ".join(parser.title.split()))
    entries = [e for e in parser.entries if e["heading"] or len(e["text"]) > 20]
    return {"url": page_file, "title": title, "entries": entries}


def main():
    pages = [extract(p) for p in PAGES]
    out = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pages": pages,
    }
    out_path = ROOT / "assets" / "website-index.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    total_entries = sum(len(p["entries"]) for p in pages)
    print(f"Wrote {out_path.relative_to(ROOT)} — {len(pages)} pages, {total_entries} entries")


if __name__ == "__main__":
    main()
