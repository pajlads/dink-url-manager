import { jsx } from 'hono/jsx'
import { type Context } from 'hono'
import { WEBHOOK_URL_BASE, MAX_IDENTIFIER_LENGTH, MAX_IDENTIFIER_COUNT } from '../constants'
import type { WebhookConfig, IdList } from '../types'

export function homePage(c: Context) {
  return c.render(
    <div>
      <h1>DinkPlugin Webhook Filter</h1>
      <p>
        This service filters Discord webhook notifications from <a href="https://runelite.net/plugin-hub/show/dink">DinkPlugin</a>.
      </p>
      <p>
        You can filter notifications by the player name or their dink account hash (obtained via the <code>::DinkHash</code> in-game command).
        Allowlist mode only <i>accepts</i> notifications where the player name or hash is on the configured list.
        Denylist mode <i>rejects</i> notifications where the player name or hash is on the configured list.
      </p>
      <div class="field">
        <a href="/new" class="button-link">
          <button>Create New Webhook Filter</button>
        </a>
      </div>
      <div class="field">
        <label htmlFor="secret_input" class="label-style">
          Access Existing Configuration
        </label>
        <form onsubmit="handleAccessSubmit(event)" class="form-style">
          <input
            type="text"
            id="secret_input"
            name="secret"
            placeholder="Enter your secret key"
            class="input-style"
          />
          <button type="submit">Go to Settings</button>
        </form>
      </div>
      <script dangerouslySetInnerHTML={{
        __html: `
          function handleAccessSubmit(e) {
            e.preventDefault();
            const secret = document.getElementById('secret_input').value.trim();
            if (secret) {
              window.location.href = '/settings/' + encodeURIComponent(secret);
            }
          }
        `
      }} />
      <h2>How It Works</h2>
      <p>
        1. <strong>Create</strong> a new webhook configuration (generates a secret key).<br />
        2. <strong>Configure</strong> your Discord webhook URL, identifier list (dink hashes and/or player names), and mode (allowlist or denylist).<br />
        3. <strong>Set</strong> the generated webhook URL in your DinkPlugin configuration.<br />
        4. <strong>Filter</strong> incoming webhooks to only forward notifications to Discord that pass the specified configuration; others are silently dropped by this service.
      </p>
      <h2>Security</h2>
      <p>
        Each webhook filter configuration is authenticated by a secret that is shown at creation and never stored in plaintext.
        The secret is used to compute a hash that appears in the webhook URL.
        Only someone with the secret can modify the configuration (and it is virtually impossible to reverse the hash to determine the raw secret).
      </p>
      <p>
        The most secure filter configuration is an allowlist on dink account hashes, as it is exceedingly difficult to guess another player's account hash.
        The easiest-to-bypass filter configuration is a denylist on player names (as the denylisted player could change their name or modify the json payload).
      </p>
      <p>
        The source code for this project can be viewed on <a href="https://github.com/pajlads/dink-url-manager">GitHub</a>.
        You can self-host this <a href="https://developers.cloudflare.com/workers/">Cloudflare Worker</a> for <a href="https://developers.cloudflare.com/workers/platform/pricing/">free</a> if you are uncomfortable with the operators of this service being able to read your webhook configurations.
      </p>
    </div>
  )
}

