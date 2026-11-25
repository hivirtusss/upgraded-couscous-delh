/** Limit parallel work — connection / memory safe */
export async function mapPool(items, concurrency, worker) {
  let idx = 0;
  const n = Math.max(1, Math.min(concurrency, 80));
  const runners = Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}