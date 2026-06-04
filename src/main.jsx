import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode removido: causa dupla inicialização do canvas Fabric.js em dev,
// o que destrói o canvas antes de ele ser usado corretamente.
createRoot(document.getElementById('root')).render(<App />)
