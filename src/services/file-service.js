export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler esse arquivo.'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '')));
      } catch {
        reject(new Error('O arquivo não é um backup JSON válido.'));
      }
    };
    reader.readAsText(file);
  });
}

export function createCsvBlob(rows) {
  const content = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n');
  return new Blob([content], { type: 'text/csv;charset=utf-8' });
}
