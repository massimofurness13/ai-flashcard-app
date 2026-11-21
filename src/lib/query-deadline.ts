/** Bound storage, authentication, network and projection together, not just fetch. */
export async function withQueryDeadline<T>(task: (signal: AbortSignal) => Promise<T>, ms = 15000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Refresh timed out"));
    }, ms);
  });
  try { return await Promise.race([task(controller.signal), deadline]); }
  finally { clearTimeout(timer!); }
}
