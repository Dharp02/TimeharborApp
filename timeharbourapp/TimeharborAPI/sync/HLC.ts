/**
 * HLC — Hybrid Logical Clock for causal ordering across devices.
 *
 * An HLC timestamp combines:
 *   • physical time  – wall-clock milliseconds (provides rough ordering)
 *   • logical counter – disambiguates events at the same millisecond
 *   • node id         – breaks ties for concurrent events on different devices
 *
 * Format:  `{physicalMs}:{logicalCounter}:{nodeId}`
 * Example: `1712000000000:0:abc123`
 *
 * Comparison is lexicographic on the three components (physical first,
 * then logical, then node id) which gives a total order that respects
 * the happens-before relation.
 *
 * Reference: Kulkarni et al., "Logical Physical Clocks", 2014.
 */

export interface HLCTimestamp {
  /** Wall-clock milliseconds (Date.now()). */
  physical: number;
  /** Monotonically increasing counter within the same millisecond. */
  logical: number;
  /** Unique identifier of the originating device. */
  nodeId: string;
}

const SEPARATOR = ':';

/** Serialise an HLC to its canonical string form. */
export function pack(ts: HLCTimestamp): string {
  // Zero-pad physical to 15 digits so lexicographic sort matches numeric sort.
  const p = String(ts.physical).padStart(15, '0');
  // Zero-pad logical to 5 digits (supports up to 99 999 ops per ms per node).
  const l = String(ts.logical).padStart(5, '0');
  return `${p}${SEPARATOR}${l}${SEPARATOR}${ts.nodeId}`;
}

/** Deserialise an HLC string. */
export function unpack(encoded: string): HLCTimestamp {
  const parts = encoded.split(SEPARATOR);
  if (parts.length < 3) {
    throw new Error(`Invalid HLC string: ${encoded}`);
  }
  return {
    physical: Number(parts[0]),
    logical: Number(parts[1]),
    nodeId: parts.slice(2).join(SEPARATOR), // nodeId may contain colons (UUIDs)
  };
}

/**
 * Compare two HLC strings. Returns negative, zero, or positive
 * (same contract as Array.sort comparators).
 */
export function compare(a: string, b: string): number {
  const ta = unpack(a);
  const tb = unpack(b);
  if (ta.physical !== tb.physical) return ta.physical - tb.physical;
  if (ta.logical !== tb.logical) return ta.logical - tb.logical;
  return ta.nodeId < tb.nodeId ? -1 : ta.nodeId > tb.nodeId ? 1 : 0;
}

/**
 * A mutable HLC clock bound to a specific device (nodeId).
 *
 * Every call to `now()` returns a new timestamp that is guaranteed
 * to be strictly greater than any previously issued or received timestamp.
 */
export class HLC {
  private physical: number;
  private logical: number;
  private readonly nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.physical = Date.now();
    this.logical = 0;
  }

  /**
   * Issue a new local timestamp.
   * The wall clock advances the physical component;
   * if the wall clock hasn't moved, the logical counter increments.
   */
  now(): HLCTimestamp {
    const wall = Date.now();
    if (wall > this.physical) {
      this.physical = wall;
      this.logical = 0;
    } else {
      this.logical += 1;
    }
    return { physical: this.physical, logical: this.logical, nodeId: this.nodeId };
  }

  /**
   * Receive a remote timestamp and update the local clock so that
   * `now()` will always return something *after* the remote event.
   *
   * Call this when applying an op-log entry from another device.
   */
  receive(remote: HLCTimestamp): void {
    const wall = Date.now();
    if (wall > this.physical && wall > remote.physical) {
      this.physical = wall;
      this.logical = 0;
    } else if (remote.physical > this.physical) {
      this.physical = remote.physical;
      this.logical = remote.logical + 1;
    } else if (this.physical > remote.physical) {
      this.logical += 1;
    } else {
      // Same physical time — take the max logical and increment.
      this.logical = Math.max(this.logical, remote.logical) + 1;
    }
  }

  /** Convenience: issue a timestamp and return its packed string. */
  tick(): string {
    return pack(this.now());
  }
}
