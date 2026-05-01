"use client";

import { useEffect } from "react";

/**
 * Mounts at the top of the landing page and powers the swoop-on-
 * scroll animation system for browsers that don't yet support
 * native CSS scroll-driven animations (Safari and Firefox as of
 * this writing).
 *
 * Modern browsers (Chrome / Edge) ignore this entirely — their
 * @supports (animation-timeline: view()) branch in globals.css
 * already drives the animation natively, with zero JS overhead.
 *
 * For older browsers, we run a single shared IntersectionObserver
 * across every .swoop / .swoop-up / .swoop-left / .swoop-right /
 * .swoop-scale element. When one enters the viewport it gets the
 * .in-view class, which triggers the matching CSS transition. We
 * unobserve after first trigger — no need to re-animate on
 * scroll-back, that just creates motion noise.
 *
 * MutationObserver picks up elements added later (e.g. carousel
 * swaps) so dynamic content still gets the entrance.
 */
export function SwoopController() {
  useEffect(() => {
    // If view-timeline is supported, the CSS path handles
    // everything natively — bail out without setting up JS.
    if (
      typeof CSS !== "undefined" &&
      CSS.supports("animation-timeline: view()")
    ) {
      return;
    }

    const SELECTOR =
      ".swoop, .swoop-up, .swoop-left, .swoop-right, .swoop-scale";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        // Fire slightly before the element is fully visible so the
        // user sees motion arriving rather than already-arrived.
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    const observeAll = (root: ParentNode) => {
      root.querySelectorAll(SELECTOR).forEach((el) => observer.observe(el));
    };
    observeAll(document);

    // Watch for elements added after mount (carousel re-renders,
    // lazy-loaded sections, etc.). This is cheap because the swoop
    // page is a single document-tree mutation source.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) observer.observe(node);
          observeAll(node);
        });
      }
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
