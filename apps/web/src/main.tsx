import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/base.css';
import { App } from './App';
import { Gallery } from './gallery/Gallery';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const isGallery = window.location.pathname.startsWith('/gallery');

createRoot(root).render(<StrictMode>{isGallery ? <Gallery /> : <App />}</StrictMode>);
