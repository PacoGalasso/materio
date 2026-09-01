"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const NEW_WEIGHING_PATH = "/pesees/nouvelle";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.closest("[role=dialog]") !== null
  );
}

/** Global shortcut: N opens a new weighing. Ignored while typing in a control or in a dialog. */
export function KeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        router.push(NEW_WEIGHING_PATH);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
  return null;
}
