// Punto de entrada: registra los componentes compartidos de la página.
import { renderSiteHeader } from './components/header.js';
import { renderSiteHero } from './components/hero.js';
import { renderNotice } from './components/notice.js';
import { loadComponents } from './shared/component-loader.js';

loadComponents([
  { id: 'header', render: renderSiteHeader },
  { id: 'notice', render: renderNotice, optional: true },
  { id: 'hero', render: renderSiteHero },
]);
