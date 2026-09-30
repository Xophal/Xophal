const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
let i = 0;
let line = 1;
let inStr = null;
let inLine = false;
let inBlock = false;
const stack = [];

while (i < src.length) {
  const c = src[i];
  const n = src[i + 1];
  if (c === "\n") {
    line += 1;
    inLine = false;
    i += 1;
    continue;
  }
  if (inLine) {
    i += 1;
    continue;
  }
  if (inBlock) {
    if (c === "*" && n === "/") {
      inBlock = false;
      i += 2;
      continue;
    }
    i += 1;
    continue;
  }
  if (inStr) {
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === inStr) inStr = null;
    i += 1;
    continue;
  }
  if (c === "/" && n === "/") {
    inLine = true;
    i += 2;
    continue;
  }
  if (c === "/" && n === "*") {
    inBlock = true;
    i += 2;
    continue;
  }
  if (c === "'" || c === '"' || c === "`") {
    inStr = c;
    i += 1;
    continue;
  }
  if (c === "(" || c === "{" || c === "[") {
    stack.push({ c, line });
    i += 1;
    continue;
  }
  if (c === ")" || c === "}" || c === "]") {
    const open = stack.pop();
    if (!open) console.log(`extra closing '${c}' at line ${line}`);
    i += 1;
    continue;
  }
  i += 1;
}

console.log("unclosed (last 15):");
for (const item of stack.slice(-15)) console.log(`  '${item.c}' opened at line ${item.line}`);
console.log(`total unclosed: ${stack.length}, string state: ${inStr}`);
