"use client";
import { useLayoutEffect, type RefObject } from "react";
/** Fit the whole session, including actual header/buttons and safe-area padding. */
export function useStudyViewport(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      const card = element.querySelector<HTMLElement>(".study-flashcard");
      if (!card) return;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = element.getBoundingClientRect().top + window.scrollY;
      let bottom = 0;
      // The session has a plain visibility wrapper; safe-area spacing lives on
      // the outer page container, not necessarily its immediate parent.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        bottom += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      }
      const otherContent = element.offsetHeight - card.offsetHeight;
      const height = Math.max(120, Math.min(660, Math.floor(viewport - top - bottom - otherContent - 1)));
      const value = `${height}px`;
      if (element.style.getPropertyValue("--study-card-height") !== value) element.style.setProperty("--study-card-height", value);
    };
    window.scrollTo(0, 0); fit();
    const observer = new ResizeObserver(fit); observer.observe(element);
    // iOS can settle its top safe-area after the first render. That moves the
    // whole session without resizing the card, so watch the shell ancestors too.
    for (let parent = element.parentElement; parent; parent = parent.parentElement) observer.observe(parent);
    window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); };
  }, [ref]);
}
