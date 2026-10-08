// Shared zero-shot scoring logic (browser worker + Node test script).
import { SPECIES, NEGATIVES } from './species.js';

export const LOGIT_SCALE = 100; // CLIP's learned temperature (exp(4.6052) ≈ 100)

export function decodeEmbedding(b64) {
  const bin = typeof atob === 'function'
    ? Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    : new Uint8Array(Buffer.from(b64, 'base64'));
  return new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
}

export function l2normalize(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

/**
 * Build the label bank from shipped embeddings + any user-taught species.
 * @param {{labels: Record<string,string>}} shipped
 * @param {Array<{id,name,cat,embedding:number[]|Float32Array}>} custom
 */
export function buildLabelBank(shipped, custom = []) {
  const meta = new Map([...SPECIES, ...NEGATIVES].map(s => [s.id, s]));
  const bank = [];
  for (const [id, b64] of Object.entries(shipped.labels)) {
    if (meta.has(id)) bank.push({ ...meta.get(id), vec: decodeEmbedding(b64) });
  }
  for (const c of custom) bank.push({ ...c, custom: true, vec: Float32Array.from(c.embedding) });
  return bank;
}

/** Cosine similarity → softmax over all labels, plus per-category totals. */
export function score(imageVec, bank, topK = 5) {
  const img = l2normalize(imageVec);
  const logits = bank.map(l => {
    let d = 0;
    for (let i = 0; i < img.length; i++) d += img[i] * l.vec[i];
    return d * LOGIT_SCALE;
  });
  const max = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(e => e / sum);

  const categories = {};
  bank.forEach((l, i) => { categories[l.cat] = (categories[l.cat] || 0) + probs[i]; });

  const ranked = bank
    .map((l, i) => ({ id: l.id, name: l.name, cat: l.cat, custom: !!l.custom, prob: probs[i], sim: logits[i] / LOGIT_SCALE }))
    .sort((a, b) => b.prob - a.prob);

  return { top: ranked.slice(0, topK), categories };
}
