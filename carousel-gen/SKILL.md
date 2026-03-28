# carousel-gen

Multi-image carousel pipeline for {{PERSONA_NAME}} — generates on-brand carousel slides promoting Samoa tourism via {{BRAND_NAME}}.

## How It Works

1. **Content Ideation** — Gemini generates a carousel concept: topic, slide count (6-10), per-slide caption text, and per-slide image prompts based on {{PERSONA_NAME}}'s content pillars.
2. **Image Generation** — FAL nano-banana-2 generates each slide image using {{PERSONA_NAME}}'s reference face for character consistency.
3. **Text Overlay** — ffmpeg `drawtext` burns clean, bold slide text onto each image.
4. **Output** — Images + sidecar JSON saved to `~/{{PersonaDir}}/carousels/{date}-{slug}/`

## Usage

```bash
node skills/carousel-gen/scripts/carousel-gen.js [options]

Options:
  --topic "Samoa's Best Beaches"   # Override auto-topic selection
  --slides 8                       # Override slide count (default: Gemini decides, 6-10)
  --dry-run                        # Print carousel plan, skip image generation
```

## Output

- Slide images: `~/{{PersonaDir}}/carousels/{date}-{slug}/slide-01.png` through `slide-N.png`
- Metadata sidecar: `~/{{PersonaDir}}/carousels/{date}-{slug}/carousel.json`

## Prerequisites

- `GEMINI_API_KEY` in `.env`
- `FAL_KEY` in `.env`
- ffmpeg installed
- Reference image: `brand-content/persona/reference.png`

## Content Pillars (auto-rotated)

1. Hidden Samoa
2. Local Life
3. Adventure
4. Business Spotlight
5. Travel Tips
6. Culture Education
