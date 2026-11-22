/** Bound storage, authentication, network and projection together, not just fetch. */
export async function withQueryDeadline<T>(task: (signal: AbortSignal) => Promise<T>, ms = 15000, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let cancel: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => { reject(new DOMException("Cancelled", "AbortError")); controller.abort(); };
    timer = setTimeout(() => {
      reject(new Error("Refresh timed out"));
      controller.abort();
    }, ms);
    if (parent?.aborted) cancel();
    else parent?.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([Promise.resolve().then(() => { controller.signal.throwIfAborted(); return task(controller.signal); }), deadline]); }
  finally { clearTimeout(timer!); parent?.removeEventListener("abort", cancel); }
}
