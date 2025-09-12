class AbortManager {
  private controllers: Map<string, AbortController>;

  constructor() {
    this.controllers = new Map<string, AbortController>();
  }

  create(id?: string): { id: string; controller: AbortController } {
    const ctrl = new AbortController();
    const key = id || Math.random().toString(36).slice(2);
    this.controllers.set(key, ctrl);

    ctrl.signal.addEventListener("abort", () => {
      this.controllers.delete(key);
    });

    return { id: key, controller: ctrl };
  }

  get(id: string): AbortController | undefined {
    return this.controllers.get(id);
  }

  abort(id: string, reason?: any): boolean {
    const ctrl = this.controllers.get(id);
    if (!ctrl) return false;
    ctrl.abort(reason);
    this.controllers.delete(id);
    return true;
  }

  abortAll(reason?: any): void {
    for (const [id, ctrl] of this.controllers) {
      ctrl.abort(reason);
      this.controllers.delete(id);
    }
  }
}

export default new AbortManager();