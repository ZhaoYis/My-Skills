#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import requests

BASE_URL = "https://wx.limyai.com/api/openapi"


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    sys.exit(code)


def get_api_key() -> str:
    api_key = os.environ.get("WECHAT_API_KEY", "").strip()
    if not api_key:
        fail("Error: WECHAT_API_KEY environment variable not set.")
    return api_key


def headers() -> Dict[str, str]:
    return {
        "X-API-Key": get_api_key(),
        "Content-Type": "application/json",
    }


def post_json(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{BASE_URL}/{path.lstrip('/')}"
    try:
        resp = requests.post(url, headers=headers(), json=payload, timeout=60)
        try:
            data = resp.json()
        except ValueError:
            fail(f"HTTP {resp.status_code}: {resp.text[:500]}")
    except requests.RequestException as exc:
        fail(f"Network Error: {exc}")

    if resp.status_code >= 400 or not data.get("success", False):
        code = data.get("code", "UNKNOWN")
        fail(f"API Error ({code}): {json.dumps(data, ensure_ascii=False)}")
    return data


def read_text(path: str) -> str:
    p = Path(path).expanduser().resolve()
    if not p.exists():
        fail(f"Error: file not found: {p}")
    return p.read_text(encoding="utf-8")


def extract_markdown_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()[:64] or fallback
    return fallback


def extract_html_title(content: str, fallback: str) -> str:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", content, re.I | re.S)
    if title_match:
        title = re.sub(r"\s+", " ", title_match.group(1)).strip()
        if title:
            return title[:64]

    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", content, re.I | re.S)
    if h1_match:
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1))
        h1 = re.sub(r"\s+", " ", h1).strip()
        if h1:
            return h1[:64]

    return fallback


def extract_summary(text: str) -> str:
    cleaned = re.sub(r"```.*?```", "", text, flags=re.S)
    cleaned = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", cleaned)
    cleaned = re.sub(r"\[[^\]]+\]\([^\)]*\)", "", cleaned)
    cleaned = re.sub(r"[#>*`\-]", " ", cleaned)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:120]


def list_accounts(_: argparse.Namespace) -> None:
    result = post_json("wechat-accounts", {})
    print(json.dumps(result, ensure_ascii=False, indent=2))


def publish(args: argparse.Namespace) -> None:
    markdown_path = args.markdown
    html_path = args.html

    if bool(markdown_path) == bool(html_path):
        fail("Error: specify exactly one of --markdown or --html")

    article_type = args.type or "news"
    if article_type not in {"news", "newspic"}:
        fail("Error: --type must be either 'news' or 'newspic'")

    if markdown_path:
        content = read_text(markdown_path)
        title = args.title or extract_markdown_title(content, Path(markdown_path).stem)
        summary = args.summary or extract_summary(content)
        payload = {
            "wechatAppid": args.appid,
            "title": title,
            "content": content,
            "summary": summary,
            "author": args.author or "",
            "coverImage": args.cover_image or "",
            "contentFormat": "markdown",
            "articleType": article_type,
        }
    else:
        raw_html = read_text(html_path)
        title = args.title or extract_html_title(raw_html, Path(html_path).stem)
        summary = args.summary or extract_summary(raw_html)
        payload = {
            "wechatAppid": args.appid,
            "title": title,
            "content": raw_html,
            "summary": summary,
            "author": args.author or "",
            "coverImage": args.cover_image or "",
            "contentFormat": "html",
            "articleType": article_type,
        }

    result = post_json("wechat-publish", payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="WeChat Official Account draft publisher")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_list = subparsers.add_parser("list-accounts", help="List authorized WeChat accounts")
    p_list.set_defaults(func=list_accounts)

    p_publish = subparsers.add_parser("publish", help="Publish an article to WeChat drafts")
    p_publish.add_argument("--appid", required=True, help="Target WeChat appid")
    p_publish.add_argument("--markdown", help="Path to markdown article")
    p_publish.add_argument("--html", help="Path to HTML article")
    p_publish.add_argument("--type", default="news", help="Article type: news or newspic")
    p_publish.add_argument("--title", help="Override article title")
    p_publish.add_argument("--summary", help="Override article summary")
    p_publish.add_argument("--author", help="Author name")
    p_publish.add_argument("--cover-image", dest="cover_image", help="Cover image URL")
    p_publish.set_defaults(func=publish)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
