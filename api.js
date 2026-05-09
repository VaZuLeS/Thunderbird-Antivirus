let apikey_hybridanalysis;

async function loadSettings() {
    await messenger.storage.local.get('apikey').then((result) => {
        console.log("Ihr Hybrid-Analysis API-KEY wurde geladen.");
        apikey_hybridanalysis = result.apikey;
    });
}
loadSettings();

// Der Benutzer hat auf unseren Button geklickt, holen Sie sich den aktiven Tab im aktuellen Fenster mit
// der Tabs API.
let tabs = await messenger.tabs.query({ active: true, currentWindow: true });

// Holen Sie sich die aktuell angezeigte Nachricht im aktiven Tab, mit der
// messageDisplay API. Hinweis: Dies benötigt die messagesRead Berechtigung.
// Die zurückgegebene Nachricht ist ein MessageHeader-Objekt mit den relevantesten
// Informationen.
let message = await messenger.messageDisplay.getDisplayedMessage(tabs[0].id);
console.log(message.headerMessageId);


// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
document.getElementById("subject").textContent = message.subject;
document.getElementById("from").textContent = message.author;
document.getElementById("MessageHeaderID").textContent = message.headerMessageId;
document.getElementById("status_message").textContent = "Status: Lade Daten...";
try {

    let db;

    // Öffnen Sie die Datenbank
    let openRequest = indexedDB.open("thunderbird_av", 3);

    openRequest.onupgradeneeded = function (e) {
        db = e.target.result;

        if (!db.objectStoreNames.contains('hybridanalysis')) {
            db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
        }
    };


    openRequest.onsuccess = async function (e) {
        console.log("Datenbank wurde erfolgreich geöffnet/aktualisiert");
        db = e.target.result;
        console.log(db);
        // Erstellen Sie eine Transaktion und öffnen Sie den Object Store
        let transaction = db.transaction(["hybridanalysis"], "readonly");
        console.log(transaction);
        let store = transaction.objectStore("hybridanalysis");
        console.log(store);
        // Führen Sie eine Anfrage aus, um den Hash für die angegebene MessageHeaderId zu finden.
        let getRequest = store.get(message.headerMessageId);
        console.log(getRequest);
        getRequest.onsuccess = function (e) {
            // Wenn der Hash gefunden wird, zeigen Sie ihn an.
            console.log(getRequest.result);
            if (getRequest.result) {
                document.getElementById("status_message").textContent = "Status: Lade Report von Hybrid-Analysis...";
                const hash256 = getRequest.result.hybrid_sha256;
                console.log(hash256);
                get_hybrid_report_by_sha256(hash256);
            } else {
                document.getElementById("status_message").textContent = "Status: Kein Scan in Datenbank. Möglicherweise läuft der Scan noch oder es gibt keine Anhänge.";
                console.log("Kein Hash gefunden.");
            }
        };
        getRequest.onerror = function (e) {
            document.getElementById("status_message").textContent = "Status: Fehler beim Abrufen aus der Datenbank.";
            console.log("Fehler beim Abrufen des Datensatzes:", e.target.error);
        };

    };
} catch (error) {
    console.log('Error opening local Hybrid Analysis Database:', error);
}

