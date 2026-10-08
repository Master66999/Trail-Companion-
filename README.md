# 🌲 Trail Companion

> **Offline Nature Identification & Exploration PWA with Open-Source AI**  
> *Built for Hacktoberfest 2026 — Open-Source AI Challenge, Week 1: "Touch Grass"*

[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest-2026-orange?style=for-the-badge)](https://hacktoberfest.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-purple?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![AI](https://img.shields.io/badge/AI-On--Device-green?style=for-the-badge)](#-architecture)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#-license)

**Trail Companion** is an offline-first Progressive Web App (PWA) for identifying **leaves, birds, flowers, fungi, and insects** directly in your browser — even when you have **zero cellular or internet connectivity**.

The application runs an open-weight vision model directly on the user's device, keeping observations private while encouraging users to spend less time staring at their screens and more time exploring nature.

🌐 **Live Demo:** https://trail-companion.onrender.com

---

## 🌿 Why Trail Companion?

Modern nature apps often depend on cloud APIs, internet connectivity, and server-side AI inference.

Trail Companion takes a different approach:

```text
📱 Your Device
     │
     ├── 📷 Camera
     ├── 🧠 AI Model
     ├── 🗺️ GPS
     ├── 💾 Local Storage
     └── 🔊 Audio
          │
          ▼
     🌲 Trail Companion
          │
          ▼
    🚫 No Cloud Required
```

Your photos and observations can stay on your device.

---

# ✨ Features

### ⚡ 100% On-Device AI Inference

Powered by an int8-quantized **CLIP ViT-B/16** vision model using:

- Transformers.js
- ONNX Runtime Web
- WebAssembly
- Client-side inference

No AI API calls are required for classification.

**Benefits:**

- 🔒 Privacy-first
- 📡 Works offline
- 💰 No API costs
- ⚡ Low-latency inference
- 🧠 Runs directly in the browser

---

### 📵 Anti-Screen Detector

Trail Companion can recognize non-nature scenes such as:

- 💻 Laptop screens
- 🏠 Indoor rooms
- 🚗 Cars
- 🖥️ Desks
- 📱 Screens

Instead of rewarding endless phone usage, the app encourages you to **put your phone away and explore outside.**

---

### 🥾 Screen-Free Walk Mode

Track your walking session using the **Page Visibility API**.

The application compares:

```text
Total Walk Time
        ↓
Screen-On Time
        ↓
Screen-Free Time
        ↓
Outdoor Score
```

The goal is simple:

> **Use the app less while getting more out of your walk.**

---

### 🏅 Trail Badges & Quests

Unlock offline achievements as you explore.

Examples include:

- 🌿 **Foliage Scout**
- 🐦 **Songbird Seeker**
- 🍄 **Fungi Finder**
- 🐛 **Bug Hunter**
- 🌲 **Forest Explorer**
- 👣 **Trail Walker**
- 📵 **Screen-Free Explorer**
- 🌎 **True Grass Toucher**

Badges are unlocked dynamically based on your observations and activities.

---

### 🎯 Daily Trail Bingo

Every day, Trail Companion generates a **3×3 nature bingo board**.

Complete challenges such as:

```text
┌────────────┬────────────┬────────────┐
│ Find a Bird│ Find a Tree│ Walk 10 min│
├────────────┼────────────┼────────────┤
│ Find a Leaf│ Find a Bug │ Spot Flower│
├────────────┼────────────┼────────────┤
│ Hear Bird  │ Find Fungi │ Touch Grass│
└────────────┴────────────┴────────────┘
```

Complete rows, columns, or the entire board.

---

### 🎶 Sound of the Trail

Includes an offline **Web Audio synthesizer** capable of generating nature-inspired sounds.

Examples:

- 🐦 Bird whistles
- 🍂 Autumn leaf rustling
- 🌬️ Wind ambience

No streaming audio service is required.

---

### 📖 Offline Field Guide

Explore a searchable offline encyclopedia containing **76 species** across categories including:

- 🐦 Songbirds
- 🌳 Trees
- 🌸 Wildflowers
- 🍄 Mushrooms
- 🐛 Insects

Each entry provides identification information and seasonal observation tips.

---

### 🎨 Nature Passport

Generate a shareable high-resolution **Nature Passport** containing:

- 📸 Observation photos
- 🌿 Species discovered
- 🥾 Walk statistics
- 🏅 Achievements
- 📅 Exploration information

The passport can be exported directly from the browser.

---

### 🗺️ Privacy-First GeoJSON Journal

Record observations with optional GPS coordinates.

All location data can remain locally stored.

Export your observations as:

```text
GeoJSON
```

Compatible with tools such as:

- QGIS
- Google Earth
- GIS applications
- Mapping workflows

---

### 🔬 Zero-Shot "Teach a Species"

Found something unusual?

Teach Trail Companion about it.

Users can add a custom species by providing a label/example, after which the application calculates new embeddings without retraining the underlying model.

```text
New Species
     ↓
Text Embedding
     ↓
Normalized Vector
     ↓
Label Bank
     ↓
Ready for Classification
```

---

# 🚀 Quick Start

## 1. Prerequisites

Make sure you have:

- **Node.js 18+**
- npm
- A modern browser
- WebAssembly SIMD support

Tested with:

- Node.js 20
- Node.js 24
- Chrome
- Edge
- Firefox
- Safari

---

## 2. Clone the Repository

```bash
git clone https://github.com/Master66999/Trail-Companion-.git

cd Trail-Companion-
```

---

## 3. Install Dependencies

```bash
npm install
```

---

## 4. Build Label Embeddings

The repository already contains precomputed embeddings for the **76 core species**:

```text
data/text-embeddings.json
```

If you modify:

```text
js/species.js
```

and add new default species, regenerate the embeddings:

```bash
npm run embeddings
```

---

## 5. Start the Development Server

```bash
npm run dev
```

Then open:

```text
http://localhost:5173/
```

---

# 🧪 Testing

Trail Companion includes a headless classification test harness.

Run:

```bash
npm run test:classify
```

The test harness runs the int8 ONNX vision model against sample images in:

```text
samples/
```

It reports:

- Predicted species
- Confidence score
- Inference latency

Typical inference latency:

```text
~130–180 ms
```

depending on the device and browser/runtime environment.

---

# 🏗️ Architecture

```text
                 ┌──────────────────────────┐
                 │    Browser / Phone       │
                 │         Camera           │
                 └────────────┬─────────────┘
                              │
                              ▼
                    Canvas Resize: 768px
                              │
                              ▼
┌──────────────────────────────────────────────────────┐
│                    WEB WORKER                        │
│                                                      │
│       Transformers.js + ONNX Runtime Web             │
│                                                      │
│       Model: Xenova/clip-vit-base-patch16            │
│       Quantization: INT8 / Q8                        │
│       Model Size: ~87 MB                             │
│                                                      │
│       Output: 512-dimensional image embedding        │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│                  SCORING ENGINE                      │
│                                                      │
│                   js/scoring.js                      │
│                                                      │
│       Cosine Similarity                              │
│       ─────────────────                              │
│       dot(image_vector, label_bank) × 100            │
│                                                      │
│       Softmax Probability Distribution               │
│                                                      │
│       • 76 Built-in Species Vectors                 │
│       • Anti-Screen Vectors                          │
│       • User-Taught Species Vectors                  │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│                     UI LAYER                         │
│                                                      │
│       • Species Match Card                           │
│       • Seasonal Identification Cue                  │
│       • Web Audio Nature Synthesizer                 │
│       • Trail Badges                                 │
│       • Daily Bingo                                  │
│       • Walk Tracking                                │
│       • Nature Passport                             │
│       • IndexedDB                                    │
│       • GPS / GeoJSON Journal                        │
└──────────────────────────────────────────────────────┘
```

---

# 🧠 AI Pipeline

```text
Camera Image
     │
     ▼
Image Preprocessing
     │
     ▼
768px Canvas Resize
     │
     ▼
CLIP ViT-B/16
     │
     ▼
512-D Image Embedding
     │
     ▼
Cosine Similarity
     │
     ├───────────────┐
     ▼               ▼
Species Bank     Anti-Screen Bank
     │               │
     └───────┬───────┘
             ▼
      Probability Score
             │
             ▼
       Species Result
```

---

# 🔐 Privacy Architecture

Trail Companion is designed around a **local-first architecture**.

```text
Camera
  │
  ▼
Browser
  │
  ├── AI inference ───────► Local device
  │
  ├── Photos ─────────────► Local storage
  │
  ├── Observations ───────► IndexedDB
  │
  └── GPS ────────────────► Local journal
```

The classification pipeline does not require sending images to a remote AI server.

---

# 📁 Project Structure

```text
Trail-Companion/
│
├── data/
│   └── text-embeddings.json
│
├── js/
│   ├── species.js
│   ├── scoring.js
│   └── ...
│
├── samples/
│   └── ...
│
├── icons/
│   └── icon.svg
│
├── index.html
├── package.json
├── README.md
└── ...
```

---

# 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | UI and responsive design |
| JavaScript | Application logic |
| PWA | Offline-first application |
| Transformers.js | Browser ML inference |
| ONNX Runtime Web | ONNX model execution |
| CLIP ViT-B/16 | Vision-language model |
| WebAssembly | High-performance browser inference |
| IndexedDB | Local persistence |
| Web Audio API | Nature sound synthesis |
| Page Visibility API | Screen-free tracking |
| GeoJSON | Location data export |
| Canvas API | Passport/image generation |

---

# ⚡ Performance

The application is optimized for client-side inference.

### Model

```text
CLIP ViT-B/16
Quantization: INT8
Model Size: ~87 MB
Embedding Size: 512 dimensions
```

### Typical Inference

```text
~130–180 ms
```

Actual performance depends on:

- Device CPU
- Browser
- WebAssembly implementation
- Available SIMD support
- Memory availability

---

# 🌐 Offline Capabilities

Trail Companion is designed to remain useful without an internet connection.

| Feature | Offline |
|---|:---:|
| Species identification | ✅ |
| Field guide | ✅ |
| Walk tracking | ✅ |
| Badges | ✅ |
| Bingo | ✅ |
| Audio synthesis | ✅ |
| Nature Passport | ✅ |
| Local journal | ✅ |
| GeoJSON export | ✅ |
| Custom species | ✅ |

The initial application/model assets must of course be downloaded before fully offline use.

---

# 📸 Screenshots

Add your screenshots here:

```markdown
![Home Screen](screenshots/home.png)

![Species Identification](screenshots/identify.png)

![Trail Bingo](screenshots/bingo.png)

![Nature Passport](screenshots/passport.png)
```

---

# 🌎 Use Cases

Trail Companion can be used by:

- 🥾 Hikers
- 🌲 Nature explorers
- 🐦 Bird watchers
- 🎓 Students
- 👨‍👩‍👧 Families
- 📚 Outdoor educators
- 🌿 Citizen scientists
- 🧑‍💻 Developers interested in browser AI

---

# 🚀 Future Improvements

Potential future contributions include:

- [ ] More species
- [ ] Better regional species packs
- [ ] Improved mobile optimization
- [ ] Additional nature sound generators
- [ ] Community-contributed species
- [ ] More accessibility features
- [ ] Improved offline model caching
- [ ] Trail sharing
- [ ] Wildlife observation analytics
- [ ] Additional export formats
- [ ] Multi-language field guides

---

# 🤝 Contributing

Contributions are welcome!

```bash
# Fork the repository
# Create a feature branch

git checkout -b feature/amazing-feature

# Make your changes
git add .

git commit -m "Add amazing feature"

git push origin feature/amazing-feature
```

Then open a Pull Request.

### Good contribution areas

🌿 Add species  
🧠 Improve classification  
🎨 Improve UI/UX  
📱 Improve mobile support  
⚡ Optimize inference  
🗺️ Improve mapping  
♿ Improve accessibility  
📖 Improve field-guide content  
🐛 Fix bugs

---

# 🤖 AI-Assisted Development

This project was built interactively with an AI coding agent.

The complete development session and walkthrough are available on DEV:

**DEV Agent Session:**  
`trail-companion-touch-grass-open-source-ai-agent-session-ajnhzn`

**View on DEV:**  
https://dev.to/agent_sessions/trail-companion-touch-grass-open-source-ai-agent-session-ajnhzn

---

# 📜 License

This project is licensed under the **MIT License**.

Designed and built with ❤️ for:

- Open-source developers
- Nature enthusiasts
- Hacktoberfest
- Privacy-first AI
- Offline computing
- The open web

---

# 🌲 Touch Grass. Not Your API.

> **Go outside. Identify something. Put the phone away.**

**Trail Companion — AI that helps you spend less time using AI.**
