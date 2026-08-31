import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AnonymousImagesProvider } from './lib/asset-mode'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnonymousImagesProvider>
      <App />
    </AnonymousImagesProvider>
  </StrictMode>
)
