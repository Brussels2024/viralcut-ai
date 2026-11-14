# Moment scoring

The first ranking engine is a deterministic baseline in `lib/analysis/moment-scorer.ts`.

## Signals

- Transcript: hook phrases, emphasis and speech density.
- Audio analysis: energy and vocal excitement, when supplied by an audio-analysis stage.
- Live engagement: chat velocity, unique chatters and emote ratio, when supplied by an authorized platform integration.
- Reactions: laughter, applause and surprise, when available.

Missing signals are treated as zero. The scorer never invents chat activity, audience reactions or audio measurements.

## Selection

The scorer evaluates candidate windows from 60 to 90 seconds, combines average signal strength with the strongest moment in the window, ranks candidates and suppresses overlapping results.

## Next improvements

- Replace the starter phrase list with language-aware semantic event detection.
- Add speaker turns and sentence-boundary alignment.
- Calibrate weights using human-rated clips and retention outcomes.
- Include platform-specific engagement signals only where APIs and permissions allow them.

The score is a ranking aid, not a guarantee that a clip will go viral.