export function settingsPage(
  c: Context,
  secret: string,
  config: WebhookConfig,
  idListKeys: string
) {
  const webhookUrl = `${WEBHOOK_URL_BASE}/webhook/${config.secret_hash}`

  return c.render(
    <div>
      <h1>Webhook Filter Settings</h1>

      <div class="field">
        <label><strong>Secret Key</strong></label>
        <div class="secret-container">
          <div class="copy-wrapper">
            <div class="secret-wrapper secret-censored-state" id="secret-wrapper">
              <code class="secret-censored">
                ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
              </code>
              <code class="secret-plain" id="secret-text">{secret}</code>
            </div>
            <button class="copy-button" data-copy-target="secret-text" onclick="copyToClipboard('secret-text', this)">
              Copy
            </button>
            <button class="reveal-button" id="reveal-btn" onclick="toggleSecret()">
              Reveal
            </button>
          </div>
        </div>
        <small class="small-error">
          <strong>Treat this key as a password; it is required to modify the configuration below and we cannot provide it if lost.</strong> Click the Reveal button to show the secret. Copy and save it somewhere safe (or bookmark this page).
        </small>
      </div>

      <form method="post" action="/api/settings" onsubmit="return validateIdList()">
        <input type="hidden" name="secret" value={secret} />

        <div class="field">
          <label htmlFor="webhook_url">Discord Webhook URL</label>
          <input
            type="url"
            id="webhook_url"
            name="webhook_url"
            value={config.webhook_url}
            placeholder="https://discord.com/api/webhooks/..."
            required
          />
          <small>
            Enter your Discord channel's webhook URL. You can create a webhook via <code>Channel Settings &rarr; Integrations &rarr; Webhooks &rarr; New Webhook</code>
          </small>
        </div>

        <div class="field">
          <label htmlFor="mode">Filter Mode</label>
          <select id="mode" name="mode">
             <option value="allow" selected={config.mode === 'allow'}>
               Allow matching identifiers (allowlist; more secure)
             </option>
             <option value="deny" selected={config.mode === 'deny'}>
               Deny matching identifiers (denylist; easier)
             </option>
          </select>
           <small>
             <strong>Allow mode:</strong> Forwarded if the player's dink account hash <strong>or</strong> the player name appears in the list (case-insensitive).<br />
             <strong>Deny mode:</strong> Forwarded only if <strong>neither</strong> the player's dink account hash <strong>nor</strong> the player name appears in the list (case-insensitive).
           </small>
        </div>

        <div class="field">
          <label htmlFor="id_list">Identifiers (one per line)</label>
          <textarea
            id="id_list"
            name="id_list"
            rows="6"
            placeholder="abcdef1234567890&#10;John Doe"
            maxlength="65535"
            oninput="updateCharCount(this)"
            onkeydown="handleTabKey(event)"
          >{idListKeys}</textarea>
          <div id="id-list-counter" style="font-size: 0.85rem; color: #666; margin-top: 5px; text-align: right;">
            <span id="current-chars">{idListKeys.length}</span> / 65,535 max
          </div>
          <small class="small-error" style="display: block; margin-top: 8px;">
            <strong>Format:</strong> One identifier per line. Identifier checking is case-insensitive.
            <br />
            You can add comments by prefixing them with <code>#</code>. Comments can be on their own line or after an identifier. Everything after <code>#</code> is ignored.
            <br />
            <em>Example:</em> <code>abcdefg01234567890 # Sam</code> or <code># clan admins</code>
          </small>
        </div>

         <div class="field">
           <button type="submit">Save Settings</button>
           <button type="button" id="delete-button" class="delete-button" disabled title="Clear webhook URL and identifier list to enable deletion">
             Delete Configuration
           </button>
         </div>
      </form>

      <h2>Webhook URL</h2>
      <div class="webhook-url-container">
        <div class="copy-wrapper">
          <code class="webhook-url" id="webhook-text" style="flex: 1;">{webhookUrl}</code>
          <button class="copy-button" data-copy-target="webhook-text" onclick="copyToClipboard('webhook-text', this)">
            Copy
          </button>
        </div>
      </div>
      <p>
        <small>Use this URL as your webhook in DinkPlugin. This URL will not work for other Discord notification plugins, only Dink.</small>
      </p>

      <p>
        <a href="/" class="btn-secondary back-link">← Back to Home</a>
      </p>

      <script dangerouslySetInnerHTML={{
        __html: `
        function updateCharCount(textarea) {
          document.getElementById('current-chars').textContent = textarea.value.length;
        }
        function handleTabKey(e) {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.substring(0, start) + '\\n' + e.target.value.substring(end);
            e.target.selectionStart = e.target.selectionEnd = start + 1;
            updateCharCount(e.target);
          }
        }
        function validateIdList() {
          const textarea = document.getElementById('id_list');
          const lines = textarea.value.split('\\n');
          const MAX_IDENTIFIER_LENGTH = ${MAX_IDENTIFIER_LENGTH};
          const MAX_IDENTIFIER_COUNT = ${MAX_IDENTIFIER_COUNT};

          let identifierCount = 0;
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Strip comment after #
            const hashIndex = line.indexOf('#');
            if (hashIndex !== -1) {
              line = line.substring(0, hashIndex);
            }
            line = line.trim();
            if (line) {
              identifierCount++;
              if (line.length > MAX_IDENTIFIER_LENGTH) {
                alert('Line ' + (i + 1) + ' exceeds ' + MAX_IDENTIFIER_LENGTH + ' characters after removing comment: ' + line.substring(0, 32) + '...');
                return false;
              }
            }
          }

          if (identifierCount > MAX_IDENTIFIER_COUNT) {
            alert('Too many identifiers. Maximum is ' + MAX_IDENTIFIER_COUNT + ' (found ' + identifierCount + ')');
            return false;
          }
          return true;
        }
        async function copyToClipboard(elementId, button) {
          const element = document.getElementById(elementId);
          if (!element) return;

          try {
            await navigator.clipboard.writeText(element.textContent);
            button.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
              button.textContent = 'Copy';
            button.classList.remove('copied');
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
            button.textContent = 'Failed';
            setTimeout(() => {
              button.textContent = 'Copy';
            }, 2000);
          }
        }
        function toggleSecret() {
          const wrapper = document.getElementById('secret-wrapper');
          const btn = document.getElementById('reveal-btn');
          if (wrapper.classList.contains('secret-revealed')) {
            wrapper.classList.remove('secret-revealed');
            wrapper.classList.add('secret-censored-state');
            btn.textContent = 'Reveal';
          } else {
            wrapper.classList.remove('secret-censored-state');
            wrapper.classList.add('secret-revealed');
            btn.textContent = 'Hide';
          }
        }

        // Delete button functionality
        function isIdListEmpty(value) {
          if (!value || value.trim() === '') return true;
          const lines = value.split('\\n');
          for (let line of lines) {
            // Strip comments
            const hashIndex = line.indexOf('#');
            if (hashIndex !== -1) {
              line = line.substring(0, hashIndex);
            }
            line = line.trim();
            if (line !== '') return false;
          }
          return true;
        }

        function updateDeleteButtonState() {
          const webhookUrlInput = document.getElementById('webhook_url');
          const idListTextarea = document.getElementById('id_list');
          const deleteButton = document.getElementById('delete-button');

          const webhookEmpty = !webhookUrlInput.value || webhookUrlInput.value.trim() === '';
          const idListEmpty = isIdListEmpty(idListTextarea.value);

          if (webhookEmpty && idListEmpty) {
            deleteButton.disabled = false;
            deleteButton.title = 'Delete this webhook configuration';
          } else {
            deleteButton.disabled = true;
            deleteButton.title = 'Clear webhook URL and identifier list to enable deletion';
          }
        }

        async function handleDelete() {
          const confirmation = window.prompt('Type "delete" to confirm deletion of this webhook configuration.\\n\\nThis is a destructive action that cannot be undone.\\nNote: this will not kill the underlying Discord webhook URL.');
          if (confirmation.toLowerCase() !== 'delete') {
            return;
          }

          const secret = document.getElementById('secret-text').textContent.trim();

          try {
            const response = await fetch('/api/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ secret })
            });

            if (response.ok) {
              alert('Configuration deleted successfully. You will be redirected to the home page.');
              window.location.href = '/';
            } else {
              const data = await response.json();
              alert('Failed to delete configuration: ' + (data.error || 'Unknown error'));
            }
          } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete configuration: Network error');
          }
        }

        // Attach event listeners
        document.addEventListener("DOMContentLoaded", (e) => {
          const webhookUrlInput = document.getElementById('webhook_url');
          const idListTextarea = document.getElementById('id_list');
          const deleteButton = document.getElementById('delete-button');

          webhookUrlInput.addEventListener('input', updateDeleteButtonState);
          webhookUrlInput.addEventListener('change', updateDeleteButtonState);
          idListTextarea.addEventListener('input', updateDeleteButtonState);
          idListTextarea.addEventListener('change', updateDeleteButtonState);
          deleteButton.addEventListener('click', handleDelete);

          updateDeleteButtonState();
        });
        `
      }} />
    </div>
  )
}
