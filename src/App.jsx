import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  ImagePlus, MousePointer2, ZoomIn, ZoomOut, Save, X,
  ExternalLink, Download, FileText, Info, FileJson,
  Lock, Unlock, Maximize2, Minus, Plus, LayoutGrid
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { jsPDF } from 'jspdf';
import './App.css';

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

  // ── Sincroniza refs ───────────────────────────────────────────────────────
  useEffect(() => { virtualWRef.current = virtualW; }, [virtualW]);
  useEffect(() => { virtualHRef.current = virtualH; }, [virtualH]);

  // ── Aplica tema ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

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

    // Centraliza inicial
    const z = centerAndFit();
    setZoomLevel(z);

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
      // Zoom mínimo permitindo visualizar a prancheta de longe
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

    // ── Drop de imagem ────────────────────────────────────────────────────
    const placeImg = (url, name, type = 'image/web', size = null) => {
      fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
        if (handleImageLoadedRef.current) {
          handleImageLoadedRef.current(img, name, type, size);
        }
      }).catch(console.error);
    };

    const onDrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length) {
        const f = e.dataTransfer.files[0];
        if (f.type.startsWith('image/')) {
          const r = new FileReader();
          r.onload = (ev) => placeImg(ev.target.result, f.name, f.type, f.size);
          r.readAsDataURL(f);
          return;
        }
      }
      const url = e.dataTransfer.getData('url')
        || e.dataTransfer.getData('text/uri-list')
        || e.dataTransfer.getData('text/plain');
      if (url) { placeImg(url, url, 'image/web'); return; }
      const html = e.dataTransfer.getData('text/html');
      if (html) {
        const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
        if (img?.src) placeImg(img.src, img.src, 'image/web');
      }
    };

    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('drop', onDrop);
      fc.dispose();
    };
  }, [centerAndFit]); // roda UMA vez e sincroniza com a função centerAndFit

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
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        fabric.FabricImage.fromURL(ev.target.result).then((img) => {
          handleImageLoaded(img, file.name, file.type, file.size);
        });
      };
      reader.readAsDataURL(file);
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

  const handleZoom = (factor) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const w = virtualWRef.current, h = virtualHRef.current;
    // zoom mínimo permitindo ver a prancheta inteira
    const minZ = Math.min((window.innerWidth - 80) / w, (window.innerHeight - 130) / h) * 0.1;
    const z = Math.max(minZ, Math.min(20, fc.getZoom() * factor));
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;

    fc.zoomToPoint({ x: cx, y: cy }, z);
    setZoomLevel(z);
  };

  const getArtboardDataURL = () => {
    const fc = fabricRef.current;
    if (!fc) return null;
    const active = fc.getActiveObject();
    fc.discardActiveObject();

    // Temporariamente aplica a cor no fundo do canvas para que a imagem exportada não fique transparente
    const origBg = fc.backgroundColor;
    fc.backgroundColor = artboardColor;

    // A prancheta virtual está em (0,0) nas coordenadas do mundo, então exportamos a partir daí.
    const data = fc.toDataURL({
      format: 'png',
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
    const data = getArtboardDataURL();
    if (!data) return;
    Object.assign(document.createElement('a'), {
      download: `artero-${Date.now()}.png`, href: data,
    }).click();
    setShowSaveMenu(false);
  };

  const handleExportPDF = (fmt = 'a4') => {
    const data = getArtboardDataURL();
    if (!data) return;
    const doc = new jsPDF({
      orientation: sheetW > sheetH ? 'landscape' : 'portrait',
      unit: 'mm', format: fmt.toLowerCase(),
    });
    doc.addImage(data, 'PNG', 0, 0,
      doc.internal.pageSize.getWidth(),
      doc.internal.pageSize.getHeight()
    );
    doc.save(`artero-${fmt}-${Date.now()}.pdf`);
    setShowPdfSizes(false);
    setShowSaveMenu(false);
  };

  const handleSaveJSON = () => {
    if (!fabricRef.current) return;
    const json = fabricRef.current.toJSON(['meta']);
    json.sheetSize = { width: virtualW, height: virtualH };
    json.artboardColor = artboardColor;
    const a = document.createElement('a');
    a.download = `artero-${Date.now()}.json`;
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
    a.click();
    setShowSaveMenu(false);
  };

  const getMeta = () =>
    fabricRef.current?.getObjects().filter(o => o.get('meta')).map(o => o.get('meta')) ?? [];

  // ════════════════════════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-root" style={{ backgroundColor: artboardColor }}>

      {/* Canvas Fabric.js */}
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {/* ── Botão aparência – canto superior esquerdo ── */}
      <button
        className="btn-appearance mat"
        title={isDark ? 'Modo Dia' : 'Modo Noite'}
        onClick={() => setIsDark(d => !d)}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

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
        <button className="icon-btn" title="Zoom −" onClick={() => handleZoom(1/1.15)}>
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>
        <button className="icon-btn" title="Zoom +" onClick={() => handleZoom(1.15)}>
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

    </div>
  );
}
