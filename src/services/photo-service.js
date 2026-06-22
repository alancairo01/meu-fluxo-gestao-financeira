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
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
