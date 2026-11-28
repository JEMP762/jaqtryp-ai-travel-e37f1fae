export type RecordingSample = {
  automatic: boolean;
  elapsedMs: number;
  speechMs: number;
  peak: number;
  bytes: number;
};

// Capture this sample BEFORE cleaning up the microphone/VAD.
export function acceptsRecording(sample: RecordingSample): boolean {
  if (sample.bytes < 1200) return false;
  if (!sample.automatic) return sample.elapsedMs >= 400;
  return sample.elapsedMs >= 900 && sample.speechMs >= 280 && sample.peak >= 0.032;
}