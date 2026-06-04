import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  ImagePlus, MousePointer2, ZoomIn, ZoomOut, Save, X,
  ExternalLink, Download, FileText, Info, FileJson,
  Minus, Plus, Link, Undo2, Redo2, Trash2, Contrast, LayoutGrid
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { jsPDF } from 'jspdf';
import './App.css';

// ── Carregador dinâmico do heic2any (HEIC de iPhone) ──────────────────────────
const loadHeic2Any = () => {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js';
    script.onload = () => resolve(window.heic2any);
    script.onerror = (e) => reject(new Error('Erro ao carregar heic2any: ' + e.message));
    document.head.appendChild(script);
  });
};

// ── Carregador dinâmico do gifler (GIFs Animados) ─────────────────────────────
const loadGifler = () => {
  if (window.gifler) return Promise.resolve(window.gifler);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/gifler@0.1.0/gifler.min.js';
    script.onload = () => resolve(window.gifler);
    script.onerror = (e) => reject(new Error('Erro ao carregar gifler: ' + e.message));
    document.head.appendChild(script);
  });
};

// ── Utilitários nativos do IndexedDB para Autosave (evita estouro de 5MB) ──────
const DB_NAME = 'ArteroDB';
const STORE_NAME = 'autosave';

const getDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveToDB = async (key, val) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IndexedDB Save Error:", e);
  }
};

const getFromDB = async (key) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IndexedDB Get Error:", e);
    return null;
  }
};

// ── Identificador de arquivos de imagem (inclui HEIC) ───────────────────────
const isImageFile = (file) => {
  if (file.type && file.type.startsWith('image/')) return true;
  if (file.type === 'image/heic') return true;
  const ext = file.name.split('.').pop().toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'ico'];
  return imageExts.includes(ext);
};

// ── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = {
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

const formatBytes = (b) => {
  if (!b) return 'N/A';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / k ** i).toFixed(1)) + ' ' + s[i];
};

// ── Margens de fitZoom (espaço ocupado pela UI ao redor da prancheta) ────────
const MARGIN_X = 80;
const MARGIN_Y = 130;

// ── Função pura: zoom mínimo para caber a prancheta na tela ─────────────────
const fitZoom = (w, h) =>
  Math.min((window.innerWidth - MARGIN_X) / w, (window.innerHeight - MARGIN_Y) / h);

// ── Detecta modo noturno pela hora local ─────────────────────────────────────
const isNightNow = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
};

// ── Aplica tema no <html> imediatamente (antes do primeiro render) ───────────
document.documentElement.setAttribute('data-theme', 'dark');

