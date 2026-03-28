#!/usr/bin/env node
/**
 * carousel-gen — Multi-image carousel pipeline
 *
 * 1. Gemini generates carousel concept (topic, slides, per-slide text + image prompts)
 * 2. FAL nano-banana-2 generates each slide image
 * 3. ffmpeg drawtext overlays slide text onto each image
 * 4. Output saved to ~/{PersonaName}/carousels/{date}-{slug}/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadPersonaContext, getOutputDir } = require('../../../lib/persona');

// ============================================================================
// Config
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FAL_KEY = process.env.FAL_KEY;

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const persona = loadPersonaContext(ROOT_DIR);
const REF_IMAGE = path.join(ROOT_DIR, 'brand-content', 'reference-hero.png');
const OUTPUT_BASE = getOutputDir('carousels', ROOT_DIR);
const LAST_PILLAR_PATH = path.join(OUTPUT_BASE, '.last-pillar');

// ============================================================================
// Topic Bank (from INFORMATION.md)
// ============================================================================

const TOPICS = [
  { topic: "Samoa's Best Beaches", pillar: 'adventure', hook: "Samoa has beaches that don't even look real." },
  { topic: 'To Sua Ocean Trench', pillar: 'hidden-samoa', hook: 'Have you heard of the ocean trench you can swim in?' },
  { topic: 'Samoan Food Guide', pillar: 'local-life', hook: "Here's everything you need to eat in Samoa." },
  { topic: 'Sunday in Samoa', pillar: 'local-life', hook: "Sunday in Samoa hits different. Let me show you why." },
  { topic: "Samoa's Most Beautiful Waterfalls", pillar: 'hidden-samoa', hook: "These waterfalls are hidden deep in the Samoan jungle." },
  { topic: 'Savai\'i Island Guide', pillar: 'adventure', hook: "The biggest island in Samoa and most tourists skip it." },
  { topic: 'Fa\'asamoa — The Samoan Way', pillar: 'culture-education', hook: "The word fa'asamoa doesn't translate to English." },
  { topic: 'Beach Fale Stays', pillar: 'business-spotlight', hook: "What does a $40/night beach stay in the Pacific look like?" },
  { topic: 'First Time in Samoa Tips', pillar: 'travel-tips', hook: "Things I wish someone told me before visiting Samoa." },
  { topic: 'Samoan Tattoo Pe\'a and Malu', pillar: 'culture-education', hook: "Samoan tattoo is one of the most sacred practices in the world." },
  { topic: 'Apia City Guide', pillar: 'local-life', hook: "The capital of Samoa is tiny but full of surprises." },
  { topic: 'Snorkeling Samoa Coral Reefs', pillar: 'adventure', hook: "The coral reefs here look like someone photoshopped them." },
  { topic: 'Samoan Umu Earth Oven', pillar: 'local-life', hook: "The umu started at 5am. By noon, you understand everything." },
  { topic: 'Fire Knife Dance Siva Afi', pillar: 'culture-education', hook: "The fire knife dance originated in Samoa." },
  { topic: 'Getting Around Samoa', pillar: 'travel-tips', hook: "No Uber, no metro. Here's how you actually get around." },
];

const PILLARS = [
  'hidden-samoa', 'local-life', 'adventure',
  'business-spotlight', 'travel-tips', 'culture-education',
];

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { topic: null, slides: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--topic': opts.topic = args[++i]; break;
      case '--slides': opts.slides = parseInt(args[++i]); break;
      case '--dry-run': opts.dryRun = true; break;
    }
  }
  return opts;
}

// ============================================================================
// Pillar Rotation
// ============================================================================

function getNextPillar() {
  if (fs.existsSync(LAST_PILLAR_PATH)) {
    const last = fs.readFileSync(LAST_PILLAR_PATH, 'utf8').trim();
    const idx = PILLARS.indexOf(last);
    return PILLARS[(idx + 1) % PILLARS.length];
  }
  return PILLARS[0];
}

function savePillar(pillar) {
  fs.writeFileSync(LAST_PILLAR_PATH, pillar);
}

function selectTopic(topicOverride) {
  if (topicOverride) {
    const match = TOPICS.find(t => t.topic.toLowerCase() === topicOverride.toLowerCase());
    if (match) return match;
    return { topic: topicOverride, pillar: getNextPillar(), hook: null };
  }
  const pillar = getNextPillar();
  const candidates = TOPICS.filter(t => t.pillar === pillar);
  if (candidates.length === 0) return TOPICS[Math.floor(Math.random() * TOPICS.length)];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ============================================================================
// Gemini — Generate Carousel Plan
// ============================================================================

async function generateCarouselPlan(topicObj, slideCount) {
  const slideCountInstruction = slideCount
    ? `Create exactly ${slideCount} slides.`
    : 'Decide the optimal slide count (between 6 and 10).';

  const prompt = `You are creating a carousel post for ${persona.name} — the brand persona for ${persona.brand}.
${persona.voice ? `\nVoice guide:\n${persona.voice}\n` : ''}

Topic: "${topicObj.topic}"
${topicObj.hook ? `Hook: "${topicObj.hook}"` : ''}
Pillar: ${topicObj.pillar}

${slideCountInstruction}

IMPORTANT — The overlay text across all slides must tell a STORY. As the user swipes through, the text reads like a narrative — each slide continues where the last left off. Think of it like a mini blog post split across slides. Example flow:
- Slide 1: "Samoa has beaches that don't look real"
- Slide 2: "This is Lalomanu Beach"
- Slide 3: "White sand, turquoise water, zero crowds"
- Slide 4: "But my favorite part?"
- Slide 5: "Sleeping in a fale right on the beach"
- Slide 6: "For $40 a night. I'm not kidding."
- Slide 7: "Add Samoa to your list. Trust me."

For each slide provide:
1. The overlay text — MAX 6 WORDS. Short, punchy, fits on one line. This is critical for readability on mobile.
2. An image generation prompt describing the scene (vivid, specific, Samoa-related)
3. Whether the persona should appear in this slide — YES or NO. Use YES for intro/outro slides or when showing a person experiencing a place. Use NO for landscape shots, food close-ups, aerial views, cultural objects, etc. Most slides should be NO.

Also provide:
- A carousel caption for Instagram (2-3 sentences in the persona's voice + CTA + hashtags)
- 8-10 relevant hashtags

Format EXACTLY like this:

SLIDE_COUNT: [number]

SLIDE_1_TEXT: [overlay text]
SLIDE_1_PROMPT: [image prompt]
SLIDE_1_PERSONA: [YES or NO]

SLIDE_2_TEXT: [overlay text]
SLIDE_2_PROMPT: [image prompt]
SLIDE_2_PERSONA: [YES or NO]

[...continue for all slides...]

CAPTION:
[instagram caption]

HASHTAGS:
[comma-separated hashtags]`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini error: ${JSON.stringify(data)}`);

  // Parse slides — scan up to 20 to be safe (don't trust SLIDE_COUNT header)
  const maxScan = 20;
  const slides = [];
  for (let i = 1; i <= maxScan; i++) {
    const textRe = new RegExp(`SLIDE_${i}_TEXT:\\s*(.+)`, 'i');
    const promptRe = new RegExp(`SLIDE_${i}_PROMPT:\\s*(.+)`, 'i');
    const personaRe = new RegExp(`SLIDE_${i}_PERSONA:\\s*(YES|NO)`, 'i');
    const textMatch = text.match(textRe);
    const promptMatch = text.match(promptRe);
    const personaMatch = text.match(personaRe);
    if (textMatch && promptMatch) {
      slides.push({
        index: i,
        overlayText: textMatch[1].trim(),
        imagePrompt: promptMatch[1].trim(),
        includePersona: personaMatch ? personaMatch[1].toUpperCase() === 'YES' : false,
      });
    }
  }

  if (slides.length === 0) throw new Error('Gemini returned no parseable slides');

  // Parse caption and hashtags
  const captionMatch = text.match(/CAPTION:\s*([\s\S]*?)(?=\nHASHTAGS:)/i);
  const hashtagsMatch = text.match(/HASHTAGS:\s*([\s\S]*?)$/i);
  const caption = captionMatch ? captionMatch[1].trim() : '';
  const hashtags = hashtagsMatch
    ? hashtagsMatch[1].trim().split(/[,\n]+/).map(h => h.trim().replace(/^#?/, '#')).filter(Boolean)
    : [];

  return { slides, caption, hashtags, rawResponse: text };
}

// ============================================================================
// FAL nano-banana-2 — Generate Slide Images
// ============================================================================

async function generateSlideImage(slide, outputPath) {
  const usePersona = slide.includePersona;
  const endpoint = usePersona
    ? 'https://fal.run/fal-ai/nano-banana-2/edit'
    : 'https://fal.run/fal-ai/nano-banana-2';

  console.log(`  [Slide ${slide.index}] Generating image (${usePersona ? 'with persona' : 'scene only'})...`);

  const body = {
    prompt: slide.imagePrompt,
    num_images: 1,
    resolution: '1K',
    aspect_ratio: '1:1',
    output_format: 'png',
    safety_tolerance: '5',
  };

  if (usePersona) {
    const refData = fs.readFileSync(REF_IMAGE);
    body.image_urls = [`data:image/png;base64,${refData.toString('base64')}`];
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FAL API error ${response.status} for slide ${slide.index}: ${err}`);
  }

  const result = await response.json();
  const images = result.images || [];
  if (images.length === 0) throw new Error(`FAL returned no images for slide ${slide.index}`);

  const imgResponse = await fetch(images[0].url);
  const buffer = Buffer.from(await imgResponse.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  console.log(`  [Slide ${slide.index}] Saved raw image: ${path.basename(outputPath)}`);
  return { width: images[0].width, height: images[0].height, url: images[0].url };
}

// ============================================================================
// ffmpeg — Text Overlay
// ============================================================================

function overlayText(inputPath, outputPath, text) {
  // Escape special characters for ffmpeg drawtext + shell
  const escaped = text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\u2019")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\$/g, '\\$');

  // Auto-scale: larger font for short text, smaller for longer text
  // Target: text should use ~80% of image width max
  // Rough heuristic: 1024px image, ~0.6 char-width-to-fontsize ratio
  const charCount = text.length;
  let fontsize;
  if (charCount <= 15) fontsize = 80;
  else if (charCount <= 25) fontsize = 68;
  else if (charCount <= 35) fontsize = 56;
  else fontsize = 46;

  const cmd = `ffmpeg -y -i "${inputPath}" -vf "drawtext=text='${escaped}':fontsize=${fontsize}:fontcolor=white:borderw=4:bordercolor=black@0.8:x=(w-tw)/2:y=h-th-80:font=Arial" "${outputPath}"`;

  execSync(cmd, { timeout: 30000, stdio: 'pipe' });
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  const opts = parseArgs();

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-key-here') {
    throw new Error('GEMINI_API_KEY not set in .env');
  }

  fs.mkdirSync(OUTPUT_BASE, { recursive: true });

  // Select topic
  const topicObj = selectTopic(opts.topic);
  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = topicObj.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const carouselDir = path.join(OUTPUT_BASE, `${dateStr}-${slug}`);

  console.log('\n=== CAROUSEL GEN ===');
  console.log(`Topic:   ${topicObj.topic}`);
  console.log(`Pillar:  ${topicObj.pillar}`);
  console.log(`Output:  ${carouselDir}`);

  // Step 1: Gemini carousel plan
  console.log('\n[Step 1] Generating carousel plan via Gemini...');
  const plan = await generateCarouselPlan(topicObj, opts.slides);

  console.log(`\n--- CAROUSEL PLAN (${plan.slides.length} slides) ---`);
  for (const slide of plan.slides) {
    const personaTag = slide.includePersona ? ' [+persona]' : '';
    console.log(`  Slide ${slide.index}: "${slide.overlayText}"${personaTag}`);
    console.log(`    Prompt: ${slide.imagePrompt.substring(0, 80)}...`);
  }
  console.log(`\n--- CAPTION ---`);
  console.log(plan.caption);
  console.log(`--- HASHTAGS ---`);
  console.log(plan.hashtags.join(' '));

  if (opts.dryRun) {
    console.log('\n[DRY RUN] Stopping here. No images generated.');
    savePillar(topicObj.pillar);

    const dryMeta = {
      topic: topicObj.topic,
      pillar: topicObj.pillar,
      slides: plan.slides,
      caption: plan.caption,
      hashtags: plan.hashtags,
      dry_run: true,
      created_at: new Date().toISOString(),
    };
    const dryPath = path.join(OUTPUT_BASE, `${dateStr}-${slug}-dryrun.json`);
    fs.writeFileSync(dryPath, JSON.stringify(dryMeta, null, 2));
    console.log(`Metadata saved: ${dryPath}`);
    return;
  }

  // Create output directory
  fs.mkdirSync(carouselDir, { recursive: true });

  // Step 2: Generate images via FAL
  console.log(`\n[Step 2] Generating ${plan.slides.length} slide images via FAL nano-banana-2...`);

  const slideOutputs = [];
  for (const slide of plan.slides) {
    const rawPath = path.join(carouselDir, `slide-${String(slide.index).padStart(2, '0')}-raw.png`);
    const finalPath = path.join(carouselDir, `slide-${String(slide.index).padStart(2, '0')}.png`);

    const imgResult = await generateSlideImage(slide, rawPath);

    // Step 3: Text overlay
    console.log(`  [Slide ${slide.index}] Overlaying text: "${slide.overlayText}"`);
    overlayText(rawPath, finalPath, slide.overlayText);

    // Clean up raw file
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);

    slideOutputs.push({
      index: slide.index,
      overlayText: slide.overlayText,
      imagePrompt: slide.imagePrompt,
      localPath: finalPath,
      width: imgResult.width,
      height: imgResult.height,
    });
  }

  savePillar(topicObj.pillar);

  // Write sidecar JSON
  const sidecar = {
    carousel_id: `carousel-${dateStr}-${slug}`,
    topic: topicObj.topic,
    pillar: topicObj.pillar,
    slide_count: slideOutputs.length,
    slides: slideOutputs,
    caption: plan.caption,
    hashtags: plan.hashtags,
    created_at: new Date().toISOString(),
  };

  const sidecarPath = path.join(carouselDir, 'carousel.json');
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));

  console.log('\n=== CAROUSEL GEN COMPLETE ===');
  console.log(`Slides:   ${slideOutputs.length} images`);
  console.log(`Output:   ${carouselDir}`);
  console.log(`Sidecar:  ${sidecarPath}`);
  console.log(`Topic:    ${topicObj.topic}`);
  console.log(`Pillar:   ${topicObj.pillar}`);
  console.log(`\nNext: node skills/carousel-publish/scripts/carousel-publish.js`);
}

main().catch(e => {
  console.error(`\nError: ${e.message}`);
  process.exit(1);
});
