export const isImageFile = (file) => {
  if (file.type && file.type.startsWith('image/')) return true;
  if (file.type === 'image/heic') return true;
  const ext = file.name.split('.').pop().toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'ico'];
  return imageExts.includes(ext);
};

export const PRESETS = {
  paper: [
    { name: 'A5', width: 559,  height: 794,  desc: '148×210 mm' },
    { name: 'A4', width: 794,  height: 1123, desc: '210×297 mm' },
    { name: 'A3', width: 1123, height: 1587, desc: '297×420 mm' },
    { name: 'A2', width: 1587, height: 2245, desc: '420×594 mm' },
  ],
  historical: [
    { name: 'Daguerreótipo',   year: '1839', width: 624,  height: 812, desc: 'Placa inteira' },
    { name: 'Carte de Visite', year: '1850', width: 225,  height: 375, desc: 'Retrato clássico' },
    { name: 'Película 35mm',   year: '1913', width: 800,  height: 533, desc: 'Proporção 3:2' },
    { name: 'Polaroid SX-70',  year: '1972', width: 600,  height: 600, desc: 'Quadrado analógico' },
    { name: 'Foto 10×15',      year: '1980', width: 900,  height: 600, desc: 'Padrão revelação' },
  ],
  modern: [
    { name: 'HD 720p',        year: '2000+', width: 1280, height: 720,  desc: 'Standard HD' },
    { name: 'Full HD',        year: '2005+', width: 1920, height: 1080, desc: 'Padrão atual' },
    { name: 'Insta Feed',     year: '2010+', width: 1080, height: 1080, desc: 'Quadrado 1:1' },
    { name: 'Stories/TikTok', year: '2016+', width: 1080, height: 1920, desc: 'Vertical 9:16' },
    { name: '4K UHD',         year: '2018+', width: 3840, height: 2160, desc: 'Ultra HD' },
  ],
};

export const formatBytes = (b) => {
  if (!b) return 'N/A';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / k ** i).toFixed(1)) + ' ' + s[i];
};

export const MARGIN_X = 80;
export const MARGIN_Y = 130;

export const fitZoom = (w, h) =>
  Math.min((window.innerWidth - MARGIN_X) / w, (window.innerHeight - MARGIN_Y) / h);

export const isNightNow = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
};
