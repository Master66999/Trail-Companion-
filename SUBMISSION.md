---
title: Trail Companion — An Offline PWA for Nature Exploration Powered by Open-Weight AI
published: false
tags: devchallenge, hf26challenge, opensource, webdev
cover_image: https://raw.githubusercontent.com/Master66999/Trail-Companion-/main/cover.jpg
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

---

## What I Built

**Trail Companion** is an offline-first Progressive Web App (PWA) built to do something unusual for an AI app: **get people off the screen and into the real world**.

Most nature identification tools force you to be tethered to a cellular network. You hike into a national park, spot a rare bird or autumn leaf, pull out your phone—and stare at a loading spinner because there's no signal. Even worse, your location coordinates and photos get uploaded to centralized servers.

Trail Companion turns your phone into an **autonomous on-device field scanner**:
- 🌲 **Zero-Signal Nature Identification**: Point your camera at any tree leaf, songbird, wildflower, mushroom, or insect. The open-weight vision model identifies the species in **~140ms** right inside your browser—no internet connection, no servers, and zero API keys.
- 🥾 **Screen-Free Walk Mode**: Using the Page Visibility API, the app tracks how much of your hike you spent **off-screen**. It calculates a real-time *"Touch Grass"* percentage, rewarding you for keeping your phone in your pocket.
- 📵 **Anti-Screen Negative Detector**: Point the camera at a laptop, monitor, or office desk, and the model flags it immediately: *"That's not grass 📵. Put the phone down, open a door, and find the nearest tree."*
- 🎶 **Sound of the Trail**: An offline Web Audio synthesizer that generates authentic bird whistling calls and autumn wind rustles, helping hikers learn species by ear without downloading heavy audio files.
- 🏅 **Trail Badges & Daily Bingo**: 8 offline achievements (e.g. *Foliage Scout*, *Songbird Seeker*, *True Grass Toucher*) and a 3×3 bingo card that update dynamically as you explore.
- 🎨 **Nature Passport Canvas Export**: Generates a shareable high-resolution field passport graphic with your photos and walk statistics directly to an HTML5 Canvas.
- 🔬 **Zero-Shot "Teach a Species"**: Encounter a rare local plant? Type its common name in the Studio, and the open-weight text encoder computes new embeddings on-device in seconds. No model retraining required.

---

## Demo

- **Live Deployed App**: [https://trail-companion.onrender.com](https://trail-companion.onrender.com)
- **PWA Capabilities**: Installable directly to your home screen on iOS and Android. Open it once on Wi-Fi to cache the weights (~87 MB), and it works in **Airplane Mode** anywhere on Earth.
- **Instant Sample Deck**: Includes 6 built-in field test photographs (*Maple Leaf*, *Northern Cardinal*, *Fly Agaric*, *Monarch Butterfly*, *Sunflower*, and an *Indoor Desk*) so you can test the classification and anti-screen rejection right from your desk before heading outside.

---

## Code

{% github Master66999/Trail-Companion- %}

- **GitHub Repository**: [https://github.com/Master66999/Trail-Companion-](https://github.com/Master66999/Trail-Companion-)

The entire codebase is open-source under the MIT License.

### Key Architecture:
- **`index.html`**: Semantic PWA with clean white & emerald green design system across 6 dedicated views (`Home`, `Field Scanner`, `Native Guide`, `Walk Mode`, `Field Journal`, and `Studio`).
- **`css/style.css`**: Professional high-contrast white & forest green aesthetic with bento grids, glassmorphism cards, and fluid layouts.
- **`js/worker.js`**: Dedicated Web Worker running Transformers.js on WebAssembly SIMD without locking the UI thread.
- **`js/scoring.js`**: Shared zero-shot cosine similarity and softmax calculation.
- **`js/species.js`**: Curated taxonomy of 76 native flora and fauna species.
- **`scripts/build-embeddings.mjs`**: Build-time prompt ensembling that precomputes text embeddings into a compact 208 KB JSON file.
- **`sw.js`**: Service worker providing cache-first offline capability.

---

## How I Built It

Trail Companion is architected entirely around **open-weight foundation models and open-source local inference**:

### 1. The Open-Weight Core: CLIP ViT-B/16
We utilized OpenAI's open-weight **CLIP (Contrastive Language-Image Pretraining) ViT-B/16**, converted to ONNX by the open-source community ([Xenova/clip-vit-base-patch16](https://huggingface.co/Xenova/clip-vit-base-patch16)).

CLIP projects both images and natural language text into a shared 512-dimensional vector space. Classification is performed via vector cosine similarity:
$$\text{similarity} = \frac{\mathbf{v}_{\text{image}} \cdot \mathbf{v}_{\text{text}}}{\|\mathbf{v}_{\text{image}}\| \|\mathbf{v}_{\text{text}}\|}$$

### 2. Local Inference via Transformers.js & ONNX Runtime Web
We execute inference inside the browser using **Transformers.js v4** on top of ONNX Runtime Web:
- **int8 Quantization**: Using the quantized vision encoder (`q8`) cut the download size down from 345 MB to just **87 MB**.
- **WASM Acceleration**: Runs on WebAssembly SIMD in a background worker, delivering blazing inference times (**130–160ms per image**) on consumer laptops and mobile devices.
- **Cache Storage**: The model weights persist in the browser's Cache Storage. Once cached, the app operates with complete autonomy in airplane mode.

### 3. Build-Time Prompt Ensembling
To avoid forcing mobile users to download both the text encoder (64 MB) and the vision encoder (87 MB), we decoupled the two:
- At build time, `scripts/build-embeddings.mjs` runs the open-weight text encoder across our 76 species using prompt templates (e.g. *"a photo of a Northern Cardinal, a type of bird"*).
- The resulting vectors are shipped in a tiny **208 KB** file (`data/text-embeddings.json`).
- Mobile devices only download the vision encoder, saving bandwidth and battery.

---

## Why Does Open Innovation Matter?

This week's challenge asks: *Where does an open-based approach work better than a closed one?* For Trail Companion, **closed APIs simply could not have powered this app**:

1. **True Backcountry Reliability**:
   Proprietary APIs (OpenAI, Gemini, Anthropic) require a live internet connection. In state parks, forests, and remote valleys, cell towers don't exist. An open-weight model running locally is the **only architecture that actually works when you're touching grass**.
2. **Absolute Privacy of Location & Imagery**:
   Nature enthusiasts and families frequently log GPS-tagged trail photos. By running inference on-device, **0 kb of personal image or location data leaves the device**. There are no accounts, no server databases, and no behavioral tracking.
3. **Zero Marginal Infrastructure Cost**:
   Calling a cloud multimodal vision API for every camera snap incurs ongoing API bills and rate limits. With open-weight models on client hardware, hosting costs are **$0.00**—the app can live on static hosting forever without maintenance fees.
4. **Instant Zero-Shot Extensibility**:
   Closed vision classification services restrict you to predetermined taxonomy IDs. Because open-weight CLIP is a dual-encoder, anyone can teach the app an endemic plant from their region in seconds without retraining or fine-tuning.

---

## My Agent Session

This project was built collaboratively with an AI coding agent through pair-programming: from architecting the build-time embedding pipeline and writing headless accuracy checks in Node.js, to engineering the white & emerald green design system, synthesis of Web Audio bird whistles, and browser subagent end-to-end verification.

{% agent_session trail-companion-touch-grass-open-source-ai-agent-session-ajnhzn %}

---

## Prize Categories

- **Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass**
- **Best On-Device / Offline AI Application**
