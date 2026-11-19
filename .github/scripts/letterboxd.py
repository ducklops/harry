#!/usr/bin/env python3
"""Fetch Harry's Letterboxd RSS feed and save his most recent review to letterboxd.json.

Run by the "Latest Letterboxd review" GitHub Action every few hours.
Usage: python3 letterboxd.py [feed-url-or-file] [output-folder]
"""
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

FEED = 'https://letterboxd.com/harryhayw/rss/'
UA = 'Mozilla/5.0 (compatible; harryh.xyz latest-review bot)'
NS = {'letterboxd': 'https://letterboxd.com', 'dc': 'http://purl.org/dc/elements/1.1/'}


class Review(HTMLParser):
    """Turns the review HTML into plain paragraphs: [{"text": ..., "quote": bool}]."""

    def __init__(self):
        super().__init__()
        self.paras, self.buf, self.quote, self.poster = [], [], 0, None

    def flush(self):
        text = re.sub(r'[ \t]+', ' ', ''.join(self.buf)).strip()
        text = re.sub(r' *\n *', '\n', text)
        if text and text != 'This review may contain spoilers.':
            self.paras.append({'text': text, 'quote': self.quote > 0})
        self.buf = []

    def handle_starttag(self, tag, attrs):
        if tag == 'img' and not self.poster:
            self.poster = dict(attrs).get('src')
        elif tag == 'br':
            self.buf.append('\n')
        elif tag in ('p', 'blockquote', 'li'):
            self.flush()
            if tag == 'blockquote':
                self.quote += 1

    def handle_endtag(self, tag):
        if tag in ('p', 'blockquote', 'li'):
            self.flush()
            if tag == 'blockquote':
                self.quote = max(0, self.quote - 1)

    def handle_data(self, data):
        self.buf.append(data)


def read(src):
    if re.match(r'https?://', src):
        req = urllib.request.Request(src, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    with open(src, 'rb') as f:
        return f.read()


def stars(rating):
    if rating is None:
        return ''
    whole, half = int(rating), rating - int(rating) >= 0.5
    return '★' * whole + ('½' if half else '')


def latest(feed_bytes):
    items = ET.fromstring(feed_bytes).findall('./channel/item')
    films = [i for i in items if (i.findtext('guid') or '').startswith(('letterboxd-review-', 'letterboxd-watch-'))]
    reviews = [i for i in films if (i.findtext('guid') or '').startswith('letterboxd-review-')]
    item = (reviews or films or [None])[0]
    if item is None:
        return None
    lb = lambda k: item.findtext('letterboxd:' + k, namespaces=NS)
    parser = Review()
    parser.feed(item.findtext('description') or '')
    parser.flush()
    rating = lb('memberRating')
    rating = float(rating) if rating else None
    title = item.findtext('title') or ''
    return {
        'id': item.findtext('guid'),
        'film': html.unescape(lb('filmTitle') or ''),
        'year': lb('filmYear') or '',
        'rating': rating,
        'stars': stars(rating),
        'liked': lb('memberLike') == 'Yes',
        'rewatch': lb('rewatch') == 'Yes',
        'watched': lb('watchedDate') or '',
        'spoilers': '(contains spoilers)' in title,
        'link': item.findtext('link') or '',
        'poster': parser.poster or '',
        'paragraphs': [p for p in parser.paras if not re.fullmatch(r'Watched on .+\d{4}\.', p['text'])],
        'profile': 'https://letterboxd.com/harryhayw/',
    }


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else FEED
    out = sys.argv[2] if len(sys.argv) > 2 else '.'
    data = latest(read(src))
    if not data:
        print('No films in the feed; leaving letterboxd.json as it is.')
        return
    path = os.path.join(out, 'letterboxd.json')
    try:
        with open(path, encoding='utf-8') as f:
            old = json.load(f)
    except (OSError, ValueError):
        old = {}
    # keep the poster on harryh.xyz itself, so visitors' browsers never call Letterboxd
    if data['poster'].startswith('http'):
        if old.get('id') == data['id'] and old.get('poster', '').startswith('letterboxd/'):
            data['poster'] = old['poster']
        else:
            try:
                img = read(data['poster'])
                os.makedirs(os.path.join(out, 'letterboxd'), exist_ok=True)
                with open(os.path.join(out, 'letterboxd', 'poster.jpg'), 'wb') as f:
                    f.write(img)
                data['poster'] = 'letterboxd/poster.jpg?v=' + re.sub(r'\D', '', data['id'])
            except Exception as e:  # keep the Letterboxd address if the download fails
                print('Poster download failed:', e)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('Latest review:', data['film'], data['year'], data['stars'])


if __name__ == '__main__':
    main()
