(function() {
    const allowedLinks = new WeakSet();

    function createWarningModal(url, linkElement, state, reasons) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'thundy-overlay';

        const modal = document.createElement('div');
        modal.className = 'card card-info thundy-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'thundy-warning-title');
        modal.setAttribute('aria-describedby', 'thundy-warning-message');

        const title = document.createElement('h2');
        title.id = 'thundy-warning-title';
        title.className = 'text-warning';
        title.textContent = 'Achtung: Sie verlassen Thunderbird';

        const message = document.createElement('p');
        message.id = 'thundy-warning-message';
        message.className = 'text-info';

        if (state === 'MALICIOUS_VISUAL') {
            title.textContent = 'Warnung: Visuelles Phishing erkannt!';
            title.style.color = 'red';
            message.textContent = 'Diese URL wurde von urlscan.io blockiert. Es könnte sich um eine gefälschte Login-Seite handeln.';
            message.style.color = 'red';
            message.style.fontWeight = 'bold';
        } else {
            message.textContent = 'Dieser Link wurde noch nicht vollständig überprüft oder ist unbekannt.';
        }

        const urlInfo = document.createElement('p');
        urlInfo.textContent = 'Ziel: ' + url;

        const stateInfo = document.createElement('p');
        stateInfo.textContent = 'Status: ' + state;

        modal.appendChild(title);
        modal.appendChild(message);
        modal.appendChild(urlInfo);
        modal.appendChild(stateInfo);

        if (reasons && reasons.length > 0) {
            const reasonList = document.createElement('ul');
            reasonList.style.color = 'red';
            reasons.forEach(r => {
                const li = document.createElement('li');
                li.textContent = r;
                reasonList.appendChild(li);
            });
            modal.appendChild(reasonList);
        }

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'mt-3';

        const openBtn = document.createElement('button');
        openBtn.className = 'btn-primary ml-2';
        openBtn.textContent = 'Auf eigene Gefahr öffnen';
        openBtn.addEventListener('click', () => {
            allowedLinks.add(linkElement);
            overlay.remove();
            linkElement.click();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-success';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            linkElement.focus();
        });

        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(openBtn);
        modal.appendChild(buttonGroup);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                overlay.remove();
                linkElement.focus();
            }
        });

        cancelBtn.focus();
    }

    function createLoadingModal(url) {
        const overlay = document.createElement('div');
        overlay.className = 'thundy-overlay thundy-loading-overlay';
        overlay.id = 'thundy-loading-modal';

        const modal = document.createElement('div');
        modal.className = 'card card-info thundy-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'thundy-loading-title');
        modal.setAttribute('aria-describedby', 'thundy-loading-message');

        const title = document.createElement('h2');
        title.id = 'thundy-loading-title';
        title.className = 'text-info';
        title.textContent = 'Time-of-Click Protection aktiv...';

        const message = document.createElement('p');
        message.id = 'thundy-loading-message';
        message.textContent = 'URL wird in Echtzeit auf Bedrohungen analysiert (Computer Vision & Reputations-Check). Bitte haben Sie einen Moment Geduld.';

        modal.appendChild(title);
        modal.appendChild(message);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        modal.tabIndex = -1;
        modal.focus();

        return overlay;
    }

    document.addEventListener('click', async function(event) {
        const linkElement = event.target.closest('a');

        if (linkElement && linkElement.href) {
            // Check if we already allowed it
            if (allowedLinks.has(linkElement)) {
                return; // Let the default action happen
            }

            const url = linkElement.href;

            let protocol;
            try {
                protocol = new URL(url).protocol.toLowerCase();
            } catch (e) {
                /* Ignore invalid URLs */
                return;
            }

            // Block execution of dangerous protocols immediately
            if (protocol === 'javascript:' || protocol === 'data:' || protocol === 'vbscript:') {
                event.preventDefault();
                event.stopPropagation();
                console.warn('Thundy AV: Blocked dangerous URI scheme:', protocol);
                return;
            }

            // Block local and unhandled risky protocols
            if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:' && protocol !== 'tel:' && protocol !== 'cid:' && protocol !== 'mid:') {
                event.preventDefault();
                event.stopPropagation();
                console.warn('Thundy AV: Blocked unhandled URI scheme:', protocol);
                return;
            }

            // Only intercept http/https
            if (protocol !== 'http:' && protocol !== 'https:') return;

            event.preventDefault();
            event.stopPropagation();

            let loadingModal = createLoadingModal(url);

            try {
                const response = await browser.runtime.sendMessage({
                    action: 'checkLinkState',
                    url: url
                });

                if (loadingModal) loadingModal.remove();

                if (response && response.status === 'CLEAN') {
                    // Safe to open
                    allowedLinks.add(linkElement);
                    linkElement.click();
                } else if (response && response.status === 'MALICIOUS_VISUAL') {
                    createWarningModal(url, linkElement, response.status, response.reasons);
                } else {
                    // Unsafe or unknown
                    createWarningModal(url, linkElement, response ? response.status : 'UNKNOWN');
                }
            } catch (err) {
                if (loadingModal) loadingModal.remove();
                console.error("Thundy AV: Error checking link state", err);
                createWarningModal(url, linkElement, 'ERROR');
            }
        }
    }, true);
})();

if (!document.getElementById('thundy-av-styles')) {
    const style = document.createElement('style');
    style.id = 'thundy-av-styles';
    style.textContent = `
        .thundy-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: sans-serif;
        }
        .thundy-modal {
            background: white;
            color: black;
            padding: 20px;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .thundy-modal h2 { margin-top: 0; color: #ff8c00; }
        .thundy-modal button {
            padding: 8px 16px;
            margin-right: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .thundy-modal .btn-primary { background: #005a9e; color: white; }
        .thundy-modal .btn-success { background: #008000; color: white; }
    `;
    document.head.appendChild(style);
}
