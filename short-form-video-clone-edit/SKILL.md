---
name: short-form-video-clone-edit
description: End-to-end short-form video cloning + editing pipeline. Downloads influencer video, detects scenes (talking-head vs B-roll), generates HeyGen avatar with voice clone, overlays avatar onto talking-head segments with varied zoom levels, word-syncs audio to match original caption timing, preserves B-roll and sound design, renders final composite.
metadata:
  openclaw:
    emoji: 🎭
    requires:
      envVars: ["HEYGEN_API_KEY", "FAL_KEY"]
      anyBins: ["ffmpeg", "ffprobe", "yt-dlp", "python3"]
      pip: ["opencv-python-headless", "openai-whisper"]
---

# Face Swap Clone Pipeline

Clone influencer short-form content by replacing every appearance of their face with a HeyGen avatar, preserving all B-roll, transitions, and sound design.

## Key Config
- **HeyGen Avatar**: `bffc0e8dc3e44800be321cbf8f5c0bde`
- **Avatar Voice ID**: `f67cfcb304934863ad20346f5d181962`
- **Target influencer**: Nick Saraev (`@nick_saraev` on Instagram)
- **Working dir**: `~/.openclaw/workspace/face-swap-clone/`

## Environment Variables
- `HEYGEN_API_KEY` — HeyGen API key
- `FAL_KEY` — fal.ai API key (for face-swap fallback on split screens)
- `INSFORGE_URL` — `https://ey7rg8dm.us-east.insforge.app`
- `INSFORGE_KEY` — InsForge API key
- `INSFORGE_DB_URL` — Direct postgres connection string

## Working Directory Structure
```
face-swap-clone/
├── source/          # Downloaded influencer videos + transcripts
├── segments/        # Cut video segments (avatar + original)
│   └── v3/          # Per-version segment cuts
├── avatar/          # HeyGen avatar outputs + reference face
├── audio/           # Extracted and processed audio tracks
├── frames/          # Frame extraction for face detection
│   ├── split_screen/    # Frames needing face-swap
│   └── split_swapped/   # Face-swapped results
└── renders/         # Final composited outputs
```

## Pipeline Steps

### Step 1: Download Source Video
```bash
mkdir -p ~/.openclaw/workspace/face-swap-clone/{source,segments,avatar,audio,renders,frames}
yt-dlp -o "source/VIDEO_ID.%(ext)s" "VIDEO_URL"
```

### Step 2: Transcribe (Whisper)
Get word-level timestamps for the full script.
```bash
# Use whisper-transcribe skill or local whisper
whisper source/video.mp4 --model base --output_format json --word_timestamps True
```
Output: `source/transcript.json` with `words[]` array containing `{text, start, end}`.

### Step 3: Generate Full Avatar Video
Generate a single HeyGen avatar video speaking the COMPLETE transcript. This is used for ALL talking-head replacements.

```bash
curl -s -X POST "https://api.heygen.com/v2/video/generate" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video_inputs": [{
      "character": {
        "type": "avatar",
        "avatar_id": "bffc0e8dc3e44800be321cbf8f5c0bde",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "FULL_TRANSCRIPT_TEXT",
        "voice_id": "f67cfcb304934863ad20346f5d181962"
      }
    }],
    "dimension": {"width": 1080, "height": 1920},
    "aspect_ratio": "9:16"
  }'

# Poll until completed:
curl -s "https://api.heygen.com/v1/video_status.get?video_id=JOB_ID" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

**CRITICAL**: Speed-match the avatar audio to the original video duration:
```bash
# Calculate speed factor
ORIG_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 source/video.mp4)
AVATAR_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 avatar/avatar_full.mp4)
SPEED=$(python3 -c "print(round($AVATAR_DUR / $ORIG_DUR, 4))")

# Speed up avatar audio
ffmpeg -y -i avatar/avatar_full.mp4 -vn -acodec aac -ar 44100 audio/avatar_full.aac
ffmpeg -y -i audio/avatar_full.aac -filter:a "atempo=$SPEED" audio/avatar_audio_sped.aac

