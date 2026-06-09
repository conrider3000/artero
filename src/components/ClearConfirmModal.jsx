import { X, FileJson } from 'lucide-react';

export default function ClearConfirmModal({ show, onClose, onClearWithSave, onClearWithoutSave }) {
  if (!show) return null;

  return (
    <div className="onboarding-overlay" onClick={onClose}>
      <div className="exit-modal mat" onClick={(e) => e.stopPropagation()}>
        <button className="onboarding-close-btn" onClick={onClose} title="Cancelar">
          <X size={16} strokeWidth={2} />
        </button>
        
        <h2 className="exit-modal-title">Limpar toda a Prancheta?</h2>
        <p className="exit-modal-desc">
          Deseja salvar suas referências em um arquivo editável (.json) de backup antes de apagar tudo?
        </p>
        
        <div className="exit-modal-buttons">
          <button className="exit-btn save" onClick={onClearWithSave}>
            <FileJson size={16} strokeWidth={2} style={{ marginRight: '6px' }} />
            Salvar JSON e Limpar
          </button>
          <button className="exit-btn discard" onClick={onClearWithoutSave}>
            Limpar sem Salvar
          </button>
          <button className="exit-btn cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
