import { DeferredDelete } from "./deferredDelete";

describe("DeferredDelete", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Timer expiry ───────────────────────────────────────────────────

  it("commits after the timer window expires", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    expect(dd.pendingId).toBe(42);
    expect(onCommit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    expect(onCommit).toHaveBeenCalledWith(42);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(dd.pendingId).toBeNull();
  });

  it("does not commit before the full window elapses", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(1);
    jest.advanceTimersByTime(4999);
    expect(onCommit).not.toHaveBeenCalled();
    expect(dd.pendingId).toBe(1);

    jest.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("uses default 5000ms window when none specified", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit);

    dd.request(1);
    jest.advanceTimersByTime(4999);
    expect(onCommit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  // ── Undo within window ────────────────────────────────────────────

  it("does not commit if undo is called within the window", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    expect(dd.pendingId).toBe(42);

    const result = dd.undo();
    expect(result).toBe(true);
    expect(dd.pendingId).toBeNull();

    // Let all timers fire — should be no-op
    jest.advanceTimersByTime(10_000);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("undo returns false when nothing is pending", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    expect(dd.undo()).toBe(false);
  });

  it("undo returns false after timer has already expired", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    jest.advanceTimersByTime(5000);
    expect(dd.undo()).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  // ── Navigation / unmount (flush) ──────────────────────────────────

  it("flush commits immediately before timer expires", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    dd.flush();
    expect(onCommit).toHaveBeenCalledWith(42);
    expect(dd.pendingId).toBeNull();

    // Timer should not fire again
    jest.advanceTimersByTime(10_000);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("flush is a no-op when nothing is pending", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.flush();
    dd.flush();
    expect(onCommit).not.toHaveBeenCalled();
  });

  // ── No double-commit ──────────────────────────────────────────────

  it("does not double-commit on flush after timer expiry", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    jest.advanceTimersByTime(5000);
    dd.flush(); // should be no-op
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not double-commit on multiple flush calls", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(42);
    dd.flush();
    dd.flush();
    dd.flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  // ── Sequential deletions ──────────────────────────────────────────

  it("requesting a new deletion flushes the previous one", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(1);
    dd.request(2);

    // First deletion committed immediately
    expect(onCommit).toHaveBeenCalledWith(1);
    expect(dd.pendingId).toBe(2);

    // Second commits after timer
    jest.advanceTimersByTime(5000);
    expect(onCommit).toHaveBeenCalledWith(2);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("undo only cancels the latest pending deletion", () => {
    const onCommit = jest.fn();
    const dd = new DeferredDelete(onCommit, 5000);

    dd.request(1);
    dd.request(2); // flushes 1
    expect(onCommit).toHaveBeenCalledWith(1);

    dd.undo(); // cancels 2
    jest.advanceTimersByTime(10_000);
    expect(onCommit).toHaveBeenCalledTimes(1); // only 1 was committed
  });

  // ── pendingId correctness ─────────────────────────────────────────

  it("pendingId is null initially", () => {
    const dd = new DeferredDelete(jest.fn());
    expect(dd.pendingId).toBeNull();
  });

  it("pendingId reflects current pending entry", () => {
    const dd = new DeferredDelete(jest.fn(), 5000);

    dd.request(10);
    expect(dd.pendingId).toBe(10);

    dd.undo();
    expect(dd.pendingId).toBeNull();

    dd.request(20);
    expect(dd.pendingId).toBe(20);

    jest.advanceTimersByTime(5000);
    expect(dd.pendingId).toBeNull();
  });
});