# Speed up avatar video
ffmpeg -y -i avatar/avatar_full.mp4 -vf "setpts=PTS/$SPEED,fps=24,scale=1080:1920" \
  -c:v libx264 -pix_fmt yuv420p -an segments/avatar_full_sped.mp4
```

### Step 4: Exhaustive Face Detection (CRITICAL — be anal about this)

Scan EVERY SINGLE FRAME for the influencer's face. Do NOT rely on rough scene boundaries. Influencer videos frequently cut back to talking head for split-second clips throughout B-roll sections.

```python
import cv2, json

cap = cv2.VideoCapture("source/video.mp4")
fps = cap.get(cv2.CAP_PROP_FPS)
cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
)

frame_num = 0
face_frames = []

while True:
    ret, frame = cap.read()
    if not ret:
        break
    small = cv2.resize(frame, (360, 640))  # Scale down for speed
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, 1.1, 3, minSize=(20, 20))
    # Filter: face must be >8% of frame height (ignore tiny faces in app mockups)
    big_faces = [f for f in faces if f[3] > 640 * 0.08]
    if len(big_faces) > 0:
        face_frames.append(frame_num)
    frame_num += 1

cap.release()

# Convert to ranges (allow 3-frame gaps to merge nearby detections)
ranges = []
if face_frames:
    start = face_frames[0]
    prev = face_frames[0]
    for f in face_frames[1:]:
        if f - prev > 3:
            ranges.append((start, prev))
            start = f
        prev = f
    ranges.append((start, prev))

# Add padding (2 frames each side) and save
padded = [(max(0, s - 2), min(frame_num - 1, e + 2)) for s, e in ranges]
```

**Key lesson**: Nick Saraev's videos (and most influencer reels) interleave talking-head clips throughout B-roll — 0.2s flashes, PIP overlays, split screens. The face scan must catch ALL of these.

### Step 5: Build Segment Plan

Convert face ranges to a segment plan alternating between avatar and original:

```python
segments = []  # list of ("avatar"|"original", start_sec, end_sec)
pos = 0.0
for start_frame, end_frame in padded_ranges:
    start_sec = start_frame / fps
    end_sec = (end_frame + 1) / fps
    if start_sec > pos:
        segments.append(("original", pos, start_sec))  # B-roll gap
    segments.append(("avatar", start_sec, end_sec))     # Face zone
    pos = end_sec
if pos < total_duration:
    segments.append(("original", pos, total_duration))
```

### Step 6: Cut Segments with FFmpeg

```bash
# For each segment:
# Avatar segments → cut from avatar_full_sped.mp4 (matching timestamps)
# Original segments → cut from source video (muted)
ffmpeg -y -ss START -i INPUT -t DURATION \
  -vf "fps=24,scale=1080:1920" \
  -c:v libx264 -pix_fmt yuv420p -an \
  segments/v3/seg_NN_TYPE.mp4
```

**Avatar zoom**: Apply ~4x zoom on avatar talking-head segments. HeyGen renders wide studio shots — need aggressive crop to match TikTok close-up framing:
```bash
# 1. Find face center with Haar cascade on a sample frame
# 2. Crop 270x480 centered on face (with upward offset for headroom)
# 3. Scale back to 1080x1920
ffmpeg -y -i avatar_full_sped.mp4 \
  -vf "crop=270:480:FACE_X-135:FACE_Y-160,scale=1080:1920:flags=lanczos" \
  -c:v libx264 -preset fast -crf 18 -c:a copy \
  segments/avatar_zoomed.mp4
```

### Step 7: Animated Captions (Fox Style)

Generate word-synced animated captions using Whisper timestamps. Place at middle-bottom of screen.

**Approach**: Use Remotion or FFmpeg drawtext with word-level timing from Whisper.

```bash
# FFmpeg drawtext with word timestamps
# For each word, calculate enable time window
ffmpeg -i video.mp4 -vf "
  drawtext=text='word1':fontsize=60:fontcolor=white:borderw=3:bordercolor=black:
    x=(w-tw)/2:y=h*0.75:enable='between(t,0.0,0.28)',
  drawtext=text='word2':fontsize=60:fontcolor=white:borderw=3:bordercolor=black:
    x=(w-tw)/2:y=h*0.75:enable='between(t,0.28,0.48)'
