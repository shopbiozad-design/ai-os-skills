# AI OS Skills

A collection of 51 automation skills for AI Operating Systems powered by [Clawdbot](https://github.com/clawdbot/clawdbot).

## Skills Index

### Content Creation
| Skill | Description |
|-------|-------------|
| `carousel-gen` | Generate carousel images for social media |
| `carousel-publish` | Publish carousels to Instagram/LinkedIn |
| `gemini-viral-shorts` | Generate viral posts from YouTube using Gemini |
| `infographic-gen` | Generate infographics |
| `infographic-publish` | Publish infographics to social platforms |
| `klap-generate-shorts` | Generate short-form clips from YouTube via Klap |
| `nano-banana-image-gen` | AI image generation |
| `short-video` | Create short-form video content |
| `shorts-creatorclaw` | Short-form video pipeline |
| `stories-gen` | Generate Instagram/Facebook stories |
| `veo-video` | Generate AI videos with Google Veo 3 |
| `youtube-to-heygen-longform` | Convert YouTube to long-form avatar videos |
| `youtube-to-heygen-video` | Convert YouTube to short-form avatar videos |
| `youtube-to-viral-posts` | Convert YouTube videos to viral text posts |

### Video Cloning
| Skill | Description |
|-------|-------------|
| `longform-video-clone-edit` | Clone longform videos with HeyGen avatar |
| `short-form-video-clone-edit` | Clone short-form videos with face swap |
| `wan-video-clone` | Clone videos using WAN 2.2 animate |

### Publishing
| Skill | Description |
|-------|-------------|
| `longform-publish-folder` | Publish long-form videos to YouTube |
| `post-publish-folder` | Publish posts from local folder |
| `short-publish` | Publish shorts to social platforms |
| `short-publish-folder` | Publish shorts from local folder |
| `stories-publish` | Publish stories to Instagram/Facebook |
| `stories-publish-folder` | Publish stories from local folder |
| `youtube-upload` | Upload videos to YouTube |
| `linkedin-post` | Post content to LinkedIn |

### Social Engagement
| Skill | Description |
|-------|-------------|
| `comment-responder` | AI-powered comment responses |
| `instagram-engage` | Like/comment on Instagram posts |
| `linkedin-engage` | Engage with LinkedIn posts |
| `twitter-engage` | Engage with Twitter/X content |
| `youtube-engage` | Engage with YouTube comments |
| `social-inbox-agent` | AI DM responder across platforms |

### Lead Generation & Outreach
| Skill | Description |
|-------|-------------|
| `apify-google-maps` | Scrape business leads from Google Maps |
| `facebook-page-finder` | Find Facebook pages for businesses |
| `instagram-lead-scraper` | Scrape Instagram post likers |
| `linkedin-profile-scraper` | Search and scrape LinkedIn profiles |
| `lead-enrichment` | Enrich leads with emails/phones |
| `lead-scrape-orchestrator` | Orchestrate multi-source lead scraping |
| `linkedin-email-enrichment` | Find emails for LinkedIn leads |
| `linkedin-lead-enrichment` | Enrich LinkedIn lead data |

### Outreach
| Skill | Description |
|-------|-------------|
| `facebook-outreach` | Send Facebook Messenger DMs |
| `instagram-dm-sales-agent` | Automated Instagram DM outreach |
| `instantly-email` | Cold email via Instantly.ai |
| `linkedin-connect` | Send LinkedIn connection requests |
| `linkedin-message-agent` | Check/respond to LinkedIn messages |
| `whatsapp-outreach` | Send WhatsApp messages |

### Analytics & Monitoring
| Skill | Description |
|-------|-------------|
| `account-analytics` | Track account metrics across platforms |
| `post-analytics` | Track post performance |
| `linkedin-connection-agent` | Track LinkedIn connection analytics |
| `linkedin-notifications` | Monitor LinkedIn notifications |

### Utilities
| Skill | Description |
|-------|-------------|
| `find-skills` | Discover and install new skills |
| `knowledge-graph-reindex` | Rebuild the knowledge graph RAG |

## Installation

Each skill is self-contained with a `SKILL.md` and optional `scripts/` directory.

1. Copy the skill folder to your Clawdbot workspace `skills/` directory
2. Re-index your knowledge graph (if using RAG)
3. The agent will auto-discover the skill

## Usage

Skills are instruction-based or script-based:

**Instruction-based:** Ask your agent to run the skill
```
"Clone this YouTube video using the short-form-video-clone-edit skill"
```

**Script-based:** Run directly or via cron
```bash
node skills/comment-responder/scripts/comment-responder.js --limit 20
```

## License

MIT

---

Built for [Creator Claw](https://github.com/kevinbadi) AI OS
