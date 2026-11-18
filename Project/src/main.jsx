// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'ol/ol.css';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';
import { loadRegionGeometry } from './loaders/geometry';

// Start fetching the geometry before React renders;
// MapView receives the same cached promise.
loadRegionGeometry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
