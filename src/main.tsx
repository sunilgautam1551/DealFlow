import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from './App';
import { fakeServer } from './api';
import { createAppStore } from './app/store';
import './styles/global.css';

const store = createAppStore({ api: fakeServer, simulator: fakeServer });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
