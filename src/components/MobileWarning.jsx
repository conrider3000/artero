export default function MobileWarning({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="onboarding-overlay" style={{ zIndex: 9999 }}>
      <div className="exit-modal mat" style={{ textAlign: 'center', padding: '40px' }}>
        <h2 className="exit-modal-title">Aviso de Compatibilidade</h2>
        <p className="exit-modal-desc" style={{ marginBottom: 0 }}>
          O Artero foi projetado para uso em computadores (desktop/notebook). Para ter acesso a todas as ferramentas e uma melhor experiência de prancheta, acesse através de uma tela maior.
        </p>
      </div>
    </div>
  );
}
