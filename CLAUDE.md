# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI OS Skills** — A collection of 51 automation skills for AI Operating Systems powered by [Clawdbot](https://github.com/clawdbot/clawdbot). Each skill is a self-contained module that extends agent capabilities for social media automation, content creation, and lead generation.

## Architecture

### Skill Structure
Each skill follows a consistent pattern:
```
skill-name/
├── SKILL.md           # Skill documentation and usage
├── scripts/           # Executable scripts (.js or .py)
└── references/        # Optional: reference docs for RAG
```

### Execution Patterns

**Instruction-based skills** — Agent reads SKILL.md and executes logic directly via API calls:
- Use Late API for social inbox/engagement
- Use HeyGen API for avatar video generation
- Use Gemini/Claude for content generation

**Script-based skills** — Run directly via CLI:
```bash
# JavaScript skills
node skills/<skill-name>/scripts/<script>.js [options]

# Python skills
python3 skills/<skill-name>/scripts/<script>.py [options]
```

### Core Integrations

| Platform | Purpose | Env Vars |
|----------|---------|----------|
| **Late API** | Unified social inbox (IG, FB, Twitter, LinkedIn, YouTube) | `LATE_API_KEY` |
| **HeyGen** | Avatar video generation | `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID` |
| **Gemini** | Video analysis, content generation | `GEMINI_API_KEY` |
| **Anthropic** | AI-personalized DM messages | `ANTHROPIC_API_KEY` |
| **Instantly.ai** | Cold email campaigns | `INSTANTLY_API_KEY` |
| **InsForge** | PostgreSQL database access | `INSFORGE_URL`, `INSFORGE_KEY`, `INSFORGE_DB_URL` |
| **Apify** | Google Maps scraping | `APIFY_API_KEY` |
| **fal.ai** | Face-swap for video cloning | `FAL_KEY` |

### Database Schema

Skills use PostgreSQL via InsForge. Key tables:
- `business_leads` — Lead data with `outreach_status` tracking
- `instagram_leads` — Instagram DM targets
- `social_inbox` — Message tracking with `direction`, `replied`, `late_message_id`
- `gemini_video_agent` — Video generation jobs
- `source_videos`, `scenes`, `avatar_jobs`, `renders` — Video cloning pipeline

## Skill Categories

| Category | Skills |
|----------|--------|
| **Content Creation** | carousel-gen, infographic-gen, gemini-viral-shorts, klap-generate-shorts, nano-banana-image-gen, short-video, veo-video, youtube-to-heygen-video, youtube-to-heygen-longform, youtube-to-viral-posts |
| **Video Cloning** | short-form-video-clone-edit, longform-video-clone-edit, wan-video-clone |
| **Publishing** | carousel-publish, infographic-publish, short-publish, stories-publish, youtube-upload, linkedin-post, post-publish-folder, short-publish-folder, stories-publish-folder, longform-publish-folder |
| **Social Engagement** | comment-responder, instagram-engage, linkedin-engage, twitter-engage, youtube-engage, social-inbox-agent |
| **Lead Generation** | apify-google-maps, facebook-page-finder, instagram-lead-scraper, linkedin-profile-scraper, lead-enrichment, lead-scrape-orchestrator, linkedin-email-enrichment, linkedin-lead-enrichment |
| **Outreach** | facebook-outreach, instagram-dm-sales-agent, instantly-email, linkedin-connect, linkedin-message-agent, whatsapp-outreach |
| **Analytics** | account-analytics, post-analytics, linkedin-connection-agent, linkedin-notifications |
| **Utilities** | find-skills, knowledge-graph-reindex |

## Key Skills Deep Dive

### comment-responder
Auto-responds to comments across platforms. Tracks state in `replied-comments.json`.
```bash
node skills/comment-responder/scripts/comment-response-agent.js --limit 20 --platform instagram
```

### instagram-dm-sales-agent
Playwright-based DM automation using Inbox Compose Method. Supports multi-account.
```bash
python3 skills/instagram-dm-sales-agent/scripts/instagram_dm_sales_agent.py --limit 10 --template ai --headless
```

### short-form-video-clone-edit
End-to-end video cloning: download → transcribe → avatar gen → face detection → segment cut → composite.
```bash
# Pipeline uses: yt-dlp, whisper, HeyGen API, ffmpeg, OpenCV, fal.ai face-swap
# Working dir: ~/.openclaw/workspace/face-swap-clone/
```

### social-inbox-agent
AI DM responder with PostgreSQL tracking. Runs every 1 minute via cron.
```bash
node skills/social-inbox-agent/scripts/dm-response-agent.js --limit 10 --dry-run
```

### instantly-email
Full cold email pipeline: lead upload → campaign activate → analytics → reply sync.
```bash
node skills/instantly-email/scripts/instantly-setup.js
node skills/instantly-email/scripts/instantly-upload.js --limit 50
node skills/instantly-email/scripts/instantly-sync-replies.js
```

### knowledge-graph-reindex
Rebuilds RAG knowledge graph. Run after adding skills or changing config.
```bash
node skills/knowledge-graph-reindex/scripts/reindex.js
```

## Development Patterns

### Environment Setup
Most skills require:
```bash
# Copy .env.example (if exists) or set manually
export DATABASE_URL=postgresql://...
export LATE_API_KEY=xxx
export GEMINI_API_KEY=xxx
```

### Python Dependencies
```bash
pip install playwright anthropic psycopg2-binary python-dotenv colorama google-generativeai requests opencv-python-headless openai-whisper
playwright install chromium
```

### FFmpeg Tools
Video skills require: `ffmpeg`, `ffprobe`, `yt-dlp`
```bash
brew install ffmpeg yt-dlp
```

### Cron Configuration
Skills designed for cron execution:
- `social-inbox-agent` — every 1 minute
- `instantly-email` — 06:00 (upload), 18:00 (analytics sync)
- `knowledge-graph-reindex` — weekly (optional)

## Important Notes

1. **State Management** — Modern skills use PostgreSQL for state (no race conditions). Legacy skills may use JSON files.
2. **Rate Limiting** — Instagram DMs: start at 120s delay, 20-30/day. Adjust based on account health.
3. **Anti-Detection** — Browser automation uses stealth flags, session persistence, random delays.
4. **Platform Limits** — Late API does NOT support TikTok comments.
5. **Video Cloning** — Direct avatar insertion > face-swap. Only use fal.ai for split-screen sections.
