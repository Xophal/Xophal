const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walk(full));
      } else {
        results.push(full);
      }
    }
  } catch (e) {
    // ignore
  }
  return results;
}

const all = walk('src');
const filtered = all.filter(f => /callback|forgot|reset-password/i.test(f)).map(f => f.split(path.sep).join('/'));
console.log(filtered.join('\n'));