async function get_hybrid_report_by_sha256(hybrid_sha) {

    // Set the request options
    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
        },

    };

    // Send the request and handle the response
    try {
        const response = await fetch(options.url, options);
        console.log(response);
        const json_data = await response.json();
        console.log(json_data);

        if (response.status === 200 || response.status === 202) {
            if (json_data.verdict === 'in progress' || response.status === 202) {
                document.getElementById("status_message").textContent = "Status: Scan läuft...";
                return;
            }
            document.getElementById("status_message").textContent = "";
            // Dateidetails
            // Erstellen Sie ein neues div-Element
            // Erstellen Sie ein neues div-Element
            let div = document.createElement('div');

            // Fügen Sie den Titel hinzu
            let h1 = document.createElement('h1');
            h1.innerText = 'Thundy AV Checker';
            div.appendChild(h1);

            // Fügen Sie den Link hinzu
            let a = document.createElement('a');
            a.href = 'https://www.hybrid-analysis.com/my-submissions/all';
            a.innerText = 'Alle Übertragungen zu Hybrid Analysis anzeigen';
            div.appendChild(a);

            // Fügen Sie den Bedrohungsscore hinzu
            let p1 = document.createElement('p');
            let strong1 = document.createElement('strong');
            let span1 = document.createElement('span');
            span1.className = "head_line";
            span1.style.color = "red";
            span1.innerText = "Bedrohungsscore:";
            strong1.appendChild(span1);
            p1.appendChild(strong1);
            p1.appendChild(document.createTextNode(" " + json_data.threat_score));
            div.appendChild(p1);

            // Fügen Sie das Urteil hinzu
            let p2 = document.createElement('p');
            let strong2 = document.createElement('strong');
            let span2 = document.createElement('span');
            span2.className = "head_line";
            span2.style.color = "red";
            span2.innerText = "Urteil:";
            strong2.appendChild(span2);
            p2.appendChild(strong2);
            p2.appendChild(document.createTextNode(" " + json_data.verdict));
            div.appendChild(p2);

            // Fügen Sie die Vx-Familie hinzu
            let p3 = document.createElement('p');
            let strong3 = document.createElement('strong');
            strong3.innerText = "Vx-Familie:";
            p3.appendChild(strong3);
            p3.appendChild(document.createTextNode(" " + json_data.vx_family));
            div.appendChild(p3);

            // Fügen Sie das Multiscan-Ergebnis hinzu
            let p4 = document.createElement('p');
            p4.innerText = "Multiscan-Ergebnis: " + json_data.multiscan_result;
            div.appendChild(p4);

            // Fügen Sie die zusätzlichen Informationen hinzu
            let p5 = document.createElement('p');
            p5.innerHTML = "<strong>Additional Information:</strong>";
            div.appendChild(p5);

            // Fügen Sie die Analysestartzeit hinzu
            let p6 = document.createElement('p');
            p6.innerText = "Analysis start time: " + json_data.analysis_start_time;
            div.appendChild(p6);

            // Fügen Sie den letzten Multiscan hinzu
            let p7 = document.createElement('p');
            p7.innerText = "Last multiscan: " + json_data.last_multiscan;
            div.appendChild(p7);

            // Fügen Sie die Tags hinzu
            let p8 = document.createElement('p');
            p8.innerText = "Tags: " + json_data.tags;
            div.appendChild(p8);

            // Fügen Sie die Scannerergebnisse hinzu
            let div2 = document.createElement('div');
            div2.className = 'head_line';
            div2.innerText = 'Scannerergebnisse:';
            div.appendChild(div2);

            // Fügen Sie die Scanner hinzu
            for (const scanner of json_data.scanners) {
                let p9 = document.createElement('p');
                p9.innerText = '  Scanner: ' + scanner.name;
                div.appendChild(p9);
                let p10 = document.createElement('p');
                p10.innerText = '    Status: ' + scanner.status;
                div.appendChild(p10);
                if (scanner.anti_virus_results) {
                    let p11 = document.createElement('p');
                    p11.innerText = '      AV-Ergebnisse:';
                    div.appendChild(p11);
                    for (const avResult of scanner.anti_virus_results) {
                        let p12 = document.createElement('p');
                        p12.innerText = '        AV: ' + avResult.product;
                        div.appendChild(p12);
                        let p13 = document.createElement('p');
                        p13.innerText = '        Urteil: ' + avResult.verdict;
                        div.appendChild(p13);
                    }
                }
            }

            // Fügen Sie den SHA-256-Hashwert hinzu
            let p14 = document.createElement('p');
            p14.innerText = '  SHA-256-Hashwert: ' + json_data.sha256;
            div.appendChild(p14);

            // Fügen Sie den letzten Dateinamen hinzu
            let p15 = document.createElement('p');
            p15.innerText = '  Letzter Dateiname: ' + json_data.last_file_name;
            div.appendChild(p15);

            // Fügen Sie die weiteren Dateinamen hinzu
            let p16 = document.createElement('p');
            p16.innerText = '  Weitere Dateinamen: ' + json_data.other_file_name;
            div.appendChild(p16);

            // Fügen Sie die URL-Analyse hinzu
            let p17 = document.createElement('p');
            p17.innerText = '  URL-Analyse: ' + json_data.url_analysis;
            div.appendChild(p17);

            // Fügen Sie die Größe hinzu
            let p18 = document.createElement('p');
            p18.innerText = '  Größe: ' + json_data.size;
            div.appendChild(p18);

            // Fügen Sie den Typ hinzu
            let p19 = document.createElement('p');
            p19.innerText = '  Typ: ' + json_data.type;
            div.appendChild(p19);

            // Fügen Sie die Architektur hinzu
            let p20 = document.createElement('p');
            p20.innerText = '  Architektur: ' + json_data.architecture;
            div.appendChild(p20);

            // Fügen Sie die zusätzlichen Informationen hinzu
            let p21 = document.createElement('p');
            p21.innerText = 'Zusätzliche Informationen:';
            div.appendChild(p21);

            // Fügen Sie die Analysestartzeit hinzu
            let p22 = document.createElement('p');
            p22.innerText = '  Analysebeginn: ' + json_data.analysis_start_time;
            div.appendChild(p22);

            // Fügen Sie den letzten Multiscan hinzu
            let p23 = document.createElement('p');
            p23.innerText = '  Letzte Multiscan: ' + json_data.last_multiscan;
            div.appendChild(p23);

            // Fügen Sie die Tags hinzu
            let p24 = document.createElement('p');
            p24.innerText = '  Tags: ' + json_data.tags;
            div.appendChild(p24);

            // Fügen Sie den Whitelist-Status hinzu
            let p25 = document.createElement('p');
            p25.innerText = '  Whitelist-Status: ' + json_data.whitelisted;
            div.appendChild(p25);

            // Fügen Sie die verwandten Elternhashes hinzu
            let p26 = document.createElement('p');
            p26.innerText = '  Verwandte Elternhashes: ' + json_data.related_parent_hashes;
            div.appendChild(p26);

            // Fügen Sie die verwandten Kindhashes hinzu
            let p27 = document.createElement('p');
            p27.innerText = '  Verwandte Kindhashes: ' + json_data.related_children_hashes;
            div.appendChild(p27);

            // Fügen Sie die Berichte hinzu
            let p28 = document.createElement('p');
            p28.innerText = '  Berichte: ' + json_data.reports;
            div.appendChild(p28);

            // Fügen Sie die Gesamtbewertung hinzu
            let p29 = document.createElement('p');
            p29.innerText = 'Gesamtbewertung:';
            div.appendChild(p29);

            // Fügen Sie den Bedrohungsscore hinzu
            let p30 = document.createElement('p');
            p30.innerText = '  Bedrohungsscore: ' + json_data.threat_score;
            div.appendChild(p30);

            // Fügen Sie das Urteil hinzu
            let p31 = document.createElement('p');
            p31.innerText = '  Urteil: ' + json_data.verdict;
            div.appendChild(p31);

            // Fügen Sie den Whitelist-Status hinzu
            let p32 = document.createElement('p');
            p32.innerText = '  Whitelist status: ' + json_data.whitelisted;
            div.appendChild(p32);

            // Fügen Sie das div-Element zum DOM hinzu
            document.body.appendChild(div);


            // Fügen Sie das div-Element zum DOM hinzu
            //document.getElementById('hybrid_analysis_api_content').insertAdjacentHTML('beforeend',div);

        } else {
            document.getElementById("status_message").textContent = "";
            // Fügen Sie das div-Element zum DOM hinzu
            let errorMsg = json_data.message || 'Unknown error';
            document.getElementById('hybrid_analysis_api_content').innerText = 'Failed to Get Report for SHA256 at Hybrid Analysis. ' + errorMsg;

        }
    } catch (error) {
        document.getElementById("status_message").textContent = "";
        // Fügen Sie das div-Element zum DOM hinzu
        document.getElementById('hybrid_analysis_api_content').innerText = 'Error getting analysis from Hybrid Analysis:' + error;
    }
}