(function() {
        function createWarningModal(url, linkElement, state) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'thundy-overlay';

        const modal = document.createElement('div');
        modal.className = 'card card-info thundy-modal';

        const title = document.createElement('h2');
        title.className = 'text-warning';
        title.textContent = 'Achtung: Sie verlassen Thunderbird';

        const message = document.createElement('p');
        message.className = 'text-info';
        message.textContent = 'Dieser Link wurde noch nicht vollständig überprüft oder ist unbekannt.';

        const urlInfo = document.createElement('p');
        urlInfo.textContent = 'Ziel: ' + url;

        const stateInfo = document.createElement('p');
        stateInfo.textContent = 'Status: ' + state;

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'mt-3';

        const openBtn = document.createElement('button');
        openBtn.className = 'btn-primary ml-2';
        openBtn.textContent = 'Auf eigene Gefahr öffnen';
        openBtn.addEventListener('click', () => {
            linkElement.setAttribute('data-thundy-allowed', 'true');
            overlay.remove();
            linkElement.click();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-success';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });

        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(openBtn);

        modal.appendChild(title);
        modal.appendChild(message);
        modal.appendChild(urlInfo);
        modal.appendChild(stateInfo);
        modal.appendChild(buttonGroup);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    document.addEventListener('click', async function(event) {
        const linkElement = event.target.closest('a');

        if (linkElement && linkElement.href) {
            // Check if we already allowed it
            if (linkElement.getAttribute('data-thundy-allowed') === 'true') {
                return; // Let the default action happen
            }

            const url = linkElement.href;

            // Only intercept http/https
            if (!url.startsWith('http')) return;

            event.preventDefault();
            event.stopPropagation();

            try {
                const response = await browser.runtime.sendMessage({
                    action: 'checkLinkState',
                    url: url
                });

                if (response && response.status === 'CLEAN') {
                    // Safe to open
                    linkElement.setAttribute('data-thundy-allowed', 'true');
                    linkElement.click();
                } else {
                    // Unsafe or unknown
                    createWarningModal(url, linkElement, response ? response.status : 'UNKNOWN');
                }
            } catch (err) {
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
