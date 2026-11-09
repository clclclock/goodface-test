// G-160: the submission texts for Figma, read from the markdown files they are written in
// (docs/submission.md — frames 1–4; docs/audit.md — the three paragraphs of each problem).
// Used by build-plugin.js → DATA.submission → the «Add submission texts» command.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const clean = s => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

function frames(md) {
  return md.split(/\n## /).slice(1).filter(p => p.startsWith('Фрейм')).map(p => {
    const lines = p.split('\n');
    const title = lines[0].replace(/^Фрейм \d+ · /, '').replace(/\s*\(.*\)\s*$/, '').trim();
    const body = [];
    for (const raw of lines.slice(1)) {
      const l = raw.trim();
      if (!l || l === '---' || l.startsWith('>') || l.startsWith('**Пов')) continue;
      if (l.startsWith('|')) {
        if (/^\|[\s|:-]+\|$/.test(l)) continue;
        const c = l.split('|').slice(1, -1).map(clean);
        if (c[0] === 'Задача') continue;
        body.push({ t: 'row', a: c[0], b: c[1], c: c[2] || '' });
        continue;
      }
      if (/^[-*] /.test(l)) { body.push({ t: 'li', s: clean(l.slice(2)) }); continue; }
      if (/^\d+\. /.test(l)) { body.push({ t: 'li', s: clean(l) }); continue; }
      body.push({ t: 'p', s: clean(l) });
    }
    return { title, body };
  });
}

function audit(md) {
  const body = [{ t: 'p', s: 'П’ять проблем за впливом на три питання трейдера: чи я в плюсі і чи стабільно, де я втрачаю, що змінити.' }];
  for (const p of md.split(/\n## /).slice(1)) {
    const m = /^(\d+)\. (.+)/.exec(p.split('\n')[0]);
    if (!m) continue;
    body.push({ t: 'h', s: `${m[1]}. ${clean(m[2])}` });
    // one version per problem (G-168): three paragraphs «Що не так.» · «Чому важливо.» · «Що пропоную.»
    for (const head of ['Що не так', 'Чому важливо', 'Що пропоную']) {
      const l = p.split('\n').find(x => x.startsWith('**' + head + '.**'));
      if (!l) throw new Error('audit: problem ' + m[1] + ' has no «' + head + '»');
      body.push({ t: 'li', s: head + ': ' + clean(l.slice(head.length + 5)) });
    }
  }
  if (body.filter(b => b.t === 'h').length !== 5) throw new Error('audit: expected 5 problems');
  return { title: 'UX-аудит', wide: true, body };
}

module.exports = () => {
  const sub = fs.readFileSync(path.join(ROOT, 'docs', 'submission.md'), 'utf8');
  const aud = fs.readFileSync(path.join(ROOT, 'docs', 'audit.md'), 'utf8');
  const fr = frames(sub), after = fr.filter(f => f.title.startsWith('Як читати'));
  if (after.length !== 1) throw new Error('submission: expected one «Як читати цей файл» frame');
  // «how to read this file» goes first (review 2, G-174)
  return { frames: after.concat([audit(aud)], fr.filter(f => f !== after[0])) };
};
