import { css } from 'hono/css'

export const globalStyles = css`
  :-hono-global {
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 65em;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }

    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    }

    h1 {
      color: #c71585;
      margin-bottom: 20px;
      font-size: 2rem;
    }

    h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.3rem;
    }

    p {
      margin-bottom: 15px;
    }

    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
      color: #e91e63;
    }

    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.85em;
    }

    input[type="text"],
    input[type="url"],
    textarea,
    select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin: 5px 0 15px;
      font-size: 1rem;
    }

    input[type="text"]:focus,
    input[type="url"]:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: #c71585;
      box-shadow: 0 0 0 2px rgba(199, 21, 133, 0.2);
    }

    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }

    textarea {
      resize: vertical;
      min-height: 100px;
      font-family: monospace;
    }

    a {
      color: #c71585;
    }

    a:hover {
      color: #a0126a;
    }

    button {
      background: #c71585;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }

    button:hover {
      background: #a0126a;
    }

    .btn-secondary {
      background: #f8f9fa;
      color: #333;
      border: 1px solid #ddd;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      display: inline-block;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: #e9ecef;
      border-color: #ccc;
    }

    small {
      display: block;
      color: #666;
      margin-top: 5px;
      font-size: 0.85rem;
    }

    .field {
      margin-bottom: 20px;
    }

    .webhook-url {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      word-break: break-all;
      margin: 10px 0;
      border: 1px solid #e9ecef;
      display: block;
    }

    .alert {
      padding: 12px;
      border-radius: 4px;
      margin: 15px 0;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .hidden {
      display: none;
    }

    .secret-wrapper {
      display: block;
      position: relative;
      width: 100%;
    }

    .secret-censored,
    .secret-plain {
      font-family: monospace;
      display: block;
      padding: 10px;
      border-radius: 4px;
      max-width: 100%;
      box-sizing: border-box;
      width: 100%;
      word-break: break-all;
      font-size: 0.75rem;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
    }

    .secret-wrapper.secret-censored-state .secret-censored {
      display: block;
    }

    .secret-wrapper.secret-censored-state .secret-plain {
      display: none;
    }

    .secret-wrapper.secret-revealed .secret-censored {
      display: none;
    }

    .secret-wrapper.secret-revealed .secret-plain {
      display: block;
    }

    .button-link {
      text-decoration: none;
      margin-right: 10px;
    }

    .label-style {
      font-weight: 500;
      margin-bottom: 5px;
      display: block;
    }

    .form-style {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .input-style {
      flex: 1;
      margin: 0 !important;
    }

    .secret-container {
      margin-bottom: 10px;
    }

    .webhook-url-container {
      margin-bottom: 10px;
    }

    .copy-button {
      background: #6c757d;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-left: 8px;
      transition: background 0.2s;
      min-width: 84px;
      min-height: 40px;
    }

    .copy-button:hover {
      background: #5a6268;
    }

    .copy-button.copied {
      background: #28a745;
    }

    .reveal-button {
      background: #17a2b8;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-left: 8px;
      transition: background 0.2s;
      min-width: 84px;
      min-height: 40px;
    }

    .reveal-button:hover {
      background: #138496;
    }

    .delete-button {
      background: #dc3545;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
      margin-left: 10px;
    }

    .delete-button:hover {
      background: #c82333;
    }

    .delete-button:disabled {
      background: #e0e0e0;
      color: #999;
      cursor: not-allowed;
    }

    .copy-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .back-link {
      text-decoration: none;
      display: inline-block;
      margin-top: 10px;
    }

    .small-error {
      color: #721c24;
    }
  }
`
