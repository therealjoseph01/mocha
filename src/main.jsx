import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const el = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// Pre-rendered HTML ships with the build; hydrate it. In dev, render fresh.
if (el.hasChildNodes()) hydrateRoot(el, app);
else createRoot(el).render(app);