" output.mp4
```

**Fox caption style**: 
- Bold white text with black outline
- 3-4 words visible at a time (not word-by-word)
- Current word highlighted in accent color (yellow/green)
- Position: center-x, 75% down (middle-bottom)
- Font: Impact or similar bold sans-serif

### Step 8: Final Render

```bash
# Concat all video segments
ffmpeg -f concat -safe 0 -i concat.txt -c copy renders/video_only.mp4

# Add avatar audio + captions overlay
ffmpeg -y -i renders/video_only.mp4 -i audio/avatar_audio_sped.aac \
  -c:v copy -c:a aac -shortest \
  renders/final_clone.mp4
```

### Step 9: (Optional) Face-Swap Split Screens

For frames where the influencer appears alongside B-roll (split screen / PIP), and direct avatar cut looks jarring, use fal.ai frame-by-frame face swap:

```bash
# Extract split-screen frames
ffmpeg -y -i source/video.mp4 -ss START -to END \
  -vf "fps=24,scale=540:-1" frames/split_screen/frame_%04d.jpg

# Face swap via fal.ai (8 parallel workers)
# Reference face: avatar/reference_face.jpg
curl -s "https://fal.run/fal-ai/face-swap" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"base_image_url": "data:image/jpeg;base64,...", "swap_image_url": "data:image/jpeg;base64,..."}'

# Reassemble frames to video
ffmpeg -y -framerate 24 -i frames/split_swapped/frame_%04d.jpg \
  -vf "scale=1080:1920" -c:v libx264 -pix_fmt yuv420p segments/split_swapped.mp4
```

**Note**: fal.ai face-swap is ~40s/frame. Use only for split-screen sections where direct avatar cut would be jarring. For pure talking-head sections, always use direct avatar video — it's instant and looks better.

## Critical Lessons Learned

1. **Face detection must be exhaustive** — scan EVERY frame, not sample frames. Influencer reels have split-second face flashes throughout.
2. **Direct avatar insertion > face swap** — faster, higher quality. Only use fal.ai face-swap for split-screen/PIP sections.
3. **Speed-match is essential** — avatar speaks slower than original. Calculate exact speed factor and apply to both audio and video.
4. **Zoom avatar clips 4x** — HeyGen avatars render a wide studio shot. 1.3x is NOT enough. Use ~4x zoom (crop=270:480 from 1080x1920, centered on face, then scale back to 1080x1920) to match typical TikTok tight close-up framing. Find face center with Haar cascade first, then crop around it with slight upward offset for headroom.
5. **Strip ALL original audio** — the voiceover runs over B-roll sections too. Use only avatar audio.
6. **Haar cascade false positives** — filter by face size (>8% frame height) to ignore faces in app screenshots/mockups.
7. **Caption decision**: Check if original video already has burned-in captions. If YES → skip adding captions. If NO → burn animated fox-style captions using PIL frame-by-frame approach (ffmpeg drawtext requires freetype compilation).
8. **PIL caption burning** (when needed): Extract frames → burn Impact font text (white, yellow highlight on current word, black outline, 75% down) → reassemble with ffmpeg. Use `burn_captions.py` pattern.
7. **Pad face ranges** — add 2-frame buffer on each side to catch transition frames.
8. **Nick Saraev's handle**: `@nick_saraev` (not `@nicksaraev`)

## Database (InsForge)

**Direct SQL (preferred):**
```bash
PSQL="/opt/homebrew/opt/libpq/bin/psql"
$PSQL "$INSFORGE_DB_URL" -c "SELECT * FROM source_videos"
```

### Tables
- **source_videos** — influencer, platform, source_url, local_path, duration_seconds, transcript, status, metadata
- **scenes** — video_id, scene_type, start_time, end_time, description, has_face
- **avatar_jobs** — video_id, heygen_job_id, avatar_look_id, script_text, status, output_url, local_path
- **renders** — video_id, avatar_job_id, version, output_path, status, quality_notes
- **iterations** — video_id, render_id, iteration_number, changes_made, quality_score, notes
