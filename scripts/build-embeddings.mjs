// Precompute CLIP text embeddings for every label in js/species.js.
// Runs the open-weight text encoder ONCE at build time, so phones only need
// to download the vision encoder (~87 MB) instead of both (~150 MB).
//
//   npm run embeddings
import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers';
import { writeFile, mkdir } from 'node:fs/promises';
import { ALL_LABELS, promptsFor } from '../js/species.js';

const MODEL_ID = 'Xenova/clip-vit-base-patch16';

const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' });

function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n);
  return v.map(x => x / n);
}

const out = { model: MODEL_ID, dim: 0, created: new Date().toISOString(), labels: {} };

for (const label of ALL_LABELS) {
  const prompts = promptsFor(label);
  const inputs = tokenizer(prompts, { padding: true, truncation: true });
  const { text_embeds } = await textModel(inputs);
  const [rows, dim] = text_embeds.dims;
  const data = text_embeds.data;
  // Prompt ensembling: average the normalised embedding of each prompt, then re-normalise.
  const mean = new Float32Array(dim);
  for (let r = 0; r < rows; r++) {
    const row = normalize(Array.from(data.slice(r * dim, (r + 1) * dim)));
    for (let i = 0; i < dim; i++) mean[i] += row[i] / rows;
  }
  const vec = Float32Array.from(normalize(Array.from(mean)));
  out.dim = dim;
  out.labels[label.id] = Buffer.from(vec.buffer).toString('base64');
  process.stdout.write(`✓ ${label.id} (${rows} prompts)\n`);
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/text-embeddings.json', import.meta.url), JSON.stringify(out));
console.log(`\nWrote ${Object.keys(out.labels).length} label embeddings (dim ${out.dim}) → data/text-embeddings.json`);
