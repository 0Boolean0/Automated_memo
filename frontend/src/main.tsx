/**
 * Application entry point.
 * React mounts into the <div id="root"> in index.html.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      BrowserRouter enables client-side routing.
      All <Link>, <NavLink>, and useNavigate() calls work inside this.
    */}
    <BrowserRouter>
      <App />
      {/*
        Toaster renders toast notifications.
        Positioned at top-right on desktop, bottom-center on mobile.
      */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '14px',
            maxWidth: '400px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: 'white' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
