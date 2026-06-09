import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  ImagePlus, MousePointer2, ZoomIn, ZoomOut, Save, X,
  ExternalLink, Download, FileText, Info, FileJson,
  Minus, Plus, Link, Undo2, Redo2, Trash2, Contrast, LayoutGrid,
  Eraser, Maximize, Grid, Hand, Expand, Shrink, Eye, EyeOff,
  Sun, Moon, Clipboard, Move, Pointer, Heart, Coffee, ArrowUpToLine, ArrowDownToLine
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { jsPDF } from 'jspdf';
import './App.css';

import { loadHeic2Any, loadGifler } from './services/scriptLoader';
import { getDB, saveToDB, getFromDB } from './services/db';
import { isImageFile, PRESETS, formatBytes, MARGIN_X, MARGIN_Y, fitZoom, isNightNow } from './utils/canvasHelpers';
import ClearConfirmModal from './components/ClearConfirmModal';
import MobileWarning from './components/MobileWarning';
import LinksDrawer from './components/LinksDrawer';
import OnboardingModal from './components/OnboardingModal';

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
  const [artboardColor, setArtboardColor] = useState('#fafafa');
  const [isBlueprint, setIsBlueprint] = useState(false);
  const [prevColor, setPrevColor] = useState('#fafafa');
  const [gridBoardType, setGridBoardType] = useState('blueprint');
  const [showGridMenu, setShowGridMenu] = useState(false);

  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'pan'
  const activeToolRef = useRef('select');
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  const isSpacePressedRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUiHidden, setIsUiHidden] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // ── Tema — Inicia sempre em Modo Escuro (Night Mode) ──────────────────────
  const [isDark, setIsDark] = useState(true);

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveMenu,    setShowSaveMenu]     = useState(false);
  const [showPdfSizes,    setShowPdfSizes]     = useState(false);
  const [showOnboarding,  setShowOnboarding]  = useState(true);
  const [activeOnboardingSlide, setActiveOnboardingSlide] = useState(0);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isMobileWarningVisible, setIsMobileWarningVisible] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileWarningVisible(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const prevZoomLevelRef = useRef(1);
  const isManuallyScaledRef = useRef(false);
  const copyTimeoutRef = useRef(null);
  const colorPickerRef = useRef(null);
  const gridMenuRef = useRef(null);
  const saveMenuRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Fechar menus flutuantes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target)) {
        setShowSaveMenu(false);
        setShowPdfSizes(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Sincroniza refs ───────────────────────────────────────────────────────
  const artboardColorRef = useRef(artboardColor);
  useEffect(() => { virtualWRef.current = virtualW; }, [virtualW]);
  useEffect(() => { virtualHRef.current = virtualH; }, [virtualH]);
  useEffect(() => { artboardColorRef.current = artboardColor; }, [artboardColor]);

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

    // 1. Zoom a aplicar (fit zoom com margens elegantes, exceto se coincidir com o tamanho da tela)
    let zoom = optZoom;
    if (zoom === undefined) {
      if (w === screenW && h === screenH) {
        zoom = 1.0;
      } else {
        // Reservamos margens maiores: 120px na largura (60px esq/dir) e 180px na altura (80px topo, 100px rodapé)
        // para garantir que a prancheta nunca seja sobreposta pelos menus flutuantes de baixo (76px de altura).
        zoom = Math.min((screenW - 120) / w, (screenH - 180) / h);
      }
    }

    // 2. Translação ideal para centralização absoluta
    const tx = (screenW / 2) - (w / 2) * zoom;
    const ty = (screenH / 2) - (h / 2) * zoom;

    // 3. Aplica transformação direta de viewport
    fc.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
    fc.renderAll();

    return zoom;
  }, []);

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
          obj.filters = [new fabric.filters.Grayscale()];
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
          obj.filters = [new fabric.filters.Grayscale()];
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
    const activeObjects = fc.getActiveObjects();
    if (activeObjects && activeObjects.length > 0) {
      activeObjects.forEach(obj => {
        fc.remove(obj);
      });
      fc.discardActiveObject();
      fc.renderAll();
    }
  }, []);
  
  // ── Controle de Z-Index (Trazer para frente / Enviar para trás) ───────────
  const handleBringToFront = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const activeObjects = fc.getActiveObjects();
    if (activeObjects && activeObjects.length > 0) {
      fc.discardActiveObject();
      activeObjects.forEach(obj => fc.bringObjectToFront(obj));
      
      if (activeObjects.length === 1) {
        fc.setActiveObject(activeObjects[0]);
      } else {
        const sel = new fabric.ActiveSelection(activeObjects, { canvas: fc });
        fc.setActiveObject(sel);
      }
      fc.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const handleSendToBack = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const activeObjects = fc.getActiveObjects();
    if (activeObjects && activeObjects.length > 0) {
      fc.discardActiveObject();
      const reversed = [...activeObjects].reverse();
      reversed.forEach(obj => fc.sendObjectToBack(obj));
      
      if (activeObjects.length === 1) {
        fc.setActiveObject(activeObjects[0]);
      } else {
        const sel = new fabric.ActiveSelection(activeObjects, { canvas: fc });
        fc.setActiveObject(sel);
      }
      fc.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);
 
  const executeClearCanvas = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.clear();
    fc.backgroundColor = null;
    fc.renderAll();
    
    setArtboardColor('#fafafa');
    setIsBlueprint(false);
    
    saveHistory();
    updateLinksList();
    
    setHasSelection(false);
    setIsGrayscaleActive(false);
    
    setVirtualW(window.innerWidth);
    setVirtualH(window.innerHeight);
    
    setTimeout(() => {
      const z = centerAndFit();
      setZoomLevel(z);
    }, 50);
  }, [saveHistory, updateLinksList, centerAndFit]);

  const handleClearCanvas = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const hasImages = fc.getObjects().filter(o => o.get('meta')).length > 0;
    if (hasImages) {
      setShowClearConfirmModal(true);
    } else {
      executeClearCanvas();
    }
  }, [executeClearCanvas]);

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

    const isPanMode = activeToolRef.current === 'pan';

    // Posiciona no centro da prancheta virtual (origem 0,0) com um pequeno deslocamento em cascata
    const offset = (fc.getObjects().length * 20) % 200;
    img.set({
      left: targetW / 2 - (imgW * img.scaleX) / 2 + offset,
      top: targetH / 2 - (imgH * img.scaleY) / 2 + offset,
      selectable: !isPanMode,
      evented: !isPanMode
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
  const placeGif = useCallback((url, name, size = null) => {
    return new Promise(async (resolve) => {
      const fc = fabricRef.current;
      if (!fc) {
        resolve();
        return;
      }
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
            resolve();
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
        resolve();
      }
    });
  }, [handleImageLoaded]);

  const toggleGrayscale = useCallback((obj) => {
    if (!obj) return;
    const fc = fabricRef.current;
    if (!fc) return;

    const GrayscaleFilterClass = fabric.filters.Grayscale;
    const hasFilter = obj.filters.some(f => f instanceof GrayscaleFilterClass);
    if (hasFilter) {
      obj.filters = obj.filters.filter(f => !(f instanceof GrayscaleFilterClass));
      obj.set('isGrayscale', false);
    } else {
      const grayscaleFilter = new GrayscaleFilterClass();
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

    // Reorganização aleatória (embaralha os objetos para criar layouts diferentes a cada clique)
    const sortedObjs = [...objs];
    for (let i = sortedObjs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sortedObjs[i], sortedObjs[j]] = [sortedObjs[j], sortedObjs[i]];
    }

    const count = sortedObjs.length;
    // Determina a quantidade ideal de colunas com base no número de objetos
    let cols = 3;
    if (count <= 2) {
      cols = count;
    } else if (count <= 4) {
      cols = 2;
    } else if (count <= 9) {
      cols = 3;
    } else if (count <= 16) {
      cols = 4;
    } else {
      cols = Math.ceil(Math.sqrt(count));
    }

    // Calcula espaçamento dinâmico proporcional ao tamanho médio
    let totalW = 0;
    let totalH = 0;
    sortedObjs.forEach((obj) => {
      const rect = obj.getBoundingRect(true);
      totalW += rect.width;
      totalH += rect.height;
    });
    const avgW = totalW / count;
    const avgH = totalH / count;
    const avgSize = (avgW + avgH) / 2;
    const padding = Math.max(30, Math.min(100, Math.round(avgSize * 0.12)));

    const rows = Math.ceil(count / cols);
    const colWidths = new Array(cols).fill(0);
    const rowHeights = new Array(rows).fill(0);

    // Encontra a largura máxima de cada coluna e a altura máxima de cada linha
    sortedObjs.forEach((obj, index) => {
      const rect = obj.getBoundingRect(true);
      const col = index % cols;
      const row = Math.floor(index / cols);
      colWidths[col] = Math.max(colWidths[col], rect.width);
      rowHeights[row] = Math.max(rowHeights[row], rect.height);
    });

    // Calcula dimensões totais do grid
    const totalGridW = colWidths.reduce((sum, w) => sum + w, 0) + padding * (cols - 1);
    const totalGridH = rowHeights.reduce((sum, h) => sum + h, 0) + padding * (rows - 1);

    // Adapta o tamanho da prancheta virtual caso o grid seja maior
    let boardW = virtualWRef.current;
    let boardH = virtualHRef.current;
    
    const minMargin = 100;
    const requiredW = totalGridW + minMargin * 2;
    const requiredH = totalGridH + minMargin * 2;

    if (requiredW > boardW) {
      boardW = Math.round(requiredW);
      setVirtualW(boardW);
      virtualWRef.current = boardW;
    }
    if (requiredH > boardH) {
      boardH = Math.round(requiredH);
      setVirtualH(boardH);
      virtualHRef.current = boardH;
    }

    const startX = (boardW - totalGridW) / 2;
    const startY = (boardH - totalGridH) / 2;

    // Pré-calcula os offsets das colunas e linhas
    const colOffsets = [];
    let accumX = startX;
    for (let c = 0; c < cols; c++) {
      colOffsets.push(accumX);
      accumX += colWidths[c] + padding;
    }

    const rowOffsets = [];
    let accumY = startY;
    for (let r = 0; r < rows; r++) {
      rowOffsets.push(accumY);
      accumY += rowHeights[r] + padding;
    }

    fc.discardActiveObject();

    sortedObjs.forEach((obj, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const rect = obj.getBoundingRect(true);
      const deltaLeft = obj.left - rect.left;
      const deltaTop = obj.top - rect.top;

      // Centraliza o objeto dentro do espaço de sua respectiva célula
      const cellW = colWidths[col];
      const cellH = rowHeights[row];
      const cellX = colOffsets[col] + (cellW - rect.width) / 2;
      const cellY = rowOffsets[row] + (cellH - rect.height) / 2;

      const startLeft = obj.left;
      const startTop = obj.top;
      const targetLeft = cellX + deltaLeft;
      const targetTop = cellY + deltaTop;

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
          obj.setCoords();
          fc.requestRenderAll();
        }
      });
    });

    // Centraliza a visualização e ajusta o zoom após a animação
    setTimeout(() => {
      const z = centerAndFit();
      setZoomLevel(z);
    }, 550);

    saveHistory();
  }, [saveHistory, centerAndFit]);
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
        setArtboardColor(saved.artboardColor);
        artboardColorRef.current = saved.artboardColor;

        fc.loadFromJSON(saved.canvas).then(() => {
          const objects = fc.getObjects();
          if (objects.length === 0) {
            // Se estiver vazio, redefine para o tamanho da tela do usuário
            setVirtualW(window.innerWidth);
            setVirtualH(window.innerHeight);
            virtualWRef.current = window.innerWidth;
            virtualHRef.current = window.innerHeight;
            
            fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
            fc.renderAll();
            setZoomLevel(1);
            
            undoStack.current = [saved.canvas];
            setCanUndo(false);
            setCanRedo(false);
          } else {
            // Restaurar os filtros nas imagens carregadas
            objects.forEach(obj => {
              if (obj.get('isGrayscale')) {
                obj.filters = [new fabric.filters.Grayscale()];
                obj.applyFilters();
              }
            });
            fc.renderAll();
            updateLinksList();
            
            setVirtualW(saved.sheetSize.width);
            setVirtualH(saved.sheetSize.height);
            virtualWRef.current = saved.sheetSize.width;
            virtualHRef.current = saved.sheetSize.height;
            
            undoStack.current = [saved.canvas];
            setCanUndo(false);
            setCanRedo(false);

            setTimeout(() => {
              const z = centerAndFit();
              setZoomLevel(z);
            }, 100);
          }
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

    // Configura o cursor inicial no Canvas
    fc.selection = (activeToolRef.current === 'select');
    fc.defaultCursor = (activeToolRef.current === 'pan' ? 'grab' : 'default');

    // ── Arrastar para panoramizar (Pan livre) ───────────────────────────────
    let panning = false, lastX = 0, lastY = 0;
    let lastClickTime = 0;
    let isDoubleClickPan = false;

    fc.on('mouse:down', (opt) => {
      const now = Date.now();
      const isDoubleClick = (now - lastClickTime < 300);
      lastClickTime = now;

      const isPanMode = activeToolRef.current === 'pan' || isSpacePressedRef.current;
      
      if (isPanMode || isDoubleClick) {
        panning = true;
        isDoubleClickPan = isDoubleClick;
        fc.selection = false;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        
        fc.defaultCursor = 'grabbing';
        fc.setCursor('grabbing');
      } else {
        panning = false;
      }
    });

    fc.on('mouse:move', (opt) => {
      if (panning) {
        fc.defaultCursor = 'grabbing';
        fc.setCursor('grabbing');

        const vpt = fc.viewportTransform.slice();
        vpt[4] += opt.e.clientX - lastX;
        vpt[5] += opt.e.clientY - lastY;
        fc.setViewportTransform(vpt);
        fc.requestRenderAll();
        
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
      }
    });

    fc.on('mouse:up', () => {
      if (panning) {
        panning = false;
        isDoubleClickPan = false;
        
        const isPanMode = activeToolRef.current === 'pan' || isSpacePressedRef.current;
        if (isPanMode) {
          fc.selection = false;
          fc.defaultCursor = 'grab';
          fc.setCursor('grab');
        } else {
          fc.selection = true;
          fc.defaultCursor = 'default';
          fc.setCursor('default');
        }
        fc.requestRenderAll();
      }
    });

    // ── Zoom com scroll relativo ao cursor do mouse ───────────────────────
    fc.on('mouse:wheel', (opt) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const isZoom = opt.e.ctrlKey;
      
      if (isZoom) {
        const w = virtualWRef.current;
        const h = virtualHRef.current;
        const minZ = Math.min((window.innerWidth - 80) / w, (window.innerHeight - 130) / h) * 0.1;
        let z = Math.max(minZ, Math.min(20, fc.getZoom() * (0.999 ** opt.e.deltaY)));

        fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
        setZoomLevel(z);
      } else {
        const vpt = fc.viewportTransform.slice();
        vpt[4] -= opt.e.deltaX;
        vpt[5] -= opt.e.deltaY;
        fc.setViewportTransform(vpt);
        fc.requestRenderAll();
      }
    });

    // ── Redimensionamento da janela ────────────────────────────────────────
    const onResize = () => {
      fc.setDimensions({ width: window.innerWidth, height: window.innerHeight });
      if (!isManuallyScaledRef.current) {
        setVirtualW(window.innerWidth);
        setVirtualH(window.innerHeight);
      }
      const z = centerAndFit();
      setZoomLevel(z);
    };
    window.addEventListener('resize', onResize);

    // ── Atalhos de teclado (Delete, Backspace, Undo, Redo) ─────────────────
    const onKeyDown = (e) => {
      const activeObject = fc.getActiveObject();
      const isInputActive = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
      if (isInputActive) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          fc.selection = false;
          fc.defaultCursor = 'grab';
          fc.setCursor('grab');
          fc.forEachObject(o => {
            o.selectable = false;
            o.evented = false;
          });
          fc.discardActiveObject();
          fc.requestRenderAll();
        }
      }

      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handleSetActiveTool('select');
      }

      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleSetActiveTool('pan');
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
        e.preventDefault();
        handleDeleteSelected();
      }

      if (e.key === ']' && activeObject) {
        e.preventDefault();
        handleBringToFront();
      }

      if (e.key === '[' && activeObject) {
        e.preventDefault();
        handleSendToBack();
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

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        const isInputActive = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
        if (!isInputActive) {
          e.preventDefault();
          isSpacePressedRef.current = false;
          const tool = activeToolRef.current;
          if (tool === 'pan') {
            fc.selection = false;
            fc.defaultCursor = 'grab';
            fc.setCursor('grab');
            fc.forEachObject(o => {
              o.selectable = false;
              o.evented = false;
            });
          } else {
            fc.selection = true;
            fc.defaultCursor = 'default';
            fc.setCursor('default');
            fc.forEachObject(o => {
              if (o.get('meta')) {
                o.selectable = true;
                o.evented = true;
              }
            });
          }
          fc.requestRenderAll();
        }
      }
    };
    window.addEventListener('keyup', onKeyUp);

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
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(isImageFile);
        if (imageFiles.length > 0) {
          const loadPromises = imageFiles.map((f) => {
            return new Promise(async (resolve) => {
              try {
                const processed = await processImageFile(f);
                const r = new FileReader();
                r.onload = (ev) => {
                  if (processed.type === 'image/gif') {
                    placeGif(ev.target.result, processed.name, processed.size).then(() => resolve());
                  } else {
                    fabric.FabricImage.fromURL(ev.target.result).then((img) => {
                      handleImageLoaded(img, processed.name, processed.type, processed.size);
                      resolve();
                    }).catch((err) => {
                      console.error("Erro ao carregar imagem dropada:", err);
                      resolve();
                    });
                  }
                };
                r.readAsDataURL(processed.blob);
              } catch (err) {
                console.error("Falha ao processar arquivo dropado:", err);
                resolve();
              }
            });
          });

          await Promise.all(loadPromises);

          if (imageFiles.length > 1) {
            setTimeout(() => {
              packObjects();
            }, 300);
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
      const fc = fabricRef.current;
      const hasImages = fc && fc.getObjects().filter(o => o.get('meta')).length > 0;
      if (hasUnsavedChangesRef.current || hasImages) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      fc.dispose();
    };
  }, [centerAndFit, handleDeleteSelected, handleBringToFront, handleSendToBack, handleUndo, handleRedo, saveHistory, updateSelection, updateLinksList, placeGif]);

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
  const toggleBlueprint = () => {
    setShowGridMenu(s => !s);
  };

  const selectGridBoard = (type) => {
    const boardColors = {
      'blueprint': '#0041BA',
      'chalkboard': '#1A1A1A',
      'cutting-green': '#0F3A2E',
      'sketch-paper': '#F4EBD9',
      'off-white': '#F5F5F5'
    };
    
    if (isBlueprint && gridBoardType === type) {
      setArtboardColor(prevColor);
      setIsBlueprint(false);
    } else {
      if (!isBlueprint) {
        setPrevColor(artboardColor);
      }
      setGridBoardType(type);
      setArtboardColor(boardColors[type]);
      setIsBlueprint(true);
      
      // Muda o tema automaticamente dependendo da grade escolhida
      // Blueprint (azul) e chalkboard (preto) mudam para o modo day (isDark = false)
      // Cutting-green (verde), sketch-paper (creme) e off-white (branco) vão para o modo noite (isDark = true)
      if (['blueprint', 'chalkboard'].includes(type)) {
        setIsDark(false); // modo day
      } else {
        setIsDark(true); // modo noite
      }
    }
    setShowGridMenu(false);
  };

  const handleColorChange = useCallback((newColor) => {
    setArtboardColor(newColor);
    setIsBlueprint(false);
    
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(newColor.toUpperCase()).catch(err => {
          console.warn('Could not copy color to clipboard:', err);
        });
      }
    }, 200);
  }, []);

  const handleSetActiveTool = useCallback((tool) => {
    setActiveTool(tool);
    const fc = fabricRef.current;
    if (!fc) return;
    
    if (tool === 'pan') {
      fc.selection = false;
      fc.defaultCursor = 'grab';
      fc.setCursor('grab');
      fc.forEachObject(o => {
        o.selectable = false;
        o.evented = false;
      });
    } else {
      fc.selection = true;
      fc.defaultCursor = 'default';
      fc.setCursor('default');
      fc.forEachObject(o => {
        if (o.get('meta')) {
          o.selectable = true;
          o.evented = true;
        }
      });
    }
    fc.discardActiveObject();
    fc.requestRenderAll();
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Erro ao ativar tela inteira:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error("Erro ao sair da tela inteira:", err);
      });
    }
  };

  const handleRightClickHelp = (e, title, desc) => {
    e.preventDefault();
    alert(`${title}\n\n${desc}`);
  };

  const handleAddImage = () => {
    const fc = fabricRef.current;
    if (!fc) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*, image/heic';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const loadPromises = files.map((file) => {
        return new Promise(async (resolve) => {
          try {
            const processed = await processImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (processed.type === 'image/gif') {
                placeGif(ev.target.result, processed.name, processed.size).then(() => resolve());
              } else {
                fabric.FabricImage.fromURL(ev.target.result).then((img) => {
                  handleImageLoaded(img, processed.name, processed.type, processed.size);
                  resolve();
                }).catch((err) => {
                  console.error(err);
                  resolve();
                });
              }
            };
            reader.readAsDataURL(processed.blob);
          } catch (err) {
            console.error("Erro ao carregar imagem selecionada:", err);
            resolve();
          }
        });
      });

      await Promise.all(loadPromises);

      if (files.length > 1) {
        setTimeout(() => {
          packObjects();
        }, 300);
      }
    };
    input.click();
  };

  const scaleSheet = (factor) => {
    isManuallyScaledRef.current = true;
    setVirtualW(w => Math.max(200, Math.round(w * factor)));
    setVirtualH(h => Math.max(150, Math.round(h * factor)));
  };

  const fitToScreen = () => {
    isManuallyScaledRef.current = false;
    setVirtualW(window.innerWidth);
    setVirtualH(window.innerHeight);
  };
 
  const handleResetZoom = useCallback(() => {
    const z = centerAndFit();
    setZoomLevel(z);
  }, [centerAndFit]);

  const handleFitContent = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const objs = fc.getObjects().filter(o => o.get('meta'));
    if (objs.length === 0) {
      const z = centerAndFit();
      setZoomLevel(z);
      return;
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(obj => {
      const bound = obj.getBoundingRect(true);
      if (bound.left < minX) minX = bound.left;
      if (bound.top < minY) minY = bound.top;
      if (bound.left + bound.width > maxX) maxX = bound.left + bound.width;
      if (bound.top + bound.height > maxY) maxY = bound.top + bound.height;
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 60;
    const wWithPadding = width + padding * 2;
    const hWithPadding = height + padding * 2;
    
    const scaleX = window.innerWidth / wWithPadding;
    const scaleY = window.innerHeight / hWithPadding;
    let z = Math.min(scaleX, scaleY);
    z = Math.max(0.05, Math.min(4, z));
    
    const midX = minX + width / 2;
    const midY = minY + height / 2;
    
    const vpt = fc.viewportTransform.slice();
    vpt[0] = z;
    vpt[3] = z;
    vpt[4] = window.innerWidth / 2 - midX * z;
    vpt[5] = window.innerHeight / 2 - midY * z;
    
    fc.setViewportTransform(vpt);
    fc.requestRenderAll();
    setZoomLevel(z);
  }, [centerAndFit]);

  const toggleZoom100 = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    
    const currentPercent = Math.round(zoomLevel * 100);
    if (currentPercent === 100) {
      const targetZoom = prevZoomLevelRef.current || 1;
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      fc.zoomToPoint({ x: cx, y: cy }, targetZoom);
      setZoomLevel(targetZoom);
    } else {
      prevZoomLevelRef.current = zoomLevel;
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      fc.zoomToPoint({ x: cx, y: cy }, 1);
      setZoomLevel(1);
    }
  }, [zoomLevel]);

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

  const handleClearConfirmWithSave = () => {
    handleSaveJSON();
    executeClearCanvas();
    setShowClearConfirmModal(false);
  };

  const handleClearConfirmWithoutSave = () => {
    executeClearCanvas();
    setShowClearConfirmModal(false);
  };

  const getMeta = () =>
    fabricRef.current?.getObjects().filter(o => o.get('meta')).map(o => o.get('meta')) ?? [];

  return (
    <div className={`app-root${isBlueprint ? ` is-blueprint grid-${gridBoardType}` : ''}`} style={{ backgroundColor: artboardColor }}>

      {/* Canvas Fabric.js */}
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {/* ── Painel Superior Direito — Controles de visualização (Tela Inteira / Ocultar UI) ── */}
      <div className={`panel-top-right mat${showLinksDrawer && !isUiHidden ? ' drawer-open' : ''}`}>
        <button
          className="icon-btn"
          title={isFullscreen ? "Sair da Tela Inteira" : "Tela Inteira"}
          onClick={toggleFullscreen}
          onContextMenu={(e) => handleRightClickHelp(e, "Tela Inteira", "Alterna a visualização da tela entre o modo normal e o modo de tela inteira.")}
        >
          {isFullscreen ? <Shrink size={18} strokeWidth={1.75} style={{ color: 'var(--blue)' }} /> : <Expand size={18} strokeWidth={1.75} />}
        </button>

        <button
          className={`icon-btn${isUiHidden ? ' is-active' : ''}`}
          title={isUiHidden ? "Mostrar Painéis" : "Ocultar Painéis"}
          onClick={() => setIsUiHidden(h => !h)}
          onContextMenu={(e) => handleRightClickHelp(e, "Ocultar Painéis", "Oculta temporariamente todas as barras de ferramentas da tela para uma visualização livre de distrações. Clique novamente para restaurar.")}
        >
          {isUiHidden ? <EyeOff size={18} strokeWidth={1.75} style={{ color: 'var(--blue)' }} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </div>

      {/* ── Título no Canto Superior Esquerdo (Painel Flutuante Interativo) ── */}
      <button 
        className={`panel-title mat${isUiHidden ? ' ui-hidden' : ''}`}
        title="Apresentação e Guia (Onboarding)"
        onClick={() => { if (!isUiHidden) { setShowOnboarding(true); setActiveOnboardingSlide(0); } }}
      >
        <span className="app-title-bold">Artero</span>
        <span className="app-title-beta">Open Beta</span>
        <span className="app-title-v1-pill">V2</span>
      </button>

      {/* ═══════════════════════════════════════════════
          TOOLBAR CENTRAL — ferramentas principais
          ═══════════════════════════════════════════════ */}
      <div className={`toolbar mat${isUiHidden ? ' ui-hidden' : ''}`}>

        <button
          className={`icon-btn${activeTool === 'select' ? ' is-active' : ''}`}
          title="Ferramenta Seleção (V)"
          onClick={() => handleSetActiveTool('select')}
          onContextMenu={(e) => handleRightClickHelp(e, "Seleção (V)", "Ativa a ferramenta de seleção. Clicar no fundo e arrastar cria um retângulo de seleção (seleção em janela). Clicar nas imagens permite movê-las, redimensioná-las ou rotacioná-las.")}
        >
          <MousePointer2 size={18} strokeWidth={1.75} />
        </button>

        <button
          className={`icon-btn${activeTool === 'pan' ? ' is-active' : ''}`}
          title="Ferramenta Mão / Mover Tela (H)"
          onClick={() => handleSetActiveTool('pan')}
          onContextMenu={(e) => handleRightClickHelp(e, "Mão / Mover Tela (H)", "Ativa a ferramenta de mãozinha. Clicar e arrastar em qualquer ponto da tela move a visualização inteira do seu workspace.")}
        >
          <Hand size={18} strokeWidth={1.75} />
        </button>

        <button className="icon-btn" title="Adicionar imagem"
          onClick={handleAddImage}
          onContextMenu={(e) => handleRightClickHelp(e, "Adicionar imagem", "Abre o seletor do computador para importar uma ou mais imagens para a prancheta de uma só vez.")}
        >
          <ImagePlus size={18} strokeWidth={1.75} />
        </button>

        <button className="icon-btn" title="Auto-Organizar Imagens (Magic Grid)"
          onClick={packObjects}
          onContextMenu={(e) => handleRightClickHelp(e, "Magic Grid (Auto-Organizar)", "Alinha e organiza todas as imagens na prancheta automaticamente em fileiras perfeitas com espaçamento proporcional uniforme.")}
        >
          <LayoutGrid size={18} strokeWidth={1.75} />
        </button>

        <div className="bar-sep" />

        {/* Undo e Redo */}
        <button className="icon-btn" title="Desfazer (Ctrl+Z)"
          onClick={handleUndo}
          disabled={!canUndo}
          onContextMenu={(e) => handleRightClickHelp(e, "Desfazer (Ctrl+Z)", "Reverte a última ação de edição realizada na prancheta (movimentação, inserção, exclusão, etc.).")}
        >
          <Undo2 size={18} strokeWidth={1.75} style={{ opacity: canUndo ? 1 : 0.4 }} />
        </button>

        <button className="icon-btn" title="Refazer (Ctrl+Shift+Z)"
          onClick={handleRedo}
          disabled={!canRedo}
          onContextMenu={(e) => handleRightClickHelp(e, "Refazer (Ctrl+Shift+Z)", "Reaplica a última alteração desfeita.")}
        >
          <Redo2 size={18} strokeWidth={1.75} style={{ opacity: canRedo ? 1 : 0.4 }} />
        </button>

        <div className="bar-sep" />

        {/* Z-Index */}
        <button className="icon-btn" title="Trazer para Frente (])"
          onClick={handleBringToFront}
          disabled={!hasSelection}
          onContextMenu={(e) => handleRightClickHelp(e, "Trazer para Frente (])", "Traz as imagens selecionadas para a camada mais alta da prancheta, ficando sobre as outras.")}
        >
          <ArrowUpToLine size={18} strokeWidth={1.75} style={{ opacity: hasSelection ? 1 : 0.4 }} />
        </button>

        <button className="icon-btn" title="Enviar para Trás ([)"
          onClick={handleSendToBack}
          disabled={!hasSelection}
          onContextMenu={(e) => handleRightClickHelp(e, "Enviar para Trás ([)", "Envia as imagens selecionadas para a camada mais baixa da prancheta, ficando atrás das outras.")}
        >
          <ArrowDownToLine size={18} strokeWidth={1.75} style={{ opacity: hasSelection ? 1 : 0.4 }} />
        </button>

        {/* Lixeira */}
        <button className="icon-btn" title="Excluir selecionado (Delete)"
          onClick={handleDeleteSelected}
          disabled={!hasSelection}
          onContextMenu={(e) => handleRightClickHelp(e, "Excluir selecionado", "Remove permanentemente a imagem selecionada da prancheta.")}
        >
          <Trash2 size={18} strokeWidth={1.75} style={{ color: hasSelection ? '#FF3B30' : 'var(--label)', opacity: hasSelection ? 1 : 0.4 }} />
        </button>
 
        {/* Limpar Prancheta */}
        <button className="icon-btn" title="Limpar toda a prancheta"
          onClick={handleClearCanvas}
          onContextMenu={(e) => handleRightClickHelp(e, "Limpar prancheta", "Apaga completamente todas as imagens da prancheta de uma só vez após confirmação.")}
        >
          <Eraser size={18} strokeWidth={1.75} style={{ color: 'var(--label)' }} />
        </button>

        {/* Links */}
        <button className={`icon-btn${showLinksDrawer ? ' is-active' : ''}`} title="Painel de Links & Referências"
          onClick={() => setShowLinksDrawer(d => !d)}
          onContextMenu={(e) => handleRightClickHelp(e, "Painel de Links", "Abre a barra lateral direita contendo a lista de todas as imagens, arquivos, metadados e atalhos rápidos.")}
        >
          <Link size={18} strokeWidth={1.75} />
        </button>

        {/* Cor da prancheta */}
        <div className="color-slot" onContextMenu={(e) => handleRightClickHelp(e, "Cor da Prancheta", "Abre o seletor de cores para alterar a cor de fundo do seu canvas.")}>
          <div className="color-ring" role="button" tabIndex={0}
            onClick={() => setShowColorPicker(s => !s)}
            onKeyDown={e => e.key === 'Enter' && setShowColorPicker(s => !s)}>
            <span className="color-dot" style={{ backgroundColor: artboardColor }} />
          </div>
          {showColorPicker && (
            <div className="color-popover mat">
              <HexColorPicker color={artboardColor} onChange={handleColorChange} />
            </div>
          )}
        </div>

        {/* Botão Preto e Branco (Grayscale) */}
        <button
          className={`icon-btn${isGrayscaleActive ? ' is-active' : ''}`}
          title="Alternar Preto e Branco (Monocromático)"
          disabled={!hasSelection}
          onClick={() => {
            const active = fabricRef.current?.getActiveObject();
            if (active) toggleGrayscale(active);
          }}
          onContextMenu={(e) => handleRightClickHelp(e, "Preto e Branco", "Alterna o filtro monocromático (escala de cinza) na imagem selecionada.")}
          style={{ opacity: hasSelection ? 1 : 0.35, cursor: hasSelection ? 'pointer' : 'not-allowed' }}
        >
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: `1.5px solid ${isGrayscaleActive ? '#FFFFFF' : 'var(--label-2)'}`,
            background: `linear-gradient(135deg, ${isGrayscaleActive ? '#FFFFFF' : 'var(--label-2)'} 50%, transparent 50%)`,
            display: 'inline-block',
            transition: 'all 0.15s ease'
          }} />
        </button>

        <div className="bar-sep" />

        {/* Salvar/Exportar */}
        <div className="save-slot" onContextMenu={(e) => handleRightClickHelp(e, "Salvar & Exportar", "Abre o menu para baixar seu moodboard como PNG, JPG, PDF ou salvar o arquivo aberto em JSON.")}>
          <button
            className={`icon-btn${showSaveMenu ? ' is-active' : ''}`}
            title="Exportar / Salvar"
            onClick={() => { setShowSaveMenu(s => !s); setShowPdfSizes(false); }}
          >
            <Save size={18} strokeWidth={1.75} />
          </button>

          {showSaveMenu && (
            <div className="save-bubbles">
              <button className="bubble-btn" title="Salvar Arquivo Aberto" onClick={handleSaveJSON}>
                <FileJson size={16} strokeWidth={1.75} />
              </button>
              <div style={{ position: 'relative' }}>
                <button className="bubble-btn" title="Exportar PDF"
                  onClick={() => { setShowPdfSizes(s => !s); }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold' }}>PDF</span>
                </button>
                {showPdfSizes && (
                  <div className="pdf-sub mat">
                    {['Original', 'A5','A4','A3','A2'].map(f => (
                      <button key={f} className="pill-btn" onClick={() => handleExportPDF(f)}>{f}</button>
                    ))}
                  </div>
                )}
              </div>
              <button className="bubble-btn" title="Exportar JPG" onClick={handleExportJPG}>
                <span style={{ fontSize: '9px', fontWeight: 'bold' }}>JPG</span>
              </button>
              <button className="bubble-btn" title="Exportar PNG" onClick={handleExportPNG}>
                <span style={{ fontSize: '9px', fontWeight: 'bold' }}>PNG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          PAINEL ESQUERDO — controles da prancheta
          ═══════════════════════════════════════════════ */}
      <div className={`panel-left mat${isUiHidden ? ' ui-hidden' : ''}`}>
        {/* Diminuir */}
        <button
          className="icon-btn"
          title="Diminuir tamanho do canvas"
          onClick={() => scaleSheet(1/1.2)}
          onContextMenu={(e) => handleRightClickHelp(e, "Diminuir Prancheta", "Reduz proporcionalmente o tamanho da largura e altura da prancheta virtual.")}
        >
          <Minus size={15} strokeWidth={2.25} />
        </button>

        {/* Aumentar */}
        <button
          className="icon-btn"
          title="Aumentar tamanho do canvas"
          onClick={() => scaleSheet(1.2)}
          onContextMenu={(e) => handleRightClickHelp(e, "Aumentar Prancheta", "Aumenta proporcionalmente o tamanho da largura e altura da prancheta virtual.")}
        >
          <Plus size={15} strokeWidth={2.25} />
        </button>

        <div className="bar-sep" />

        {/* Texto minimalista indicando o tamanho da prancheta virtual */}
        <span className="canvas-size-text">{virtualW} × {virtualH} px</span>

        <div className="bar-sep" />

        {/* Escolha de Quadro / Prancha */}
        <div className="grid-board-slot" onContextMenu={(e) => handleRightClickHelp(e, "Quadros e Pranchas", "Escolha entre diferentes estilos de quadros milimetrados, como Blueprint, Quadro Negro, Quadro Verde de giz/corte, Papel de Esboço ou Off-White.")}>
          <button
            className={`icon-btn${isBlueprint ? ' is-active' : ''}`}
            title="Escolher Quadro / Prancha"
            onClick={() => setShowGridMenu(s => !s)}
          >
            <Grid size={15} strokeWidth={1.75} style={{ color: isBlueprint ? 'var(--blue)' : 'var(--label-2)' }} />
          </button>
          {showGridMenu && (
            <div className="grid-bubbles">
              <button className={`bubble-btn${gridBoardType === 'off-white' && isBlueprint ? ' is-active' : ''}`} title="Prancha Off-White (Grid)" onClick={() => selectGridBoard('off-white')}>
                <span className="color-dot" style={{ backgroundColor: '#F5F5F5', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)' }} />
              </button>
              <button className={`bubble-btn${gridBoardType === 'sketch-paper' && isBlueprint ? ' is-active' : ''}`} title="Papel Milimetrado (Esboço Creme)" onClick={() => selectGridBoard('sketch-paper')}>
                <span className="color-dot" style={{ backgroundColor: '#F4EBD9', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)' }} />
              </button>
              <button className={`bubble-btn${gridBoardType === 'cutting-green' && isBlueprint ? ' is-active' : ''}`} title="Quadro Verde (Giz / Prancha de Corte)" onClick={() => selectGridBoard('cutting-green')}>
                <span className="color-dot" style={{ backgroundColor: '#0F3A2E', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
              </button>
              <button className={`bubble-btn${gridBoardType === 'chalkboard' && isBlueprint ? ' is-active' : ''}`} title="Quadro Negro (Giz)" onClick={() => selectGridBoard('chalkboard')}>
                <span className="color-dot" style={{ backgroundColor: '#1A1A1A', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
              </button>
              <button className={`bubble-btn${gridBoardType === 'blueprint' && isBlueprint ? ' is-active' : ''}`} title="Quadro Blueprint (Azul Técnico)" onClick={() => selectGridBoard('blueprint')}>
                <span className="color-dot" style={{ backgroundColor: '#0041BA', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          PAINEL DIREITO — zoom de visualização
          ═══════════════════════════════════════════════ */}
      <div className={`panel-right mat${isUiHidden ? ' ui-hidden' : ''}`}>
        <button
          className="icon-btn"
          title={isDark ? 'Modo Dia' : 'Modo Noite'}
          onClick={() => setIsDark(d => !d)}
          onContextMenu={(e) => handleRightClickHelp(e, "Alternar Tema", "Alterna o tema visual da interface entre os modos Claro e Escuro.")}
          style={{ fontSize: '16px' }}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <div className="bar-sep" />
        {/* Botão Maximize reposicionado ANTES do zoom - e chamando handleFitContent */}
        <button
          className="icon-btn"
          title="Magic Zoom"
          onClick={handleFitContent}
          onContextMenu={(e) => handleRightClickHelp(e, "Magic Zoom", "Centraliza todas as imagens na tela e ajusta o zoom automaticamente para enquadrar todo o conteúdo com uma margem confortável.")}
        >
          <Maximize size={15} strokeWidth={1.75} />
        </button>
        <button
          className="icon-btn"
          title="Zoom −"
          onClick={() => handleZoom('out')}
          onContextMenu={(e) => handleRightClickHelp(e, "Zoom Out", "Reduz o zoom de visualização da prancheta.")}
        >
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>
        <button
          className="icon-btn"
          title="Zoom +"
          onClick={() => handleZoom('in')}
          onContextMenu={(e) => handleRightClickHelp(e, "Zoom In", "Aumenta o zoom de visualização da prancheta.")}
        >
          <ZoomIn size={15} strokeWidth={1.75} />
        </button>
        <div className="bar-sep" />
        <span
          className="zoom-value"
          onClick={toggleZoom100}
          role="button"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onContextMenu={(e) => handleRightClickHelp(e, "Alternar Zoom 100%", "Clique para alternar rapidamente entre o nível de zoom de 100% (escala real) e o nível anterior.")}
        >
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>


      {/* ═══════════════════════════════════════════════
          SIDEBAR DESLIZANTE — LINKS ADICIONADOS
          ═══════════════════════════════════════════════ */}
      <LinksDrawer
        show={showLinksDrawer}
        isUiHidden={isUiHidden}
        linksList={linksList}
        onClose={() => setShowLinksDrawer(false)}
        focusObject={focusObject}
        toggleGrayscale={toggleGrayscale}
        onDelete={(ref) => {
          const fc = fabricRef.current;
          if (fc) {
            fc.remove(ref);
            fc.discardActiveObject();
            fc.renderAll();
          }
        }}
      />

      {/* ═══════════════════════════════════════════════
          JANELA DE ONBOARDING (CARROSSEL)
          ═══════════════════════════════════════════════ */}
      <OnboardingModal
        show={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        activeSlide={activeOnboardingSlide}
        setActiveSlide={setActiveOnboardingSlide}
      />
      <ClearConfirmModal
        show={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        onClearWithSave={handleClearConfirmWithSave}
        onClearWithoutSave={handleClearConfirmWithoutSave}
      />

      <MobileWarning isVisible={isMobileWarningVisible} />
    </div>
  );
}
