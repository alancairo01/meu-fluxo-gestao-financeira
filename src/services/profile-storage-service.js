export function compressProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('A imagem selecionada não é válida.'));
      image.onload = () => {
        const size = 320;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Não foi possível preparar a foto.'));
            return;
          }
          resolve(blob);
        }, 'image/jpeg', 0.86);
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl) {
  const [metadata, payload] = String(dataUrl || '').split(',');
  if (!metadata || !payload || !/^data:image\/(jpeg|png|webp);base64$/i.test(metadata)) return null;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const match = metadata.match(/^data:(image\/(?:jpeg|png|webp));base64$/i);
  return new Blob([bytes], { type: match?.[1] || 'image/jpeg' });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível preparar a foto para o backup.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}
