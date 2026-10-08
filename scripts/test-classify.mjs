// Sanity-check accuracy offline in Node using the exact scoring code the browser uses.
//   npm run test:classify [-- path/to/photo.jpg ...]
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildLabelBank, score } from '../js/scoring.js';

const MODEL_ID = 'Xenova/clip-vit-base-patch16';
const shipped = JSON.parse(await readFile(new URL('../data/text-embeddings.json', import.meta.url), 'utf8'));
const bank = buildLabelBank(shipped);
const processor = await AutoProcessor.from_pretrained(MODEL_ID);
const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' });

let files = process.argv.slice(2);
if (!files.length) {
  const dir = new URL('../samples/', import.meta.url);
  files = (await readdir(dir)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).map(f => fileURLToPath(new URL(f, dir)));
}

for (const f of files) {
  const t0 = performance.now();
  const image = await RawImage.read(f);
  const { image_embeds } = await vision(await processor(image));
  const { top, categories } = score(image_embeds.data, bank, 3);
  const cat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  console.log(`\n${f.split(/[\\/]/).pop()}  (${Math.round(performance.now() - t0)} ms)  category: ${cat[0]} ${(cat[1] * 100).toFixed(0)}%`);
  for (const t of top) console.log(`  ${(t.prob * 100).toFixed(1).padStart(5)}%  ${t.name}`);
}
