const fs = require('fs');
const path = require('path');
function walk(d, out) {
  const ents = fs.readdirSync(d, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (p.includes('node_modules') || p.includes('.next')) continue;
      walk(p, out);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      const c = fs.readFileSync(p, 'utf8');
      const m = c.match(/export const revalidate\s*=\s*([^\n;]+)/);
      if (m) {
        out.push({ p, v: m[1].trim() });
      }
    }
  }
}
const out = [];
walk(path.join(__dirname, 'src', 'app'), out);
const groups = {};
for (const o of out) {
  groups[o.v] = (groups[o.v] || 0) + 1;
}
const items = Object.entries(groups).sort((a,b)=>b[1]-a[1]);
for (const [k,v] of items) console.log(k + ': ' + v);
