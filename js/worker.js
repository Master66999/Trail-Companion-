// Inference worker — runs the open-weight CLIP vision encoder entirely on-device.
// Nothing about the photo ever leaves the phone.
import {
  env, AutoProcessor, CLIPVisionModelWithProjection,
  AutoTokenizer, CLIPTextModelWithProjection, RawImage,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';
import { buildLabelBank, score, l2normalize } from './scoring.js';
import { CATEGORIES } from './species.js';

const MODEL_ID = 'Xenova/clip-vit-base-patch16';
env.allowLocalModels = false;
env.useBrowserCache = true; // model weights are cached in Cache Storage → works offline after first load

let processor, visionModel, shipped, bank, custom = [];
let tokenizer, textModel; // lazy — only for "Teach a species"
let device = 'wasm';

const post = (type, payload = {}) => self.postMessage({ type, ...payload });

function progress(stage) {
  const files = {};
  return (p) => {
    if (p.status === 'progress' && p.total) {
      files[p.file] = { loaded: p.loaded, total: p.total };
      const loaded = Object.values(files).reduce((a, f) => a + f.loaded, 0);
      const total = Object.values(files).reduce((a, f) => a + f.total, 0);
      post('progress', { stage, loaded, total, file: p.file });
    }
  };
}

let initPromise;
function init() {
  // Int8-quantized weights on WASM: 87 MB one-time download, runs on any phone.
  // (WebGPU would need the 172 MB fp16 weights — not worth it on trail data plans.)
  initPromise ??= (async () => {
    shipped = await fetch(new URL('../data/text-embeddings.json', import.meta.url)).then(r => r.json());
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      device, dtype: 'q8', progress_callback: progress('vision'),
    });
    bank = buildLabelBank(shipped, custom);
    post('ready', { device, labels: bank.length });
  })().catch(err => { initPromise = null; throw err; });
  return initPromise;
}

async function classify({ blob, id }) {
  await init();
  const t0 = performance.now();
  const image = await RawImage.fromBlob(blob);
  const inputs = await processor(image);
  const { image_embeds } = await visionModel(inputs);
  const result = score(image_embeds.data, bank, 5);
  post('result', { id, ...result, ms: Math.round(performance.now() - t0), device });
}

async function teach({ name, cat, id }) {
  if (!tokenizer) {
    post('progress', { stage: 'text', loaded: 0, total: 1 });
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q8', progress_callback: progress('text'),
    });
  }
  const noun = CATEGORIES[cat]?.noun || 'thing';
  const prompts = [`a photo of a ${name}, a type of ${noun}.`, `a close-up photo of a ${name}.`];
  const { text_embeds } = await textModel(tokenizer(prompts, { padding: true, truncation: true }));
  const [rows, dim] = text_embeds.dims;
  const mean = new Float32Array(dim);
  for (let r = 0; r < rows; r++) {
    const row = l2normalize(text_embeds.data.slice(r * dim, (r + 1) * dim));
    for (let i = 0; i < dim; i++) mean[i] += row[i] / rows;
  }
  post('taught', { id, name, cat, embedding: Array.from(l2normalize(mean)) });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') await init();
    else if (data.type === 'classify') await classify(data);
    else if (data.type === 'teach') await teach(data);
    else if (data.type === 'setCustom') {
      custom = data.custom || [];
      if (shipped) bank = buildLabelBank(shipped, custom);
    }
  } catch (err) {
    console.error(err);
    post('error', { message: err?.message || String(err), for: data.type });
  }
};
