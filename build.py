#!/bin/python
import re, subprocess

html = open('view.html').read().split('<!-- split -->')[1].strip()
css = open('view.css').read()
js = open('core.js').read()

html = re.sub(r'(^\s*)', r"\1'", html, flags=re.M)
html = re.sub(r'$', '\' +', html, flags=re.M).replace('\n', '\n        ')

css = css.replace(': ', ':').replace('{\n', '{').replace(';\n', '; ').replace('\n\n', '\n').replace(',\n', ', ')
css = re.sub(r'(;|\{)\s*', r'\1 ', css).replace('{ ', '{').replace(' }', "}' +").replace('/*', '//').replace(' */', '')
css = re.sub(r'^(\s*)(?!//)([^\s].*)$', r"\1'\2", css, flags=re.M)

js = js.replace("'!html'", html[:-2]).replace("'!css' +", css)

open('simpleviewer.js', 'w').write(js)
subprocess.call('notify-send -t 1 Done', shell=True)