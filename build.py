#!/usr/bin/env python3
"""Builds the website in site/ from the source files in this folder.
   Run:  python3 build.py   (then commit site/; GitHub Pages deploys it automatically)"""
import pathlib
ROOT = pathlib.Path(__file__).parent
JS = ['core.js', 'ai.js', 'art.js', 'casino.js', 'net.js', 'online.js', 'together.js', 'ui.js']
SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
head = (ROOT / 'head.html').read_text()
body = (ROOT / 'body.html').read_text()
code = '\n'.join((ROOT / f).read_text() for f in JS)
site = ROOT / 'site'
(site / 'js').mkdir(parents=True, exist_ok=True)
(site / 'js' / 'game.js').write_text(code)
t = head.index('</title>') + len('</title>')
(site / 'index.html').write_text(
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="description" content="A cartoon life sim: juggle jobs, school, rent and happiness to beat the Jones family. Play solo, pass-and-play, or online with friends.">\n'
    '<meta property="og:title" content="Keeping Up with the Joneses">\n'
    '<meta property="og:description" content="60 hours a week. Zero chill. A cartoon life sim for up to four players, solo, hot-seat or online.">\n'
    '<meta property="og:image" content="https://zcgrimshaw.github.io/keeping-up-with-the-joneses/assets/scr/cover_share.jpg">\n'
    '<meta name="twitter:card" content="summary_large_image">\n'
    '<link rel="icon" href="assets/jones/jones_jasper.webp">\n'
    + head[:t] + '\n' + head[t:]
    + '\n<style>html{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    '</head>\n<body>\n' + body
    + f'\n<script src="{SUPABASE_JS}"></script>\n<script src="config.js"></script>\n<script src="js/game.js"></script>\n</body>\n</html>\n')
print('built site/')