// ════════════════════════════════════════════════════════════════════════════
// App
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const canvasRef   = useRef(null);
  const fabricRef   = useRef(null);   // fabric.Canvas

  // ── Estado da prancheta virtual ──────────────────────────────────────────
  const [virtualW, setVirtualW] = useState(() => window.innerWidth);
  const [virtualH, setVirtualH] = useState(() => window.innerHeight);
  const virtualWRef = useRef(window.innerWidth);
  const virtualHRef = useRef(window.innerHeight);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [artboardColor, setArtboardColor] = useState('#FFFFFF');

  // ── Tema — Inicia sempre em Modo Escuro (Night Mode) ──────────────────────
  const [isDark, setIsDark] = useState(true);

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveMenu,    setShowSaveMenu]     = useState(false);
  const [showPdfSizes,    setShowPdfSizes]     = useState(false);
  const [showRefsList,    setShowRefsList]     = useState(false);

  // ── Novos estados do painel de links, seleção e histórico ─────────────────
  const [linksList, setLinksList] = useState([]);
  const [showLinksDrawer, setShowLinksDrawer] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isGrayscaleActive, setIsGrayscaleActive] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Pilhas de histórico para Undo/Redo
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isApplyingHistory = useRef(false);
  const hasUnsavedChangesRef = useRef(false);

  // ── Sincroniza refs ───────────────────────────────────────────────────────
  const artboardColorRef = useRef(artboardColor);
  useEffect(() => { virtualWRef.current = virtualW; }, [virtualW]);
  useEffect(() => { virtualHRef.current = virtualH; }, [virtualH]);
  useEffect(() => { artboardColorRef.current = artboardColor; }, [artboardColor]);

  // ── Aplica tema ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ── Lógica de histórico (Undo/Redo) ───────────────────────────────────────
  const saveHistory = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || isApplyingHistory.current) return;
    const json = fc.toJSON(['meta', 'isGrayscale', 'id']);
    
    // Evita salvar estado duplicado consecutivamente
    if (undoStack.current.length > 0) {
      const last = undoStack.current[undoStack.current.length - 1];
      if (JSON.stringify(last) === JSON.stringify(json)) return;
    }

    undoStack.current.push(json);
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = []; // limpa o redo stack em novas ações
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(false);

    // Salva automaticamente no IndexedDB
    saveToDB('artero_autosave', {
      canvas: json,
      sheetSize: { width: virtualWRef.current, height: virtualHRef.current },
      artboardColor: artboardColorRef.current
    });
    hasUnsavedChangesRef.current = true;
  }, []);

  const handleUndo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || undoStack.current.length <= 1) return;

    isApplyingHistory.current = true;
    const current = fc.toJSON(['meta', 'isGrayscale', 'id']);
    redoStack.current.push(current);

    undoStack.current.pop(); // remove o atual
    const previous = undoStack.current[undoStack.current.length - 1];

    fc.loadFromJSON(previous).then(() => {
      // Restaurar filtros nos objetos após carregar o estado
      fc.getObjects().forEach(obj => {
        if (obj.get('isGrayscale')) {
          obj.filters = [new fabric.FabricImage.filters.Grayscale()];
          obj.applyFilters();
        } else {
          obj.filters = [];
          obj.applyFilters();
        }
      });
      fc.renderAll();
      isApplyingHistory.current = false;
      setCanUndo(undoStack.current.length > 1);
      setCanRedo(true);
      
      // Atualiza autosave
      saveToDB('artero_autosave', {
        canvas: previous,
        sheetSize: { width: virtualWRef.current, height: virtualHRef.current },
        artboardColor: artboardColorRef.current
      });
      hasUnsavedChangesRef.current = true;
    }).catch(err => {
      console.error(err);
      isApplyingHistory.current = false;
    });
  }, []);

  const handleRedo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || redoStack.current.length === 0) return;

    isApplyingHistory.current = true;
    const next = redoStack.current.pop();
    const current = fc.toJSON(['meta', 'isGrayscale', 'id']);
    undoStack.current.push(current);

    fc.loadFromJSON(next).then(() => {
      // Restaurar filtros nos objetos após carregar o estado
      fc.getObjects().forEach(obj => {
        if (obj.get('isGrayscale')) {
          obj.filters = [new fabric.FabricImage.filters.Grayscale()];
          obj.applyFilters();
        } else {
          obj.filters = [];
          obj.applyFilters();
        }
      });
      fc.renderAll();
      isApplyingHistory.current = false;
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);

      // Atualiza autosave
      saveToDB('artero_autosave', {
        canvas: next,
        sheetSize: { width: virtualWRef.current, height: virtualHRef.current },
        artboardColor: artboardColorRef.current
      });
      hasUnsavedChangesRef.current = true;
    }).catch(err => {
      console.error(err);
      isApplyingHistory.current = false;
    });
  }, []);

  // ── Atualização da lista de links (Referências reativas) ─────────────────
  const updateLinksList = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const objects = fc.getObjects();
    const list = objects
      .filter(o => o.get('meta'))
      .map(o => ({
        id: o.id || (o.id = Math.random().toString(36).substr(2, 9)),
        meta: o.get('meta'),
        ref: o
      }));
    setLinksList(list);
  }, []);

  // ── Lógica de Focar e Selecionar Objeto pelo Painel (Transição Suave) ──────
  const focusObject = useCallback((obj) => {
    const fc = fabricRef.current;
    if (!fc || !obj) return;
    fc.setActiveObject(obj);

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const objCenter = obj.getCenterPoint();

    const objW = obj.width * obj.scaleX;
    const objH = obj.height * obj.scaleY;
    
    // Calcula zoom ideal para enquadrar a imagem de forma confortável
    const targetZoom = Math.min((screenW - 240) / objW, (screenH - 240) / objH, 1.2);

    const targetTx = (screenW / 2) - objCenter.x * targetZoom;
    const targetTy = (screenH / 2) - objCenter.y * targetZoom;

    const startVpt = fc.viewportTransform.slice();
    const targetVpt = [targetZoom, 0, 0, targetZoom, targetTx, targetTy];

    // Transição animada do Viewport para deslizar suavemente até a foto (Apple Style)
    fabric.util.animate({
      startValue: 0,
      endValue: 1,
      duration: 400,
      onChange: (value) => {
        const currentVpt = startVpt.map((start, i) => start + (targetVpt[i] - start) * value);
        fc.setViewportTransform(currentVpt);
        fc.requestRenderAll();
      },
      onComplete: () => {
        setZoomLevel(targetZoom);
        fc.renderAll();
      }
    });
  }, []);

  // ── Atualização do estado de seleção ──────────────────────────────────────
  const updateSelection = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const active = fc.getActiveObject();
    setHasSelection(!!active);
    setIsGrayscaleActive(active ? !!active.get('isGrayscale') : false);
  }, []);

  // ── Excluir objeto selecionado ──────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const active = fc.getActiveObject();
    if (active) {
      fc.remove(active);
      fc.discardActiveObject();
      fc.renderAll();
    }
  }, []);

  // ── Conversor e validador de imagem (Suporte HEIC) ──────────────────────
  const processImageFile = async (file) => {
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';
    if (isHeic) {
      try {
        const heic2any = await loadHeic2Any();
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/png'
        });
        const blobToRead = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        return {
          blob: blobToRead,
          name: file.name.replace(/\.heic$/i, '.png'),
          type: 'image/png',
          size: blobToRead.size
        };
      } catch (e) {
        console.error("Erro ao converter HEIC:", e);
        alert("Não foi possível processar o arquivo HEIC do iPhone. Tente outro formato.");
        throw e;
      }
    }
    return {
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  // centerAndFit — GEOMETRIA DA CENTRALIZAÇÃO INFALÍVEL
  //
  // Lógica:
  //   1. Calculamos o zoom ideal para fazer a área de trabalho virtual caber na tela.
  //   2. Calculamos o deslocamento (tx, ty) para posicionar o centro do
  //      mundo virtual (virtualW/2, virtualH/2) exatamente no centro da tela.
  //   3. Aplicamos fc.setViewportTransform([zoom, 0, 0, zoom, tx, ty]).
  // ════════════════════════════════════════════════════════════════════════
  const centerAndFit = useCallback((optZoom) => {
    const fc = fabricRef.current;
    if (!fc) return 1;

    const w = virtualWRef.current;
    const h = virtualHRef.current;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 1. Zoom a aplicar (fit zoom com margens elegantes)
    const zoom = optZoom ?? Math.min((screenW - 80) / w, (screenH - 130) / h);

    // 2. Translação ideal para centralização absoluta
    const tx = (screenW / 2) - (w / 2) * zoom;
    const ty = (screenH / 2) - (h / 2) * zoom;

    // 3. Aplica transformação direta de viewport
    fc.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
    fc.renderAll();

    return zoom;
  }, []);

  // ── Callback para carregamento de imagem com a mágica 4x ──────────────────
  const handleImageLoaded = useCallback((img, name, type, size) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const imgW = img.width;
    const imgH = img.height;
    const currW = virtualWRef.current;
    const currH = virtualHRef.current;

    let targetW = currW;
    let targetH = currH;

    // Se a imagem exceder 25% da área/dimensão virtual, expandimos a prancheta
    // para ser pelo menos 4 vezes maior em largura e altura do que o objeto.
    if (imgW > currW / 4 || imgH > currH / 4) {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const aspectRatio = screenW / screenH;

      const reqW = imgW * 4;
      const reqH = imgH * 4;

      targetW = reqW;
      targetH = reqW / aspectRatio;
      if (targetH < reqH) {
        targetH = reqH;
        targetW = reqH * aspectRatio;
      }

      // Arredonda dimensões
      targetW = Math.round(targetW);
      targetH = Math.round(targetH);

      setVirtualW(targetW);
      setVirtualH(targetH);
      virtualWRef.current = targetW;
      virtualHRef.current = targetH;
    }

    img.set('meta', {
      source: name,
      addedAt: new Date().toISOString(),
      type,
      size: size ? formatBytes(size) : 'N/A'
    });

    // Posiciona no centro da prancheta virtual (origem 0,0)
    img.set({
      left: targetW / 2 - (imgW * img.scaleX) / 2,
      top: targetH / 2 - (imgH * img.scaleY) / 2,
    });

    fc.add(img);
    fc.setActiveObject(img);

    // Centraliza e ajusta viewport
    const z = centerAndFit();
    setZoomLevel(z);
  }, [centerAndFit]);

  const handleImageLoadedRef = useRef(handleImageLoaded);
  useEffect(() => {
    handleImageLoadedRef.current = handleImageLoaded;
  }, [handleImageLoaded]);
  const placeGif = useCallback(async (url, name, size = null) => {
    const fc = fabricRef.current;
    if (!fc) return;
    try {
      const giflerLib = await loadGifler();
      const canvasBuffer = document.createElement('canvas');
      let fabricImage = null;
      let isFirstFrame = true;
      
      giflerLib(url).frames(canvasBuffer, (ctx, frame) => {
        if (canvasBuffer.width !== frame.width || canvasBuffer.height !== frame.height) {
          canvasBuffer.width = frame.width;
          canvasBuffer.height = frame.height;
        }
        ctx.clearRect(0, 0, frame.width, frame.height);
        ctx.drawImage(frame.buffer, 0, 0);
        
        if (isFirstFrame) {
          isFirstFrame = false;
          fabricImage = new fabric.FabricImage(canvasBuffer);
          handleImageLoaded(fabricImage, name, 'image/gif', size);
        } else if (fabricImage) {
          if (fabricImage.width !== canvasBuffer.width || fabricImage.height !== canvasBuffer.height) {
            fabricImage.set({
              width: canvasBuffer.width,
              height: canvasBuffer.height
            });
          }
          fabricImage.set({ dirty: true });
          fabricRef.current?.requestRenderAll();
        }
      }, true);
    } catch (e) {
      console.error("Erro ao carregar GIF:", e);
    }
  }, [handleImageLoaded]);

  const toggleGrayscale = useCallback((obj) => {
    if (!obj) return;
    const fc = fabricRef.current;
    if (!fc) return;

    const hasFilter = obj.filters.some(f => f instanceof fabric.FabricImage.filters.Grayscale);
    if (hasFilter) {
      obj.filters = obj.filters.filter(f => !(f instanceof fabric.FabricImage.filters.Grayscale));
      obj.set('isGrayscale', false);
    } else {
      const grayscaleFilter = new fabric.FabricImage.filters.Grayscale();
      obj.filters.push(grayscaleFilter);
      obj.set('isGrayscale', true);
    }

    obj.applyFilters();
    fc.requestRenderAll();
    saveHistory();
    updateLinksList();
    
    if (fc.getActiveObject() === obj) {
      setIsGrayscaleActive(!!obj.get('isGrayscale'));
    }
  }, [saveHistory, updateLinksList]);

  const packObjects = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const objs = fc.getObjects().filter(o => o.get('meta'));
    if (objs.length === 0) return;

    const padding = 30;
    const maxRowW = virtualWRef.current * 0.8;
    const startX = virtualWRef.current * 0.1;
    const startY = virtualHRef.current * 0.1;

    let curX = startX;
    let curY = startY;
    let rowH = 0;

    fc.discardActiveObject();

    objs.forEach((obj) => {
      const w = obj.width * obj.scaleX;
      const h = obj.height * obj.scaleY;

      if (curX + w > startX + maxRowW && curX > startX) {
        curY += rowH + padding;
        curX = startX;
        rowH = 0;
      }

      const startLeft = obj.left;
      const startTop = obj.top;
      const targetLeft = curX;
      const targetTop = curY;

      fabric.util.animate({
        startValue: 0,
        endValue: 1,
        duration: 500,
        easing: fabric.util.ease.easeInOutCubic,
        onChange: (v) => {
          obj.set({
            left: startLeft + (targetLeft - startLeft) * v,
            top: startTop + (targetTop - startTop) * v
          });
          fc.requestRenderAll();
        }
      });

      rowH = Math.max(rowH, h);
      curX += w + padding;
    });

    const totalRequiredH = curY + rowH + virtualHRef.current * 0.1;
    if (totalRequiredH > virtualHRef.current) {
      setVirtualH(Math.round(totalRequiredH));
    }

    saveHistory();
  }, [saveHistory]);
  // ════════════════════════════════════════════════════════════════════════
  // Inicialização do canvas (uma única vez)
  // ════════════════════════════════════════════════════════════════════════
  // Inicialização do canvas (uma única vez)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const fc = new fabric.Canvas(canvasRef.current, {
      width:  window.innerWidth,
      height: window.innerHeight,
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: null, // transparente; fundo cinza vem do CSS
    });
    fabricRef.current = fc;

    // Carrega o autosave do IndexedDB
    getFromDB('artero_autosave').then((saved) => {
      if (saved && saved.canvas) {
        setVirtualW(saved.sheetSize.width);
        setVirtualH(saved.sheetSize.height);
        virtualWRef.current = saved.sheetSize.width;
        virtualHRef.current = saved.sheetSize.height;
        setArtboardColor(saved.artboardColor);
        artboardColorRef.current = saved.artboardColor;

        fc.loadFromJSON(saved.canvas).then(() => {
          // Restaurar os filtros nas imagens carregadas
          fc.getObjects().forEach(obj => {
            if (obj.get('isGrayscale')) {
              obj.filters = [new fabric.FabricImage.filters.Grayscale()];
              obj.applyFilters();
            }
          });
          fc.renderAll();
          updateLinksList();
          
          undoStack.current = [saved.canvas];
          setCanUndo(false);
          setCanRedo(false);

          setTimeout(() => {
            const z = centerAndFit();
            setZoomLevel(z);
          }, 100);
        });
      } else {
        saveHistory();
        const z = centerAndFit();
        setZoomLevel(z);
      }
    }).catch(err => {
      console.error("Erro ao carregar autosave:", err);
      saveHistory();
      const z = centerAndFit();
      setZoomLevel(z);
    });

    // ── Eventos do Fabric.js para histórico e reatividade ────────────────
    fc.on('object:added', () => {
      saveHistory();
      updateLinksList();
    });
    fc.on('object:removed', () => {
      saveHistory();
      updateLinksList();
    });
    fc.on('object:modified', () => {
      saveHistory();
    });

    fc.on('selection:created', updateSelection);
    fc.on('selection:updated', updateSelection);
    fc.on('selection:cleared', updateSelection);

    // ── Arrastar para panoramizar (Pan livre) ───────────────────────────────
    let panning = false, lastX = 0, lastY = 0;

    fc.on('mouse:down', (opt) => {
      if (!fc.getActiveObject()) {
        panning = true;
        fc.selection = false;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
      }
    });

    fc.on('mouse:move', (opt) => {
      if (!panning) return;
      const vpt = fc.viewportTransform.slice();
      vpt[4] += opt.e.clientX - lastX;
      vpt[5] += opt.e.clientY - lastY;
      fc.setViewportTransform(vpt);
      fc.requestRenderAll();
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
    });

    fc.on('mouse:up', () => {
      panning = false;
      fc.selection = true;
    });

    // ── Zoom com scroll relativo ao cursor do mouse ───────────────────────
    fc.on('mouse:wheel', (opt) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const w = virtualWRef.current;
      const h = virtualHRef.current;
      const minZ = Math.min((window.innerWidth - 80) / w, (window.innerHeight - 130) / h) * 0.1;
      let z = Math.max(minZ, Math.min(20, fc.getZoom() * (0.999 ** opt.e.deltaY)));

      fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
      setZoomLevel(z);
    });

    // ── Redimensionamento da janela ────────────────────────────────────────
    const onResize = () => {
      fc.setDimensions({ width: window.innerWidth, height: window.innerHeight });
      const z = centerAndFit();
      setZoomLevel(z);
    };
    window.addEventListener('resize', onResize);

    // ── Atalhos de teclado (Delete, Backspace, Undo, Redo) ─────────────────
    const onKeyDown = (e) => {
      const activeObject = fc.getActiveObject();
      const isInputActive = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
      if (isInputActive) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
        e.preventDefault();
        handleDeleteSelected();
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // ── Drop de imagem ────────────────────────────────────────────────────
    const placeImg = (url, name, type = 'image/web', size = null) => {
      fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
        if (handleImageLoadedRef.current) {
          handleImageLoadedRef.current(img, name, type, size);
        }
      }).catch(console.error);
    };

    const onDrop = async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length) {
        const f = e.dataTransfer.files[0];
        if (isImageFile(f)) {
          try {
            const processed = await processImageFile(f);
            const r = new FileReader();
            r.onload = (ev) => {
              if (processed.type === 'image/gif') {
                placeGif(ev.target.result, processed.name, processed.size);
              } else {
                placeImg(ev.target.result, processed.name, processed.type, processed.size);
              }
            };
            r.readAsDataURL(processed.blob);
          } catch (err) {
            console.error("Falha ao processar arquivo dropado:", err);
          }
          return;
        }
      }
      const url = e.dataTransfer.getData('url')
        || e.dataTransfer.getData('text/uri-list')
        || e.dataTransfer.getData('text/plain');
      if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
        if (url.toLowerCase().includes('.gif') || url.startsWith('data:image/gif')) {
          placeGif(url, url);
        } else {
          placeImg(url, url, 'image/web');
        }
        return;
      }
      const html = e.dataTransfer.getData('text/html');
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        const src = img ? (img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0]) : null;
        if (src) {
          if (src.toLowerCase().includes('.gif') || src.startsWith('data:image/gif')) {
            placeGif(src, src);
          } else {
            placeImg(src, src, 'image/web');
          }
        }
      }
    };

    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());

    // ── Colar da Área de Transferência (Ctrl+V) ───────────────────────────
    const onPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            try {
              const processed = await processImageFile(file);
              const r = new FileReader();
              r.onload = (ev) => {
                if (processed.type === 'image/gif') {
                  placeGif(ev.target.result, processed.name, processed.size);
                } else {
                  placeImg(ev.target.result, processed.name, processed.type, processed.size);
                }
              };
              r.readAsDataURL(processed.blob);
            } catch (err) {
              console.error("Erro ao colar imagem:", err);
            }
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);

    // ── Prevenção de Saída ────────────────────────────────────────────────
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      fc.dispose();
    };
  }, [centerAndFit, handleDeleteSelected, handleUndo, handleRedo, saveHistory, updateSelection, updateLinksList, placeGif]);

  // ── Tamanho da prancheta virtual ──────────────────────────────────────────
  useEffect(() => {
    virtualWRef.current = virtualW;
    virtualHRef.current = virtualH;
    if (!fabricRef.current) return;

    // Toda vez que muda o tamanho do canvas virtual, ajusta o zoom e a centralização
    const z = centerAndFit();
    setZoomLevel(z);
  }, [virtualW, virtualH, centerAndFit]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddImage = () => {
    const fc = fabricRef.current;
    if (!fc) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*, image/heic';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const processed = await processImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (processed.type === 'image/gif') {
            placeGif(ev.target.result, processed.name, processed.size);
          } else {
            fabric.FabricImage.fromURL(ev.target.result).then((img) => {
              handleImageLoaded(img, processed.name, processed.type, processed.size);
            });
          }
        };
        reader.readAsDataURL(processed.blob);
      } catch (err) {
        console.error("Erro ao carregar imagem selecionada:", err);
      }
    };
    input.click();
  };

  const scaleSheet = (factor) => {
    setVirtualW(w => Math.max(200, Math.round(w * factor)));
    setVirtualH(h => Math.max(150, Math.round(h * factor)));
  };

  const fitToScreen = () => {
    setVirtualW(window.innerWidth);
    setVirtualH(window.innerHeight);
  };

  const handleZoom = (direction) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const currentZoom = fc.getZoom();
    let z = currentZoom;
    if (direction === 'in') {
      z = Math.round((currentZoom + 0.1) * 10) / 10;
    } else {
      z = Math.round((currentZoom - 0.1) * 10) / 10;
    }
    const w = virtualWRef.current, h = virtualHRef.current;
    const minZ = Math.min((window.innerWidth - 80) / w, (window.innerHeight - 130) / h) * 0.1;
    z = Math.max(minZ, Math.min(20, z));
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;

    fc.zoomToPoint({ x: cx, y: cy }, z);
    setZoomLevel(z);
  };

  const getArtboardDataURL = (format = 'png') => {
    const fc = fabricRef.current;
    if (!fc) return null;
    const active = fc.getActiveObject();
    fc.discardActiveObject();

    const origBg = fc.backgroundColor;
    fc.backgroundColor = artboardColor;

    const data = fc.toDataURL({
      format: format === 'jpg' ? 'jpeg' : 'png',
      left: 0, top: 0,
      width: virtualWRef.current,
      height: virtualHRef.current,
      multiplier: 1, quality: 1,
    });

    fc.backgroundColor = origBg;
    if (active) fc.setActiveObject(active);
    fc.renderAll();
    return data;
  };

  const handleExportPNG = () => {
    const data = getArtboardDataURL('png');
    if (!data) return;
    Object.assign(document.createElement('a'), {
      download: `artero-${Date.now()}.png`, href: data,
    }).click();
    setShowSaveMenu(false);
    hasUnsavedChangesRef.current = false;
  };

  const handleExportJPG = () => {
    const data = getArtboardDataURL('jpg');
    if (!data) return;
    Object.assign(document.createElement('a'), {
      download: `artero-${Date.now()}.jpg`, href: data,
    }).click();
    setShowSaveMenu(false);
    hasUnsavedChangesRef.current = false;
  };

  const handleExportPDF = (fmt = 'a4') => {
    const data = getArtboardDataURL('png');
    if (!data) return;
    
    const isOriginal = fmt.toLowerCase() === 'original';
    let formatOption = fmt.toLowerCase();
    
    if (isOriginal) {
      const mmPerPx = 0.264583;
      formatOption = [virtualW * mmPerPx, virtualH * mmPerPx];
    }

    const doc = new jsPDF({
      orientation: virtualW > virtualH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: formatOption,
    });

    doc.addImage(data, 'PNG', 0, 0,
      doc.internal.pageSize.getWidth(),
      doc.internal.pageSize.getHeight()
    );
    doc.save(`artero-${fmt.toLowerCase()}-${Date.now()}.pdf`);
    setShowPdfSizes(false);
    setShowSaveMenu(false);
    hasUnsavedChangesRef.current = false;
  };

  const handleSaveJSON = () => {
    if (!fabricRef.current) return;
    const json = fabricRef.current.toJSON(['meta', 'isGrayscale', 'id']);
    json.sheetSize = { width: virtualW, height: virtualH };
    json.artboardColor = artboardColor;
    const a = document.createElement('a');
    a.download = `artero-${Date.now()}.json`;
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
    a.click();
    setShowSaveMenu(false);
    hasUnsavedChangesRef.current = false;
  };

  const getMeta = () =>
    fabricRef.current?.getObjects().filter(o => o.get('meta')).map(o => o.get('meta')) ?? [];

  return (
    <div className="app-root" style={{ backgroundColor: artboardColor }}>

      {/* ── Título no Canto Superior Direito (Painel Flutuante) ── */}
      <div className="panel-title mat">
        <span className="app-title-bold">Artero</span>
        <span className="app-title-beta">Open Beta</span>
      </div>

      {/* Canvas Fabric.js */}
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {/* ═══════════════════════════════════════════════
          TOOLBAR CENTRAL — ferramentas principais
          ═══════════════════════════════════════════════ */}
      <div className="toolbar mat">

        <button className="icon-btn" title="Selecionar"
          onClick={() => { if (fabricRef.current) fabricRef.current.isDrawingMode = false; }}>
          <MousePointer2 size={18} strokeWidth={1.75} />
        </button>

        <button className="icon-btn" title="Adicionar imagem" onClick={handleAddImage}>
          <ImagePlus size={18} strokeWidth={1.75} />
        </button>

        <button className="icon-btn" title="Auto-Organizar Imagens (Smart Grid)" onClick={packObjects}>
          <LayoutGrid size={18} strokeWidth={1.75} />
        </button>

        <div className="bar-sep" />

        {/* Undo e Redo */}
        <button className="icon-btn" title="Desfazer (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}>
          <Undo2 size={18} strokeWidth={1.75} style={{ opacity: canUndo ? 1 : 0.4 }} />
        </button>

        <button className="icon-btn" title="Refazer (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo}>
          <Redo2 size={18} strokeWidth={1.75} style={{ opacity: canRedo ? 1 : 0.4 }} />
        </button>

        {/* Lixeira */}
        <button className="icon-btn" title="Excluir selecionado (Delete)" onClick={handleDeleteSelected} disabled={!hasSelection}>
          <Trash2 size={18} strokeWidth={1.75} style={{ color: hasSelection ? '#FF3B30' : 'var(--label)', opacity: hasSelection ? 1 : 0.4 }} />
        </button>

        {/* Links */}
        <button className={`icon-btn${showLinksDrawer ? ' is-active' : ''}`} title="Painel de Links & Referências" onClick={() => setShowLinksDrawer(d => !d)}>
          <Link size={18} strokeWidth={1.75} />
        </button>

        <div className="bar-sep" />

        {/* Cor da prancheta */}
        <div className="color-slot">
          <div className="color-ring" role="button" tabIndex={0}
            onClick={() => setShowColorPicker(s => !s)}
            onKeyDown={e => e.key === 'Enter' && setShowColorPicker(s => !s)}>
            <span className="color-dot" style={{ backgroundColor: artboardColor }} />
          </div>
          {showColorPicker && (
            <div className="color-popover mat">
              <HexColorPicker color={artboardColor} onChange={setArtboardColor} />
            </div>
          )}
        </div>

        <div className="bar-sep" />

        {/* Salvar/Exportar */}
        <div className="save-slot">
          <button
            className={`icon-btn${showSaveMenu ? ' is-active' : ''}`}
            title="Exportar / Salvar"
            onClick={() => { setShowSaveMenu(s => !s); setShowPdfSizes(false); setShowRefsList(false); }}
          >
            <Save size={18} strokeWidth={1.75} />
          </button>

          {showSaveMenu && (
            <div className="save-bubbles">
              <button className="bubble-btn" title="Referências"
                onClick={() => { setShowRefsList(s => !s); setShowPdfSizes(false); }}>
                <Info size={16} strokeWidth={1.75} />
              </button>
              <button className="bubble-btn" title="Salvar JSON" onClick={handleSaveJSON}>
                <FileJson size={16} strokeWidth={1.75} />
              </button>
              <div style={{ position: 'relative' }}>
                <button className="bubble-btn" title="Exportar PDF"
                  onClick={() => { setShowPdfSizes(s => !s); setShowRefsList(false); }}>
                  <FileText size={16} strokeWidth={1.75} />
                </button>
                {showPdfSizes && (
                  <div className="pdf-sub mat">
                    {['A5','A4','A3','A2'].map(f => (
                      <button key={f} className="pill-btn" onClick={() => handleExportPDF(f)}>{f}</button>
                    ))}
                  </div>
                )}
              </div>
              <button className="bubble-btn" title="Exportar PNG" onClick={handleExportPNG}>
                <Download size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          PAINEL ESQUERDO — controles da prancheta
          ═══════════════════════════════════════════════ */}
      <div className="panel-left mat">
        {/* Diminuir */}
        <button className="icon-btn" title="Diminuir tamanho do canvas" onClick={() => scaleSheet(1/1.2)}>
          <Minus size={15} strokeWidth={2.25} />
        </button>

        {/* Aumentar */}
        <button className="icon-btn" title="Aumentar tamanho do canvas" onClick={() => scaleSheet(1.2)}>
          <Plus size={15} strokeWidth={2.25} />
        </button>

        <div className="bar-sep" />

        {/* Texto minimalista indicando o tamanho da prancheta virtual */}
        <span className="canvas-size-text">{virtualW} × {virtualH} px</span>
      </div>

      {/* ═══════════════════════════════════════════════
          PAINEL DIREITO — zoom de visualização
          ═══════════════════════════════════════════════ */}
      <div className="panel-right mat">
        <button
          className="icon-btn"
          title={isDark ? 'Modo Dia' : 'Modo Noite'}
          onClick={() => setIsDark(d => !d)}
          style={{ fontSize: '16px' }}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <div className="bar-sep" />
        <button className="icon-btn" title="Zoom −" onClick={() => handleZoom('out')}>
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>
        <button className="icon-btn" title="Zoom +" onClick={() => handleZoom('in')}>
          <ZoomIn size={15} strokeWidth={1.75} />
        </button>
        <div className="bar-sep" />
        <span className="zoom-value">{Math.round(zoomLevel * 100)}%</span>
      </div>

      {/* ═══════════════════════════════════════════════
          PAINEL FLUTUANTE — referências
          ═══════════════════════════════════════════════ */}
      {showRefsList && showSaveMenu && (
        <div className="refs-panel mat">
          <div className="refs-header">
            <span className="refs-title">Referências ({getMeta().length})</span>
            <button className="refs-close" onClick={() => setShowRefsList(false)}>
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
          <div className="refs-list">
            {getMeta().length === 0
              ? <span className="refs-empty">Nenhuma referência adicionada.</span>
              : getMeta().map((item, i) => (
                <div className="ref-item" key={i}>
                  <div className="ref-info">
                    <span className="ref-name" title={item.source}>{item.source}</span>
                    <div className="ref-meta">
                      <span>{item.type}</span><span>·</span><span>{item.size}</span>
                    </div>
                  </div>
                  {item.source.startsWith('http')
                    ? <a href={item.source} target="_blank" rel="noreferrer" className="ref-link">
                        <ExternalLink size={11} strokeWidth={1.75} />
                      </a>
                    : <span className="ref-tag">Local</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          SIDEBAR DESLIZANTE — LINKS ADICIONADOS
          ═══════════════════════════════════════════════ */}
      {showLinksDrawer && (
        <div className="links-drawer mat">
          <div className="links-drawer-header">
            <span className="links-drawer-title">Links & Arquivos ({linksList.length})</span>
            <button className="links-drawer-close" onClick={() => setShowLinksDrawer(false)}>
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="links-drawer-list">
            {linksList.length === 0 ? (
              <span className="links-drawer-empty">Nenhum item adicionado ao workspace.</span>
            ) : (
              linksList.map((item) => (
                <div key={item.id} className="links-drawer-item" onClick={() => focusObject(item.ref)}>
                  <div className="links-drawer-info">
                    <span className="links-drawer-name" title={item.meta.source}>
                      {item.meta.source}
                    </span>
                    <div className="links-drawer-meta">
                      <span>{item.meta.type}</span>
                      <span>·</span>
                      <span>{item.meta.size}</span>
                    </div>
                  </div>
                  <div className="links-drawer-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="links-action-btn" title="Alternar Preto e Branco"
                      onClick={() => toggleGrayscale(item.ref)}>
                      <Contrast size={12} strokeWidth={1.75} style={{ color: item.ref.get('isGrayscale') ? 'var(--blue)' : 'var(--label-2)' }} />
                    </button>
                    {item.meta.source.startsWith('http') && (
                      <a href={item.meta.source} target="_blank" rel="noreferrer" className="links-action-btn" title="Abrir Link Original">
                        <ExternalLink size={12} strokeWidth={1.75} />
                      </a>
                    )}
                    <button className="links-action-btn" title="Copiar Link/Nome"
                      onClick={() => {
                        navigator.clipboard.writeText(item.meta.source);
                        alert('Link copiado!');
                      }}>
                      <Info size={12} strokeWidth={1.75} />
                    </button>
                    <button className="links-action-btn delete" title="Excluir Objeto"
                      onClick={() => {
                        const fc = fabricRef.current;
                        if (fc) {
                          fc.remove(item.ref);
                          fc.discardActiveObject();
                          fc.renderAll();
                        }
                      }}>
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
