import { X, ImagePlus, Pointer, Clipboard, Minus, Plus, Grid, Sun, LayoutGrid, Maximize, Link, Contrast, Save, FileText, FileJson, ExternalLink, Coffee } from 'lucide-react';

export default function OnboardingModal({ 
  show, 
  onClose, 
  activeSlide, 
  setActiveSlide 
}) {
  if (!show) return null;

  const heights = [390, 490, 460, 620, 460, 460, 440];

  return (
    <div className="onboarding-overlay" onClick={onClose}>
      <div 
        className="onboarding-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ height: `${heights[activeSlide]}px` }}
      >
        <button className="onboarding-close-btn" onClick={onClose} title="Fechar Onboarding">
          <X size={16} strokeWidth={2} />
        </button>

        <div className="onboarding-content-wrap">
          <div 
            className="onboarding-slides-track"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {/* Slide 1: Apresentação */}
            <div className="onboarding-slide">
              <div className="onboarding-icon-banner">
                <span className="onboarding-logo-pill">V2</span>
                <div className="onboarding-app-logo">
                  <span className="app-title-bold" style={{ fontSize: '32px' }}>Artero</span>
                  <span className="app-title-beta" style={{ fontSize: '18px', marginLeft: '6px' }}>Open Beta</span>
                </div>
              </div>
              <h2 className="onboarding-title">Seu Mural Aberto de Inspirações</h2>
              <p className="onboarding-desc">
                O Artero é o painel mais simples do mundo para colagem de referências e criação de moodboards. Ele oferece uma tela infinita e livre de distrações, projetada para manter você focado no seu fluxo criativo.
              </p>
              <p className="onboarding-desc" style={{ marginTop: '-12px', fontSize: '13px', color: 'var(--label-2)' }}>
                Clique nas bolinhas abaixo ou em Avançar para descobrir como interagir com o canvas.
              </p>
            </div>

            {/* Slide 2: Importação & Formatos */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Importação & Formatos</h2>
              <div className="onboarding-features-list" style={{ gap: '14px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <ImagePlus size={18} />
                  </div>
                  <div className="feature-details" style={{ width: '100%' }}>
                    <span className="feature-name">Importar do Computador</span>
                    <span className="feature-desc">Clique no botão de adicionar imagem no painel inferior para abrir o seletor local.</span>
                    
                    <div className="format-badges-grid">
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>PNG</span>
                      </div>
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>JPG</span>
                      </div>
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>GIF</span>
                      </div>
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>WEBP</span>
                      </div>
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>SVG</span>
                      </div>
                      <div className="format-badge">
                        <FileText size={16} />
                        <span>HEIC</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Pointer size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Arrastar & Soltar Global</span>
                    <span className="feature-desc">Solte qualquer foto direto do seu computador ou navegador na tela do Artero.</span>
                  </div>
                </div>
                
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Clipboard size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Colagem do Clipboard</span>
                    <span className="feature-desc">Copie imagens da internet (ou dê Print Screen) e simplesmente aperte Ctrl+V no Artero.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 3: Prancheta & Funções */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Prancheta & Funções</h2>
              <div className="onboarding-features-list" style={{ gap: '14px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon" style={{ display: 'flex', gap: '3px', padding: '4px' }}>
                    <Minus size={11} strokeWidth={2.5} />
                    <Plus size={11} strokeWidth={2.5} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Redimensionar Prancheta (+ / -)</span>
                    <span className="feature-desc">Use os botões de mais (+) e menos (-) no painel esquerdo para expandir ou encolher a área de exportação.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Grid size={18} />
                  </div>
                  <div className="feature-details" style={{ width: '100%' }}>
                    <span className="feature-name">Quadros e Grades Técnicas</span>
                    <span className="feature-desc">Escolha o estilo de prancheta ideal clicando no menu do botão Grid:</span>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--fill-1)', padding: '5px 10px', borderRadius: '14px', fontSize: '11px', border: '1px solid var(--separator)', color: 'var(--label)' }}>
                        <span style={{ backgroundColor: '#0041BA', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
                        <strong>Blueprint</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--fill-1)', padding: '5px 10px', borderRadius: '14px', fontSize: '11px', border: '1px solid var(--separator)', color: 'var(--label)' }}>
                        <span style={{ backgroundColor: '#1A1A1A', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
                        <strong>Giz Negro</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--fill-1)', padding: '5px 10px', borderRadius: '14px', fontSize: '11px', border: '1px solid var(--separator)', color: 'var(--label)' }}>
                        <span style={{ backgroundColor: '#0F3A2E', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
                        <strong>Giz/Corte Verde</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--fill-1)', padding: '5px 10px', borderRadius: '14px', fontSize: '11px', border: '1px solid var(--separator)', color: 'var(--label)' }}>
                        <span style={{ backgroundColor: '#F4EBD9', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)' }} />
                        <strong>Papel Creme</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--fill-1)', padding: '5px 10px', borderRadius: '14px', fontSize: '11px', border: '1px solid var(--separator)', color: 'var(--label)' }}>
                        <span style={{ backgroundColor: '#F5F5F5', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)' }} />
                        <strong>Off-White</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Sun size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Modo Dia & Noite (Claro/Escuro)</span>
                    <span className="feature-desc">Alterne entre o tema Claro e o Tema Escuro (Night Mode) clicando no botão de Sol/Lua no canto inferior direito.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 4: Atalhos de Mouse & Teclado */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Atalhos de Mouse & Teclado</h2>
              
              <h3 className="onboarding-subtitle" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--blue)', letterSpacing: '0.5px', marginBottom: '4px' }}>Atalhos de mouse</h3>
              <div className="onboarding-features-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Mouse Dir</span>
                  <div className="feature-details">
                    <span className="feature-name">Mão (Pan)</span>
                    <span className="feature-desc">Arraste a tela segurando o botão direito do mouse.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Scroll</span>
                  <div className="feature-details">
                    <span className="feature-name">Zoom Contínuo</span>
                    <span className="feature-desc">Use a roda do mouse para aproximar ou afastar a tela.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">2 Cliques</span>
                  <div className="feature-details">
                    <span className="feature-name">Pan por Clique</span>
                    <span className="feature-desc">Dois cliques no fundo para mover o canvas sem atalhos.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Drag</span>
                  <div className="feature-details">
                    <span className="feature-name">Seleção por Janela</span>
                    <span className="feature-desc">Arraste o mouse no fundo com botão esquerdo para selecionar.</span>
                  </div>
                </div>
              </div>

              <h3 className="onboarding-subtitle" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--blue)', letterSpacing: '0.5px', marginTop: '6px', marginBottom: '4px' }}>Atalhos de teclado</h3>
              <div className="onboarding-features-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">V / H</span>
                  <div className="feature-details">
                    <span className="feature-name">Seleção / Mão</span>
                    <span className="feature-desc">Alterne entre Seta (V) e Mãozinha de Pan (H).</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Espaço</span>
                  <div className="feature-details">
                    <span className="feature-name">Mão Temporária</span>
                    <span className="feature-desc">Segure Barra de Espaço para Pan rápido e solte para voltar.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Del / Back</span>
                  <div className="feature-details">
                    <span className="feature-name">Deletar Imagem</span>
                    <span className="feature-desc">Apague a imagem selecionada usando as teclas Delete ou Backspace.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">Ctrl+Z/Y</span>
                  <div className="feature-details">
                    <span className="feature-name">Desfazer/Refazer</span>
                    <span className="feature-desc">Desfaça ou refaça suas últimas alterações no canvas.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start', margin: 0 }}>
                  <span className="feature-kbd-icon">[ / ]</span>
                  <div className="feature-details">
                    <span className="feature-name">Z-Index (Camadas)</span>
                    <span className="feature-desc">Use os colchetes para enviar a imagem selecionada para trás ou trazer para frente.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 5: Info & Organização */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Info & Organização</h2>
              <div className="onboarding-features-list" style={{ gap: '14px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <LayoutGrid size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Auto-organização (Magic Grid)</span>
                    <span className="feature-desc">Organize todas as imagens em fileiras alinhadas instantaneamente com um clique.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Maximize size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Enquadrar Tudo (Magic Zoom)</span>
                    <span className="feature-desc">Centraliza e ajusta o zoom automaticamente para enquadrar todas as imagens na tela com margem simétrica.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Link size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Painel de Links & Referências</span>
                    <span className="feature-desc">Acesse metadados, links de origem das imagens e gerencie itens diretamente pela Sidebar.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Contrast size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Seleção Preto e Branco (Monocromático)</span>
                    <span className="feature-desc">Aplique filtros preto e branco nas imagens selecionadas com o botão de contraste no painel inferior.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 6: Salvar & Exportar */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Salvar & Exportar</h2>
              <div className="onboarding-features-list" style={{ gap: '14px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Save size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Auto-salvamento Resiliente</span>
                    <span className="feature-desc">Seu trabalho é salvo localmente em cache de forma automática a cada alteração.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <ImagePlus size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Exportar Imagens (PNG / JPG)</span>
                    <span className="feature-desc">Gere um arquivo de imagem da prancheta inteira com fundo transparente ou colorido.</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <FileText size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Exportar PDF Vetorial</span>
                    <span className="feature-desc">Gere PDFs de alta qualidade no tamanho original da prancheta ou em formatos padrão (A2 a A5).</span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <FileJson size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Salvar em Arquivo Editável (JSON)</span>
                    <span className="feature-desc">Exporte ou importe um arquivo `.json` contendo todas as referências do seu moodboard para trabalhar depois.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 7: Desenvolvedores & Ecossistema */}
            <div className="onboarding-slide">
              <h2 className="onboarding-title">Desenvolvedores & Ecossistema</h2>
              <div className="onboarding-features-list" style={{ gap: '14px' }}>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🇧🇷
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Software Livre & Brasileiro</span>
                    <span className="feature-desc">
                      O Artero open beta é um projeto aberto (open source) de uma empresa brasileira chamada <strong>Pragmatas Serviços Criativos</strong>.
                    </span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <LayoutGrid size={18} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Pacote TRAMA</span>
                    <span className="feature-desc">
                      O Artero Open Beta é parte da TRAMA (Tecnologias e Recursos Abertos para Mídias e Artes), um conjunto de websoftwares que serão criados e distribuídos pensados na realidade e soberania digital brasileira.
                    </span>
                  </div>
                </div>
                <div className="onboarding-feature-item" style={{ alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <Coffee size={18} style={{ color: '#C88B55' }} />
                  </div>
                  <div className="feature-details">
                    <span className="feature-name">Apoie o Desenvolvimento</span>
                    <span className="feature-desc">
                      Pague um cafezinho para a equipe! <a href="#apoie" onClick={(e) => e.preventDefault()} style={{ color: 'var(--blue)', textDecoration: 'underline', fontWeight: '500' }}>Fazer uma contribuição</a>
                    </span>
                  </div>
                </div>
              </div>

              {/* Assinatura discreta centralizada no respiro */}
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: '16px' }}>
                <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--label-3)', opacity: 0.8, letterSpacing: '-0.2px' }}>
                  Desenvolvido por <strong>João Conrado</strong> e revisado por <strong>João Tarran</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {heights.map((_, i) => (
              <span 
                key={i} 
                className={`onboarding-dot${activeSlide === i ? ' is-active' : ''}`}
                onClick={() => setActiveSlide(i)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="onboarding-nav-btn text" 
              onClick={onClose}
            >
              Pular
            </button>
            <button 
              className="onboarding-nav-btn fill accent" 
              onClick={() => {
                if (activeSlide === heights.length - 1) {
                  onClose();
                } else {
                  setActiveSlide(activeSlide + 1);
                }
              }}
            >
              {activeSlide === heights.length - 1 ? 'Começar' : 'Avançar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
