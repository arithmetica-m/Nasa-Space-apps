import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { EarthConsole } from './components/library/EarthConsole';

// ?earth opens the Mission Control console (the only place the medical library can be changed).
const earth = new URLSearchParams(location.search).has('earth');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {earth ? <EarthConsole /> : <App />}
  </StrictMode>,
);
