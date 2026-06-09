export const loadHeic2Any = () => {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js';
    script.onload = () => resolve(window.heic2any);
    script.onerror = (e) => reject(new Error('Erro ao carregar heic2any: ' + e.message));
    document.head.appendChild(script);
  });
};

export const loadGifler = () => {
  if (window.gifler) return Promise.resolve(window.gifler);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/gifler@0.1.0/gifler.min.js';
    script.onload = () => resolve(window.gifler);
    script.onerror = (e) => reject(new Error('Erro ao carregar gifler: ' + e.message));
    document.head.appendChild(script);
  });
};
