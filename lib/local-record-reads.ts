const READ_LIMIT = 32;
const BUDGET_KEY = Symbol.for("pippi.local-record-read-budget.v1");
type Budget = { active: number; waiting: (() => void)[] };
const realm = globalThis as typeof globalThis & { [BUDGET_KEY]?: Budget };
// Separate route bundles and module reloads in the same Node realm share live
// permits. Other processes/worker realms have their own budget; no data is cached.
const budget = realm[BUDGET_KEY] ??= { active: 0, waiting: [] };

function acquire(): Promise<() => void> {
  return new Promise(resolve => {
    const admit = () => {
      budget.active++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        budget.active--;
        // Reserve the free slot synchronously for the oldest waiter. A new call
        // cannot bypass it between waking the promise and its continuation.
        budget.waiting.shift()?.();
      });
    };
    if (budget.active < READ_LIMIT && !budget.waiting.length) admit();
    else budget.waiting.push(admit);
  });
}

/** Covers the actual local read/parse, never an outer listing or write that
 * would recursively request another permit. An abandoned caller cannot release
 * a still-running read: its slot stays occupied until the operation settles. */
export async function withLocalRecordRead<T>(operation: () => Promise<T> | T): Promise<T> {
  const release = await acquire();
  try { return await operation(); }
  finally { release(); }
}
