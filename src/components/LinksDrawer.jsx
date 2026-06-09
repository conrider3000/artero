import { X, ExternalLink, Info, Trash2 } from 'lucide-react';

export default function LinksDrawer({
  show,
  isUiHidden,
  linksList,
  onClose,
  focusObject,
  toggleGrayscale,
  onDelete
}) {
  if (!show) return null;

  return (
    <div className={`links-drawer mat${isUiHidden ? ' ui-hidden' : ''}`}>
      <div className="links-drawer-header">
        <span className="links-drawer-title">Links & Arquivos ({linksList.length})</span>
        <button className="links-drawer-close" onClick={onClose}>
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
                  onClick={() => toggleGrayscale(item.ref)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: `1.2px solid ${item.ref.get('isGrayscale') ? 'var(--blue)' : 'var(--label-2)'}`,
                    background: `linear-gradient(135deg, ${item.ref.get('isGrayscale') ? 'var(--blue)' : 'var(--label-2)'} 50%, transparent 50%)`,
                    display: 'inline-block',
                    transition: 'all 0.15s ease'
                  }} />
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
                  onClick={() => onDelete(item.ref)}>
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
