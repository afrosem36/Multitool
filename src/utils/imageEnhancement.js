// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function float32From(imageData) {
  const f = new Float32Array(imageData.data.length);
  for (let i = 0; i < f.length; i++) f[i] = imageData.data[i];
  return f;
}

// ─── Separable Gaussian blur ──────────────────────────────────────────────────

function gaussianKernel1D(sigma) {
  const radius = Math.ceil(sigma * 3);
  const size = 2 * radius + 1;
  const k = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += k[i];
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return { kernel: k, radius };
}

function blurH(src, w, h, kernel, radius) {
  const out = new Float32Array(src.length);
  const kLen = kernel.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ki = 0; ki < kLen; ki++) {
        const sx = Math.min(w - 1, Math.max(0, x + ki - radius));
        const p = (y * w + sx) * 4;
        const wt = kernel[ki];
        r += src[p] * wt; g += src[p + 1] * wt; b += src[p + 2] * wt;
      }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = src[o + 3];
    }
  }
  return out;
}

function blurV(src, w, h, kernel, radius) {
  const out = new Float32Array(src.length);
  const kLen = kernel.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ki = 0; ki < kLen; ki++) {
        const sy = Math.min(h - 1, Math.max(0, y + ki - radius));
        const p = (sy * w + x) * 4;
        const wt = kernel[ki];
        r += src[p] * wt; g += src[p + 1] * wt; b += src[p + 2] * wt;
      }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = src[o + 3];
    }
  }
  return out;
}

function gaussianBlur(data, w, h, sigma) {
  if (sigma <= 0) return data;
  const { kernel, radius } = gaussianKernel1D(sigma);
  return blurV(blurH(data, w, h, kernel, radius), w, h, kernel, radius);
}

// ─── Unsharp masking ─────────────────────────────────────────────────────────
// sharpened = original + amount * (original - blurred)

function unsharpMask(data, w, h, sigma, amount) {
  const blurred = gaussianBlur(data, w, h, sigma);
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i]     = clamp(data[i]     + amount * (data[i]     - blurred[i]));
    out[i + 1] = clamp(data[i + 1] + amount * (data[i + 1] - blurred[i + 1]));
    out[i + 2] = clamp(data[i + 2] + amount * (data[i + 2] - blurred[i + 2]));
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ─── Clarity (large-radius local contrast — like Lightroom Clarity) ───────────

function clarityBoost(data, w, h, amount) {
  if (amount <= 0) return data;
  const blurred = gaussianBlur(data, w, h, 5);
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i]     = clamp(data[i]     + amount * (data[i]     - blurred[i]));
    out[i + 1] = clamp(data[i + 1] + amount * (data[i + 1] - blurred[i + 1]));
    out[i + 2] = clamp(data[i + 2] + amount * (data[i + 2] - blurred[i + 2]));
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ─── Edge-preserving noise reduction ─────────────────────────────────────────

function noiseReduce(data, w, h, strength) {
  if (strength <= 0) return data;
  const sigma = strength * 1.2;
  const blurred = gaussianBlur(data, w, h, sigma);
  const out = new Float32Array(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const xp = Math.min(w - 1, x + 1), xm = Math.max(0, x - 1);
      const yp = Math.min(h - 1, y + 1), ym = Math.max(0, y - 1);
      // simple gradient magnitude as edge proxy
      const dr  = Math.abs(data[(y * w + xp) * 4]     - data[(y * w + xm) * 4]);
      const dg  = Math.abs(data[(y * w + xp) * 4 + 1] - data[(y * w + xm) * 4 + 1]);
      const db  = Math.abs(data[(y * w + xp) * 4 + 2] - data[(y * w + xm) * 4 + 2]);
      const dr2 = Math.abs(data[(yp * w + x) * 4]     - data[(ym * w + x) * 4]);
      const dg2 = Math.abs(data[(yp * w + x) * 4 + 1] - data[(ym * w + x) * 4 + 1]);
      const db2 = Math.abs(data[(yp * w + x) * 4 + 2] - data[(ym * w + x) * 4 + 2]);
      const edge = (dr + dg + db + dr2 + dg2 + db2) / 6;
      // edges get little smoothing; flat areas get full smoothing
      const blend = Math.max(0, 1 - edge / 40) * strength;
      out[i]     = data[i]     * (1 - blend) + blurred[i]     * blend;
      out[i + 1] = data[i + 1] * (1 - blend) + blurred[i + 1] * blend;
      out[i + 2] = data[i + 2] * (1 - blend) + blurred[i + 2] * blend;
      out[i + 3] = data[i + 3];
    }
  }
  return out;
}

// ─── HSL colour adjustments ───────────────────────────────────────────────────

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 0.5)   return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r)      h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function adjustColors(data, brightness, contrast, saturation) {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;
    // contrast pivot at 128
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    r = clamp(r); g = clamp(g); b = clamp(b);
    if (saturation !== 1) {
      const [h, s, l] = rgbToHsl(r, g, b);
      [r, g, b] = hslToRgb(h, Math.min(1, s * saturation), l);
    }
    out[i] = clamp(r); out[i + 1] = clamp(g); out[i + 2] = clamp(b);
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ─── Image analysis ───────────────────────────────────────────────────────────

export function analyzeImage(data, w, h) {
  const n = w * h;
  const lums = new Float32Array(n);
  let totalLum = 0;

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lums[j] = lum;
    totalLum += lum;
  }
  const meanLum = totalLum / n;

  let variance = 0;
  for (let i = 0; i < n; i++) variance += (lums[i] - meanLum) ** 2;
  const stdDev = Math.sqrt(variance / n);

  // Laplacian variance → blur score (higher = sharper)
  const step = Math.max(1, Math.floor(Math.sqrt(n / 8000)));
  let lapSum = 0, lapCount = 0;
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const c = lums[y * w + x];
      const t = lums[(y - 1) * w + x];
      const b = lums[(y + 1) * w + x];
      const l = lums[y * w + (x - 1)];
      const r = lums[y * w + (x + 1)];
      lapSum += Math.abs(4 * c - t - b - l - r);
      lapCount++;
    }
  }
  const blurScore = lapCount > 0 ? lapSum / lapCount : 10;

  return { meanLum, stdDev, blurScore };
}

