const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, 'src', 'app');
function walk(d) {
  const ents = fs.readdirSync(d, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (p.includes('node_modules') || p.includes('.next')) continue;
      walk(p);
    } else if (e.name === 'page.tsx') {
      try {
        let c = fs.readFileSync(p, 'utf8');
        const m = c.match(/export const revalidate\s*=\s*([0-9]+)/);
        if (m) {
          const v = parseInt(m[1]);
          if (v < 172800) {
            let nv = Math.max(v * 3, 172800);
            if (nv > 259200) nv = 259200;
            if (nv !== v) {
              c = c.replace('export const revalidate = ' + v, 'export const revalidate = ' + nv);
              fs.writeFileSync(p, c);
              console.log('upd', p.replace(base + path.sep, ''), v, '->', nv);
            }
          }
        }
      } catch (e) {}
    }
  }
}
walk(base);
