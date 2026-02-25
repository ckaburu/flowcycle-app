/**
 * Manages a single deferred (undoable) deletion.
 *
 * Timer-based: deletion commits after windowMs unless undo() is called.
 * Pure JS — no React dependencies.
 *
 * Guarantees:
 *  - At most one pending deletion at a time.
 *  - Requesting a new deletion flushes any existing pending one first.
 *  - flush() / dispose are idempotent — safe to call from multiple cleanup paths.
 *  - No double-commit (guarded by _committed flag).
 */
export class DeferredDelete {
  private _pendingId: number | null = null;
  private _timerId: ReturnType<typeof setTimeout> | null = null;
  private _committed = false;

  private readonly _onCommit: (id: number) => void;
  private readonly _windowMs: number;

  constructor(onCommit: (id: number) => void, windowMs = 5000) {
    this._onCommit = onCommit;
    this._windowMs = windowMs;
  }

  /** The ID of the entry pending deletion, or null if none/already committed. */
  get pendingId(): number | null {
    return this._committed ? null : this._pendingId;
  }

  /**
   * Start a deferred deletion.
   * If another deletion is already pending, it is committed immediately first.
   */
  request(id: number): void {
    this.flush();

    this._pendingId = id;
    this._committed = false;
    this._timerId = setTimeout(() => {
      this._commit();
    }, this._windowMs);
  }

  /** Cancel the pending deletion. Returns true if undo succeeded. */
  undo(): boolean {
    if (this._pendingId === null || this._committed) return false;
    this._clearTimer();
    this._pendingId = null;
    return true;
  }

  /** Immediately commit any pending deletion. Idempotent. */
  flush(): void {
    this._commit();
  }

  private _commit(): void {
    if (this._pendingId === null || this._committed) return;
    this._committed = true;
    this._clearTimer();
    this._onCommit(this._pendingId);
  }

  private _clearTimer(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }
}
