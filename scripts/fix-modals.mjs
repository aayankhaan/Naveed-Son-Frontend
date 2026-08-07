import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  "src/pages/Orders.jsx",
  "src/pages/Employees.jsx",
  "src/components/employees/EmployeePayModal.jsx",
  "src/components/employees/LoansTab.jsx",
  "src/components/costing/SetBuilderSection.jsx",
];

function ensureImport(src, rel) {
  if (src.includes("ModalLayer")) return src;
  if (rel.includes("components/employees") || rel.includes("components/costing")) {
    return src.replace(
      /from ["']\.\.\/\.\.\/constants\/theme["'];/,
      'from "../../constants/theme";\nimport ModalLayer from "../ui/ModalLayer";'
    );
  }
  if (src.includes('from "../components/layout/AppShell"')) {
    return src.replace(
      'import AppShell from "../components/layout/AppShell";',
      'import AppShell from "../components/layout/AppShell";\nimport ModalLayer from "../components/ui/ModalLayer";'
    );
  }
  return src.replace(
    /from ["']\.\.\/constants\/theme["'];/,
    'from "../constants/theme";\nimport ModalLayer from "../components/ui/ModalLayer";'
  );
}

function replaceOpeners(src) {
  return src
    .replace(
      /<div className="modal-overlay fixed inset-0 z-(\d+) flex items-center justify-center p-3 sm:p-6" onClick=\{onClose\}>/g,
      '<ModalLayer onClose={onClose} zClass="z-[$1]">'
    )
    .replace(
      /<div className="modal-overlay fixed inset-0 z-(\d+) flex items-center justify-center p-4" onClick=\{onClose\}>/g,
      '<ModalLayer onClose={onClose} zClass="z-[$1]" alignClass="items-center justify-center p-4">'
    )
    .replace(
      /<div className="modal-overlay fixed inset-0 z-(\d+) flex items-end sm:items-center justify-center p-0 sm:p-4" onClick=\{onClose\}>/g,
      '<ModalLayer onClose={onClose} zClass="z-[$1]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">'
    )
    .replace(
      /<div className="fixed inset-0 z-(\d+) flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay" onClick=\{onClose\}>/g,
      '<ModalLayer onClose={onClose} zClass="z-[$1]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">'
    )
    .replace(
      /<div className="modal-overlay fixed inset-0 z-(\d+) flex items-end sm:items-center justify-center p-0 sm:p-4" onClick=\{\(\) => !deleteBusy && setDeleting\(null\)\}>/g,
      '<ModalLayer onClose={() => !deleteBusy && setDeleting(null)} zClass="z-[$1]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">'
    );
}

function closeLayers(src) {
  const lines = src.split("\n");
  const out = [];
  let layerDepth = 0;
  let divDepthInside = 0;

  for (const original of lines) {
    if (original.includes("<ModalLayer")) {
      layerDepth += 1;
      divDepthInside = 0;
      out.push(original);
      continue;
    }

    if (layerDepth === 0) {
      out.push(original);
      continue;
    }

    const parts = original.split(/(<\/div>|<div\b[^>]*>)/);
    let rebuilt = "";
    for (const part of parts) {
      if (part.startsWith("<div")) {
        divDepthInside += 1;
        rebuilt += part;
      } else if (part === "</div>") {
        if (divDepthInside > 0) {
          divDepthInside -= 1;
          rebuilt += "</div>";
        } else if (layerDepth > 0) {
          rebuilt += "</ModalLayer>";
          layerDepth -= 1;
        } else {
          rebuilt += "</div>";
        }
      } else {
        rebuilt += part;
      }
    }
    out.push(rebuilt);
  }

  if (layerDepth !== 0) {
    throw new Error(`Unbalanced ModalLayer close, remaining=${layerDepth}`);
  }
  return out.join("\n");
}

for (const rel of files) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");
  src = ensureImport(src, rel);
  src = replaceOpeners(src);
  if (!src.includes("<ModalLayer")) {
    console.log("skip (no overlays matched):", rel);
    continue;
  }
  src = closeLayers(src);
  src = src.replace(/zClass="z-\[(\d+)\]"/g, (_, n) => `zClass="z-[${Math.max(Number(n), 90)}]"`);
  fs.writeFileSync(file, src);
  console.log("updated", rel);
}
