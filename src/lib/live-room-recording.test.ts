import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { acceptsRecording } from "./live-room-recording";

describe("live room microphone capture", () => {
  it("preserves clear automatic speech after VAD cleanup", () => {
    const vad = { speechMs: 900, peak: 0.1 };
    const sample = { automatic: true, elapsedMs: 2500, bytes: 6000, ...vad };
    vad.speechMs = 0;
    vad.peak = 0;
    assert.equal(acceptsRecording(sample), true);
    assert.equal(acceptsRecording({ ...sample, ...vad }), false);
  });
  it("does not send silence or short accidental recordings to translation", () => {
    assert.equal(acceptsRecording({ automatic: true, elapsedMs: 24000, bytes: 6000, speechMs: 0, peak: 0.01 }), false);
    assert.equal(acceptsRecording({ automatic: false, elapsedMs: 200, bytes: 6000, speechMs: 0, peak: 0 }), false);
    assert.equal(acceptsRecording({ automatic: false, elapsedMs: 2000, bytes: 800, speechMs: 0, peak: 0 }), false);
  });
  it("keeps manual speech available in both directions", () => {
    assert.equal(acceptsRecording({ automatic: false, elapsedMs: 2000, bytes: 6000, speechMs: 0, peak: 0 }), true);
  });
});