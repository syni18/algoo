// abortManager.ts
import { randomUUID } from "crypto";

type AbortEntry = {
  id: string;
  controller: AbortController;
  timer?: NodeJS.Timeout;
};

class AbortManager {
  private controllers = new Map<string, AbortEntry>();

  create(timeoutMs?: number): AbortEntry {
    const id = randomUUID();
    const controller = new AbortController();

    const entry: AbortEntry = { id, controller };

    if (timeoutMs) {
      entry.timer = setTimeout(() => {
        controller.abort(new Error("timeout"));
      }, timeoutMs);
    }

    this.controllers.set(id, entry);
    return entry;
  }

  abort(id: string): void {
    const entry = this.controllers.get(id);
    if (!entry) return;
    if (!entry.controller.signal.aborted) {
      entry.controller.abort(new Error("manual-abort"));
    }
    if (entry.timer) clearTimeout(entry.timer);
    this.controllers.delete(id);
  }
}

export const abortManager = new AbortManager();
