export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });

export const loadImageFromFile = async (file) => {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);
  return { dataUrl, image };
};

export const canvasToBlob = (canvas, type = 'image/png', quality = 0.92) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Failed to create output file.'));
    }, type, quality);
  });

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const renameWithExtension = (name, extension) => {
  const cleanName = name.replace(/\.[^/.]+$/, '');
  return `${cleanName}.${extension}`;
};

export const drawImageContain = (ctx, image, x, y, width, height, background = null) => {
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
  }

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

export const drawImageCover = (ctx, image, x, y, width, height) => {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const applySharpen = (ctx, width, height, amount) => {
  if (amount <= 0) {
    return;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const strength = amount * 0.25;
  const centerWeight = 1 + 4 * strength;
  const sideWeight = -strength;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const current = source[index + channel];
        const left = source[index - 4 + channel];
        const right = source[index + 4 + channel];
        const top = source[index - width * 4 + channel];
        const bottom = source[index + width * 4 + channel];
        const nextValue =
          current * centerWeight +
          (left + right + top + bottom) * sideWeight;

        output[index + channel] = clamp(nextValue, 0, 255);
      }

      output[index + 3] = source[index + 3];
    }
  }

  imageData.data.set(output);
  ctx.putImageData(imageData, 0, 0);
};

export const renderFilteredCanvas = ({
  image,
  width = image.width,
  height = image.height,
  background = null,
  brightness = 100,
  contrast = 100,
  saturation = 100,
  sharpness = 0,
  fit = 'contain'
}) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  if (fit === 'cover') {
    drawImageCover(ctx, image, 0, 0, canvas.width, canvas.height);
  } else {
    drawImageContain(ctx, image, 0, 0, canvas.width, canvas.height, background);
  }

  ctx.filter = 'none';

  if (sharpness > 0) {
    applySharpen(ctx, canvas.width, canvas.height, sharpness / 100);
  }

  return canvas;
};
