import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App.tsx';
import '../src/index.css';

// Ensure the local storage sets active view to restaurant_portal when loaded in restaurant-panel
if (typeof window !== 'undefined') {
  localStorage.setItem('direct_last_active_view', 'restaurant_portal');
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