function computeAutoParams(analysis) {
  const { meanLum, stdDev, blurScore } = analysis;

  // brightness: push toward 128, clamped gently
  const brightness = Math.min(1.45, Math.max(0.75, 1 + (128 - meanLum) / 256 * 0.6));

  // contrast: boost flat images
  const flatness = Math.max(0, 1 - stdDev / 55);
  const contrast = 1 + flatness * 0.4;

  // saturation
  const saturation = 1.1 + flatness * 0.1;

  // blurNorm: 0 = very blurry, 1 = already sharp
  const blurNorm = Math.min(1, blurScore / 20);

  // sharpen more aggressively for blurry images
  const sharpAmount = 1.2 + (1 - blurNorm) * 1.8;
  const sharpSigma  = 0.7 + (1 - blurNorm) * 0.5;

  // clarity and noise
  const clarity   = 0.25 + (1 - blurNorm) * 0.25;
  const noiseSt   = 0.15 + (1 - blurNorm) * 0.35;

  return { brightness, contrast, saturation, sharpAmount, sharpSigma, clarity, noiseSt };
}

// ─── Main processing pipeline ─────────────────────────────────────────────────

function writeBack(float32, ctx, w, h) {
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < float32.length; i++) id.data[i] = Math.round(float32[i]);
  ctx.putImageData(id, 0, 0);
}

export function processEnhancement(sourceCanvas, options = {}) {
  return new Promise((resolve, reject) => {
    // Defer to give React a chance to paint the loading state
    setTimeout(() => {
      try {
        const { width: origW, height: origH } = sourceCanvas;

        // Cap internal processing at 1920px on longest side for performance
        const maxDim = 1920;
        const scale = Math.min(1, maxDim / Math.max(origW, origH));
        const procW = Math.round(origW * scale);
        const procH = Math.round(origH * scale);

        const procCanvas = document.createElement('canvas');
        procCanvas.width = procW;
        procCanvas.height = procH;
        const ctx = procCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, procW, procH);

        const imageData = ctx.getImageData(0, 0, procW, procH);
        let data = float32From(imageData);

        let params;
        if (options.mode === 'auto' || options.mode === undefined) {
          const analysis = analyzeImage(data, procW, procH);
          params = computeAutoParams(analysis);
        } else {
          params = {
            brightness:  options.brightness  ?? 1,
            contrast:    options.contrast    ?? 1,
            saturation:  options.saturation  ?? 1.1,
            sharpAmount: options.sharpAmount ?? 1.5,
            sharpSigma:  options.sharpSigma  ?? 0.9,
            clarity:     options.clarity     ?? 0.3,
            noiseSt:     options.noiseStrength ?? 0.3,
          };
        }

        // 1. Noise reduction (edge-preserving)
        data = noiseReduce(data, procW, procH, params.noiseSt);

        // 2. Unsharp masking — sharpen / deblur
        data = unsharpMask(data, procW, procH, params.sharpSigma, params.sharpAmount);

        // 3. Clarity — mid-tone local contrast
        data = clarityBoost(data, procW, procH, params.clarity);

        // 4. Tone & colour
        data = adjustColors(data, params.brightness, params.contrast, params.saturation);

        // 5. Optional 2× super-resolution pass
        if (options.superRes) {
          writeBack(data, ctx, procW, procH);
          const srW = procW * 2, srH = procH * 2;
          const srCanvas = document.createElement('canvas');
          srCanvas.width = srW; srCanvas.height = srH;
          const srCtx = srCanvas.getContext('2d');
          srCtx.imageSmoothingEnabled = true;
          srCtx.imageSmoothingQuality = 'high';
          srCtx.drawImage(procCanvas, 0, 0, srW, srH);
          const srId = srCtx.getImageData(0, 0, srW, srH);
          let srData = float32From(srId);
          // sharpen at 2× to recover interpolation blur
          srData = unsharpMask(srData, srW, srH, 0.7, 0.9);
          writeBack(srData, srCtx, srW, srH);
          return resolve(srCanvas);
        }

        writeBack(data, ctx, procW, procH);

        // Scale back to original dimensions if we downsampled
        if (scale < 1) {
          const outCanvas = document.createElement('canvas');
          outCanvas.width = origW; outCanvas.height = origH;
          const outCtx = outCanvas.getContext('2d');
          outCtx.imageSmoothingEnabled = true;
          outCtx.imageSmoothingQuality = 'high';
          outCtx.drawImage(procCanvas, 0, 0, origW, origH);
          return resolve(outCanvas);
        }

        resolve(procCanvas);
      } catch (err) {
        reject(err);
      }
    }, 60);
  });
}
