/**
 * Replace modal-overlay root elements with ModalLayer (portaled to body).
 * Stack walks character-by-character and counts <div ...> / </div>.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "src/pages/Orders.jsx",
  "src/pages/Employees.jsx",
  "src/pages/Costing.jsx",
];

function ensureImport(src) {
  if (src.includes('from "../components/ui/ModalLayer"') || src.includes("from '../components/ui/ModalLayer'")) {
    return src;
  }
  const markers = [
    'import AppShell from "../components/layout/AppShell";',
    'import Sidebar from "../components/layout/Sidebar";',
    'import MiniStat from "../components/ui/MiniStat";',
  ];
  for (const m of markers) {
    if (src.includes(m)) {
      return src.replace(m, `${m}\nimport ModalLayer from "../components/ui/ModalLayer";`);
    }
  }
  throw new Error("No import anchor found");
}

function findOverlayOpens(src) {
  const opens = [];
  const re = /<div\b[^>]*className="[^"]*modal-overlay[^"]*"[^>]*>/g;
  let m;
  while ((m = re.exec(src))) {
    opens.push({ start: m.index, end: m.index + m[0].length, tag: m[0] });
  }
  return opens;
}

function findMatchingClose(src, contentStart) {
  let i = contentStart;
  let depth = 1;
  while (i < src.length) {
    if (src.startsWith("</div>", i)) {
      depth -= 1;
      if (depth === 0) return { closeStart: i, closeEnd: i + 6 };
      i += 6;
      continue;
    }
    if (src.startsWith("<div", i)) {
      const ch = src[i + 4];
      if (ch === " " || ch === ">" || ch === "\n" || ch === "\r" || ch === "\t") {
        depth += 1;
      }
      i += 4;
      continue;
    }
    i += 1;
  }
  throw new Error("No matching </div>");
}

function toModalLayerOpen(tag) {
  const z = Math.max(Number((tag.match(/z-(\d+)/) || [, "90"])[1]), 90);
  const align = tag.includes("items-end")
    ? "items-end sm:items-center justify-center p-0 sm:p-4"
    : tag.includes('p-4"') || tag.includes("p-4 ")
      ? "items-center justify-center p-4"
      : "items-center justify-center p-3 sm:p-6";
  const oc = tag.match(/onClick=\{([\s\S]+)\}\s*>$/);
  if (!oc) throw new Error("No onClick in " + tag.slice(0, 120));
  return `<ModalLayer onClose={${oc[1]}} zClass="z-[${z}]" alignClass="${align}">`;
}

for (const rel of files) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");

  // If Costing already uses ModalLayer for add/edit, only convert leftover overlay divs
  src = ensureImport(src);
  const opens = findOverlayOpens(src);
  if (!opens.length) {
    console.log(rel, "no overlay divs left");
    fs.writeFileSync(file, src);
    continue;
  }

  // Replace from the end so indices stay valid
  for (let k = opens.length - 1; k >= 0; k--) {
    const open = opens[k];
    const { closeStart, closeEnd } = findMatchingClose(src, open.end);
    const openRepl = toModalLayerOpen(open.tag);
    src = src.slice(0, open.start) + openRepl + src.slice(open.end, closeStart) + "</ModalLayer>" + src.slice(closeEnd);
  }

  fs.writeFileSync(file, src);
  console.log(rel, "converted", opens.length, "overlays");
}
