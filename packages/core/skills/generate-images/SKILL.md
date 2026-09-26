---
name: generate-images
description: Use this skill when the user asks you to draw, generate, render, or fill in the images of a MoSage document — phrases like "generate the images", "draw the pictures for docs/<id>", "產生圖片", "fill in the image prompts", "/generate-images". It turns every `<ImagePrompt>` left in the documents into a real image saved in the document's `assets/images/` folder, then swaps the placeholder for the image. Built for Codex, which can generate images itself; any agent can run it when the project is set to the OpenAI API. Do NOT use for writing a document — that is `create-doc`.
---

# Generate the images a document is waiting for

While writing, the agent leaves an `<ImagePrompt>` wherever a generated image belongs:

```tsx
<ImagePrompt
  id="market-map"
  prompt="An isometric map of three market segments as city blocks, soft blue palette, no text"
  alt="Market segments"
  width={642}
  height={360}
/>
```

This skill draws each one and puts the real image in its place.

## Step 1 — List what is waiting

```bash
npx mosage images --json
```

It prints `mode` (`off`, `codex`, or `openai`, from Settings → AI images), `documents` (which documents use generated images), and `prompts`. Each prompt has `docId`, `id`, `prompt`, `width`, `height`, `file` (where the image must be saved, relative to the project root), `ready` (already on disk), `enabled`, and `problem`.

- Work only on prompts with `enabled: true`, `problem: null`, and `ready: false`.
- A prompt with a `problem` cannot be drawn as written — tell the user what the problem says and fix the source only if they ask.
- If the user named a document, add `--doc <id>`.
- `mode: "off"` — stop and tell the user image generation is off in Settings.

## Step 2 — Draw them

**`mode: "openai"`** — MoSage calls the API itself, with the key saved on this machine, and records the cost:

```bash
npx mosage images generate            # every waiting prompt
npx mosage images generate --doc <id> # one document
```

That also saves and places the images — skip to Step 4.

**`mode: "codex"`** — draw each prompt with your own image generation:

1. Use the `prompt` text as written. Do not add text or captions inside the image unless the prompt asks for them — the document sets its captions in type.
2. Match the aspect ratio to `width` × `height`: wider than 1.2 : 1 → landscape (1536×1024), taller than 1 : 1.2 → portrait (1024×1536), otherwise square (1024×1024).
3. Save the result as PNG at exactly the `file` path. Create the `images/` folder if it is missing.

## Step 3 — Place them

Once the files are on disk:

```bash
npx mosage images place <docId>        # every drawn prompt in the document
npx mosage images place <docId> <id>   # just one
```

This replaces each `<ImagePrompt>` with an imported `<img>` of the same size, and removes the `ImagePrompt` import when none is left. Do not edit those lines by hand — the command keeps the import path and the file in step.

## Step 4 — Report

Run `npx mosage images --json` once more and confirm nothing you drew is still listed. Tell the user:

- which images were drawn, per document;
- any prompt you skipped, and why;
- in OpenAI mode, the cost the command printed (Settings → AI images keeps the running total).
