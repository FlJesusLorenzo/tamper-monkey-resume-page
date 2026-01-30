// ==UserScript==
// @name         Resumir Página Web IA
// @namespace    http://tampermonkey.net/
// @version      2026-01-30
// @description  Resume páginas web usando Gemini AI
// @author       Jesus Lorenzo
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=factorlibre.com
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @resource     ai_prompt https://github.com/FlJesusLorenzo/tamper-monkey-resume-page/raw/refs/heads/main/main/prompts/prompt.txt
// @connect      generativelanguage.googleapis.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @updateURL    https://github.com/FlJesusLorenzo/tamper-monkey-resume-page/raw/refs/heads/main/main/script.user.js
// @downloadURL  https://github.com/FlJesusLorenzo/tamper-monkey-resume-page/raw/refs/heads/main/main/script.user.js
// ==/UserScript==

(function () {
  "use strict";

  GM_addStyle(`
    .ia-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .ia-modal-overlay.visible { opacity: 1; }

    .ia-modal {
      background: #1a1a1a;
      color: #e5e5e5;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.2s ease;
    }
    .ia-modal-overlay.visible .ia-modal { transform: scale(1); }

    .ia-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #333;
    }
    .ia-modal-title {
      font-family: system-ui, sans-serif;
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }
    .ia-modal-close {
      background: none;
      border: none;
      color: #888;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.15s;
    }
    .ia-modal-close:hover { color: #fff; }

    .ia-modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    .ia-modal-result {
      width: 100%;
      min-height: 200px;
      background: #111;
      border: 1px solid #333;
      border-radius: 8px;
      color: #e5e5e5;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 12px;
      resize: vertical;
    }
    .ia-modal-result:disabled {
      opacity: 0.7;
    }

    .ia-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid #333;
    }
    .ia-modal-btn {
      font-family: system-ui, sans-serif;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .ia-modal-btn-secondary {
      background: #333;
      color: #e5e5e5;
    }
    .ia-modal-btn-secondary:hover { background: #444; }
    .ia-modal-btn-primary {
      background: #10b981;
      color: #fff;
    }
    .ia-modal-btn-primary:hover { background: #059669; }
    .ia-modal-btn.cargando {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ia-btn-trigger {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      padding: 8px 12px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      transition: opacity 0.2s, background 0.2s;
    }
    .ia-btn-trigger:hover { background: #222; }
  `);

  if (!GM_getValue("api_key")) {
    const value = prompt("Dame la clave API de Google");
    if (value) GM_setValue("api_key", value);
  }

  function resumeWithIa() {
    const pregunta = prompt("¿Qué quieres resumir de la página?");
    if (!pregunta) return;

    const apiKey = GM_getValue("api_key", "");
    if (!apiKey) {
      alert("No hay API key configurada");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "ia-modal-overlay";
    overlay.innerHTML = `
      <div class="ia-modal">
        <div class="ia-modal-header">
          <h2 class="ia-modal-title">Resumen IA</h2>
          <button class="ia-modal-close">&times;</button>
        </div>
        <div class="ia-modal-body">
          <textarea class="ia-modal-result" placeholder="Generando resumen..."></textarea>
        </div>
        <div class="ia-modal-footer">
          <button class="ia-modal-btn ia-modal-btn-secondary" data-action="copy">Copiar</button>
          <button class="ia-modal-btn ia-modal-btn-primary" data-action="close">Cerrar</button>
        </div>
      </div>
    `;

    const resultElement = overlay.querySelector(".ia-modal-result");
    const generateBtn = overlay.querySelector('[data-action="copy"]');

    const close = () => {
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector(".ia-modal-close").addEventListener("click", close);
    overlay.querySelector('[data-action="close"]').addEventListener("click", close);
    overlay.querySelector('[data-action="copy"]').addEventListener("click", () => {
      if (resultElement.value) {
        navigator.clipboard.writeText(resultElement.value);
        const btn = overlay.querySelector('[data-action="copy"]');
        const originalText = btn.textContent;
        btn.textContent = "¡Copiado!";
        setTimeout(() => (btn.textContent = originalText), 1500);
      }
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));

    const pageContent = document.body.textContent.replace(/\s+/g, " ").trim();
    const promptInfo = {
      pregunta: pregunta,
      contenido: pageContent,
    };

    const dummyButton = document.createElement("button");

    generateIADescription(
      apiKey,
      resultElement,
      dummyButton,
      null,
      promptInfo
    );
  }

  // Crear botón flotante
  const button = document.createElement("button");
  button.className = "ia-btn-trigger";
  button.textContent = "Resumir con IA";
  button.addEventListener("click", resumeWithIa);
  document.body.appendChild(button);
})();
