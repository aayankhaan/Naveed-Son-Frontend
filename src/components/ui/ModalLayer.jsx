// ========================================
// ModalLayer.jsx
// Renders modal overlays on document.body so position:fixed is always
// relative to the viewport — never trapped by AppShell / page-enter.
// ========================================

import { createPortal } from "react-dom";

export default function ModalLayer({
  children,
  onClose,
  className = "",
  zClass = "z-[60]",
  alignClass = "items-center justify-center p-3 sm:p-6",
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`modal-overlay fixed inset-0 ${zClass} flex ${alignClass} ${className}`}
      onClick={onClose}
      role="presentation"
    >
      {children}
    </div>,
    document.body
  );
}
