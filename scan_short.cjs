const fs = require('fs');
const path = require('path');
const out = [];
function walk(d) {
  const ents = fs.readdirSync(d, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (p.includes('node_modules') || p.includes('.next')) continue;
      walk(p);
    } else if (e.name === 'page.tsx') {
      try {
        const c = fs.readFileSync(p, 'utf8');
        const m = c.match(/export const revalidate\s*=\s*([0-9]+)/);
        if (m) {
          const v = parseInt(m[1]);
          if (v < 86400) {
            out.push({ v, p: p.replace('C:\\Users\\Parth Gupta\\Desktop\\ZyniVerse\\src\\app\\', '') });
          }
        }
      } catch (e) {}
    }
  }
}
walk('C:\\Users\\Parth Gupta\\Desktop\\ZyniVerse\\src\\app');
out.sort((a,b)=>a.v-b.v);
for (const x of out) console.log(x.v + ': ' + x.p);
console.log('TOTAL:' + out.length);
