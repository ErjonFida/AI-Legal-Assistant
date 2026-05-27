// CSRF Token Helper
function getCsrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? m[1] : '';
}

// Auth Mode Toggle
let isLoginMode = true;
function showAuthMode(mode) {
    const form = document.getElementById('auth-form');
    if (!form) return;
    const isLogin = mode === 'login';
    isLoginMode = isLogin;
    form.setAttribute('hx-post', isLogin ? '/login' : '/register');
    document.getElementById('auth-submit-btn').textContent = isLogin ? 'Sign In' : 'Create Account';
    document.getElementById('register-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('reg-confirm-group').style.display = isLogin ? 'none' : 'block';
    document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
    document.getElementById('tab-register-btn').classList.toggle('active', !isLogin);
    ['reg-firstname', 'reg-lastname'].forEach(id => {
        const el = document.getElementById(id);
        isLogin ? el.removeAttribute('required') : el.setAttribute('required', 'true');
    });
    document.getElementById('auth-error-container').innerHTML = '';
    document.getElementById('auth-success-container').innerHTML = '';
    htmx.process(form);
}

// Theme Toggle
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
(function() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
})();

// Drag & Drop + File Upload
document.addEventListener('DOMContentLoaded', () => {
    const dz = document.getElementById('drop-zone');
    if (!dz) return;
    ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('drag-active'); }));
    ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('drag-active'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });
});

function handleFileInputChange(input) {
    if (input.files.length) uploadFiles(input.files);
}

async function uploadFiles(files) {
    const container = document.getElementById('upload-status-container');
    const list = document.getElementById('upload-status-list');
    if (!container || !list) return;
    container.style.display = 'block';

    for (const file of files) {
        const tid = 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const li = document.createElement('li');
        li.className = 'status-item'; li.id = tid;
        li.innerHTML = `<span class="status-item-name" title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</span>
            <span class="status-badge badge-indexing" id="${tid}-badge">Queued</span>`;
        list.insertBefore(li, list.firstChild);

        try {
            const fd = new FormData(); fd.append('file', file);
            const res = await fetch('/upload', { method: 'POST', headers: { 'x-csrf-token': getCsrfToken() }, body: fd });
            if (!res.ok) throw new Error((await res.json()).detail || 'Upload error');

            const badge = document.getElementById(`${tid}-badge`);
            if (badge) {
                badge.className = 'status-badge badge-indexing'; badge.textContent = 'Indexing';
                ['hx-get', 'hx-trigger', 'hx-target', 'hx-swap'].forEach((attr, i) =>
                    badge.setAttribute(attr, [`/status/${encodeURIComponent(file.name)}`, 'every 2s', 'this', 'outerHTML'][i])
                );
                htmx.process(badge);
            }
            refreshDocumentsList();
        } catch (err) {
            const badge = document.getElementById(`${tid}-badge`);
            if (badge) { badge.className = 'status-badge badge-error'; badge.textContent = 'Failed'; }
        }
    }
}

function refreshDocumentsList() {
    if (document.getElementById('documents-list'))
        htmx.ajax('GET', '/documents', { target: '#documents-list', swap: 'innerHTML' });
}

// Chat / RAG Streaming
async function handleChatSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    if (!query) return;

    input.value = ''; input.disabled = true;
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    const msgs = document.getElementById('chat-messages');
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message';
    userMsg.innerHTML = `<div class="message-content">${escapeHTML(query)}</div>`;
    msgs.appendChild(userMsg);

    const aMsg = document.createElement('div');
    aMsg.className = 'message assistant-message';
    aMsg.innerHTML = `<div class="message-content"><i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...</div>`;
    msgs.appendChild(aMsg);
    msgs.scrollTop = msgs.scrollHeight;

    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
            body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Query failed');

        const content = aMsg.querySelector('.message-content');
        content.innerHTML = '';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            full += decoder.decode(value, { stream: true });
            content.innerHTML = formatMarkdown(full);
            msgs.scrollTop = msgs.scrollHeight;
        }
    } catch (err) {
        aMsg.querySelector('.message-content').innerHTML =
            `<span style="color:var(--accent-red)"><i class="fa-solid fa-circle-exclamation"></i> Error: ${escapeHTML(err.message)}</span>`;
    } finally {
        input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

function resetChat() {
    const m = document.getElementById('chat-messages');
    if (m) m.innerHTML = `<div class="message system-message"><div class="message-content">
        <h3>Welcome to your AI Legal Assistant!</h3>
        <p>Upload your legal bills, court transcripts, contracts, or scanned documents in the sidebar. We will automatically perform OCR extraction, chunk, embed, and index them. You can then ask me any questions about their contents.</p>
    </div></div>`;
}

// Utilities
function escapeHTML(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function formatMarkdown(text) {
    let h = escapeHTML(text);
    h = h.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    h = h.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    return h.split('\n\n').map(block => {
        block = block.trim();
        if (!block) return '';
        if (block.startsWith('<h')) return block;
        const lines = block.split('\n');
        const bullets = lines.every(l => /^[-*] /.test(l.trim()) || !l.trim());
        if (bullets && lines.some(l => /^[-*] /.test(l.trim())))
            return '<ul>' + lines.filter(l => l.trim()).map(l => `<li>${l.trim().replace(/^[-*] /, '')}</li>`).join('') + '</ul>';
        const numbered = lines.every(l => /^\d+\.\s/.test(l.trim()) || !l.trim());
        if (numbered && lines.some(l => /^\d+\.\s/.test(l.trim())))
            return '<ol>' + lines.filter(l => l.trim()).map(l => `<li>${l.trim().replace(/^\d+\.\s/, '')}</li>`).join('') + '</ol>';
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

// Doc counter sync
document.body.addEventListener('htmx:afterSwap', evt => {
    if (evt.detail.target.id === 'documents-list') {
        const c = document.getElementById('doc-count');
        if (c) c.textContent = document.querySelectorAll('#documents-list li:not(.empty-docs)').length;
    }
});
