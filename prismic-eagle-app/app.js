// app.js - Logica principale dell'applicazione Client-Side

document.addEventListener('DOMContentLoaded', () => {
    // Intro Screen Logic
    const welcomeScreen = document.getElementById('welcomeScreen');

    // Controlla se la pagina è appena stata aperta. Possiamo mostrare l'intro sempre, 
    // oppure usare sessionStorage per mostrarla solo la prima volta nella sessione.
    // L'utente ha chiesto 'quando l'utente apre il sito', mostriamola sempre con un timer breve.
    setTimeout(() => {
        if (welcomeScreen) {
            welcomeScreen.classList.add('fade-out');
            // Rimuoviamo dal DOM per non bloccare scroll e click dopo l'animazione
            setTimeout(() => {
                welcomeScreen.remove();
            }, 800); // tempo in sync con la transizione css (0.8s)
        }
    }, 2200); // Lasciamo il saluto per 2.2 secondi

    // Referenze UI Principali
    const searchForm = document.getElementById('searchForm');
    const bookInput = document.getElementById('bookInput');
    const searchButton = document.getElementById('searchButton');
    const btnText = searchButton.querySelector('span');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Aree di stato
    const emptyState = document.getElementById('emptyState');
    const resultsArea = document.getElementById('resultsArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessageDisplay = document.getElementById('errorMessage');

    // Area rendering risultati principale
    const bookCoverImg = document.getElementById('bookCoverImg');
    const bookTitleDisplay = document.getElementById('bookTitleDisplay');
    const bookAuthorYear = document.getElementById('bookAuthorYear');
    const bookSummaryText = document.getElementById('bookSummaryText');
    const bookCharactersList = document.getElementById('bookCharactersList');
    const conceptsList = document.getElementById('conceptsList');

    // Area Azioni (Mappa Concettuale V2)
    const generateSchemaBtn = document.getElementById('generateSchemaBtn');
    const schemaSpinner = document.getElementById('schemaSpinner');

    // Area Chat AI
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatButton = document.getElementById('chatButton');
    const chatSpinner = document.getElementById('chatSpinner');
    const chatHistory = document.getElementById('chatHistory');

    // Variabile per mantenere il contesto globale del libro visionato
    let currentBookContext = null;

    // Drawer Cronologia
    const historyBtn = document.getElementById('historyBtn');
    const historyDrawer = document.getElementById('historyDrawer');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyList = document.getElementById('historyList');
    const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');

    // Array per memorizzare la history
    let searchHistory = JSON.parse(localStorage.getItem('book_history') || '[]');

    // --- FUNZIONALITA CRONOLOGIA ---
    const updateHistoryUI = () => {
        historyList.innerHTML = '';
        if (searchHistory.length === 0) {
            emptyHistoryMsg.classList.remove('hidden');
        } else {
            emptyHistoryMsg.classList.add('hidden');
            // Ordine dall'ultimo salvato
            [...searchHistory].reverse().forEach(bookData => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <h4>${bookData.title}</h4>
                    <span>${bookData.timestamp || 'Recente'}</span>
                `;
                item.addEventListener('click', () => {
                    historyDrawer.classList.add('hidden');
                    renderResults(bookData);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                historyList.appendChild(item);
            });
        }
    };

    const saveToHistory = (data) => {
        // Evitiamo duplicati
        const exists = searchHistory.findIndex(d => d.title === data.title);
        if (exists !== -1) {
            searchHistory.splice(exists, 1);
        }
        data.timestamp = new Date().toLocaleDateString('it-IT', { hour: '2-digit', minute: '2-digit' });
        searchHistory.push(data);
        // Manteniamo solo gli ultimi 15
        if (searchHistory.length > 15) searchHistory.shift();

        localStorage.setItem('book_history', JSON.stringify(searchHistory));
        updateHistoryUI();
    };

    historyBtn?.addEventListener('click', () => {
        updateHistoryUI();
        historyDrawer.classList.remove('hidden');
    });

    closeHistoryBtn?.addEventListener('click', () => {
        historyDrawer.classList.add('hidden');
    });

    historyDrawer?.addEventListener('click', (e) => {
        if (e.target === historyDrawer) {
            historyDrawer.classList.add('hidden');
        }
    });


    // --- INTEGRAZIONE CON IL BACKEND SERVERLESS (NETLIFY FUNCTION) ---
    const fetchBookSummaryFromServer = async (bookTitle) => {
        // Ora chiamiamo la nostra API "invisibile" sul server Netlify,
        // non più direttamente Google Gemini, proteggendo così la chiave!
        const endpoint = '/.netlify/functions/get-summary';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bookTitle: bookTitle })
            });

            const data = await response.json();

            // Il server Netlify potrebbe restituire errori se non capisce il libro
            // o se la CHIAVE API globale dell'admin è mancante.
            if (!response.ok) {
                console.error("Errore dal Server:", data.error);
                throw new Error(data.error || 'server_error');
            }

            return data;
        } catch (error) {
            console.error("Problema di rete o Serverless:", error);
            throw error;
        }
    };


    // --- GESTIONE INTERFACCIA E STATI RICERCA ---
    const showLoading = () => {
        btnText.textContent = 'Analisi AI in corso';
        loadingSpinner.classList.remove('hidden');
        searchButton.disabled = true;

        emptyState.classList.add('hidden');
        resultsArea.classList.add('hidden');
        errorArea.classList.add('hidden');
        conceptsList.innerHTML = '';
    };

    const hideLoading = () => {
        btnText.textContent = 'Sintetizza';
        loadingSpinner.classList.add('hidden');
        searchButton.disabled = false;
    };

    generateSchemaBtn.disabled = false;
    generateSchemaBtn.querySelector('span').textContent = 'Mappa Concettuale';

    const fetchCoverImage = async (title, author) => {
        try {
            // Tentativo 1: Cerchiamo l'ID del libro openlibrary
            const olResponse = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`);
            const olData = await olResponse.json();

            if (olData.docs && olData.docs.length > 0 && olData.docs[0].cover_i) {
                const coverId = olData.docs[0].cover_i;
                bookCoverImg.src = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
                return;
            }

            // Tentativo 2 (Fallback): Google Books API se OpenLibrary non ha l'immagine
            const gbResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}&maxResults=1`);
            const gbData = await gbResponse.json();

            if (gbData.items && gbData.items.length > 0 && gbData.items[0].volumeInfo.imageLinks) {
                // Usiamo thumbnail (spesso l'unica disponibile su GB), rimpiazziamo zoom per qualità migliore se possibile
                let coverUrl = gbData.items[0].volumeInfo.imageLinks.thumbnail;
                coverUrl = coverUrl.replace('http:', 'https:').replace('&zoom=1', '&zoom=0');
                bookCoverImg.src = coverUrl;
                return;
            }

            throw new Error("Nessuna immagine trovata nelle API pubbliche");

        } catch (error) {
            console.warn("Fallback copertina testuale attivato", error);
            // Fallback finale a copertina testuale pulita e colorata
            bookCoverImg.src = `https://via.placeholder.com/300x450/1a1a24/6366f1?text=${encodeURIComponent(title.split(' ').slice(0, 3).join(' '))}`;
        }
    };

    const renderResults = (data) => {
        if (!data.title || !data.concepts || !Array.isArray(data.concepts)) {
            throw new Error("Formato risposta del Server non valido.");
        }

        // Memorizzo i dati per farli usare in seguito alla CHAT
        currentBookContext = data;

        // Reset copertina
        bookCoverImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Reset veloce

        // Popola Info Principali (Hero Card)
        bookTitleDisplay.textContent = data.title;
        bookAuthorYear.textContent = `${data.author || 'Autore Sconosciuto'} • ${data.year || 'N/D'}`;
        bookSummaryText.textContent = data.summary || '';

        // Popola Personaggi
        bookCharactersList.innerHTML = '';
        if (data.characters && data.characters.length > 0) {
            data.characters.forEach(char => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${char.name}</strong> - ${char.role}`;
                bookCharactersList.appendChild(li);
            });
        }

        // Avvio fetch silenziosa della Cover
        if (data.title && data.author) {
            fetchCoverImage(data.title, data.author);
        }

        // Reset vecchi concetti e logiche Mappa
        conceptsList.innerHTML = '';
        generateSchemaBtn.disabled = false;
        generateSchemaBtn.querySelector('span').textContent = 'Mappa Concettuale';

        data.concepts.forEach((concept, index) => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            // Stagger animation delay per animazione cascata elegante
            card.style.transitionDelay = `${index * 0.15}s`;

            // L'AI ora ci restituisce anche una emoji relativa al concetto
            const emoji = concept.emoji || (index + 1);

            card.innerHTML = `
                <div class="concept-actions">
                    <button class="copy-btn" title="Copia Appunti" data-text="${concept.description.replace(/"/g, '&quot;')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
                <div class="concept-header">
                    <div class="concept-number">${emoji}</div>
                    <h3>${concept.title}</h3>
                </div>
                <p>${concept.description}</p>
            `;

            // Aggiungi la card
            conceptsList.appendChild(card);

            // Event Listener per il Copia Text
            const copyBtn = card.querySelector('.copy-btn');
            copyBtn.addEventListener('click', (e) => {
                const t = e.currentTarget.getAttribute('data-text');
                navigator.clipboard.writeText(t).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                });
            });

            // Trigger reflow per avviare l'animazione d'ingresso
            setTimeout(() => {
                card.classList.add('animate-in');
            }, 50);
        });

        resultsArea.classList.remove('hidden');
    };

    const showError = (errorObj) => {
        // Se l'errore parla di configurazione, la colpa è dell'Admin (Mancanza Env Var su Netlify)
        if (errorObj.message === 'Configurazione Server Mancante') {
            errorMessageDisplay.innerHTML = `Scusaci! Il sito è temporaneamente in manutenzione.<br><span style="font-size: 0.9rem">(L'Amministratore deve configurare la GEMINI_API_KEY su Netlify)</span>.`;
        } else {
            errorMessageDisplay.innerHTML = `Si è verificato un errore durante l'analisi del libro.<br> Controlla il titolo e riprova tra poco.`;
        }
        errorArea.classList.remove('hidden');
    };

    // --- EVENT LISTENER RICERCA PRINCIPALE ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = bookInput.value.trim();
        if (!title) return;

        showLoading();

        // Azzera la chat del modello precedente
        chatHistory.innerHTML = '';
        chatInput.value = '';

        try {
            const data = await fetchBookSummaryFromServer(title);
            hideLoading();
            renderResults(data);
            saveToHistory(data); // Salva nella cronologia dopo il successo
        } catch (err) {
            hideLoading();
            showError(err);
        }
    });

    // --- EVENT LISTENER CHAT CON L'AI ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const question = chatInput.value.trim();
        if (!question || !currentBookContext) return;

        // Aggiungi subito la bolla di risposta dell'Utente
        appendChatMessage(question, 'user');
        chatInput.value = '';

        // UI Caricamento Bottone Chat
        const originalBtnText = chatButton.querySelector('span').textContent;
        chatButton.querySelector('span').textContent = '...';
        chatSpinner.classList.remove('hidden');
        chatButton.disabled = true;

        try {
            const response = await fetch('/.netlify/functions/ask-question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    bookTitle: currentBookContext.title,
                    author: currentBookContext.author
                })
            });

            const replyData = await response.json();

            if (!response.ok) {
                throw new Error("Errore Chat Server");
            }

            appendChatMessage(replyData.answer, 'bot');

        } catch (err) {
            console.error("Errore Chat", err);
            appendChatMessage("Scusa, ho avuto un problema tecnico nel recuperare la risposta. Riprova.", 'bot');
        } finally {
            // Restore btn
            chatButton.querySelector('span').textContent = originalBtnText;
            chatSpinner.classList.add('hidden');
            chatButton.disabled = false;
        }
    });

    // --- EVENT LISTENER AZIONI: MAPPA CONCETTUALE ED EXPORT AUTMOMATICO ---
    generateSchemaBtn?.addEventListener('click', async () => {
        if (!currentBookContext) return;

        generateSchemaBtn.disabled = true;
        schemaSpinner.classList.remove('hidden');
        generateSchemaBtn.querySelector('span').textContent = 'Creazione in corso...';

        try {
            const response = await fetch('/.netlify/functions/get-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookTitle: currentBookContext.title,
                    author: currentBookContext.author
                })
            });

            const replyData = await response.json();

            if (!response.ok) {
                throw new Error("Errore Generazione Mappa Concettuale");
            }

            // Dalla stringa generata estraiamo il JSON vero e proprio
            let rawJson = replyData.schema;
            // Pulisce blocchi markdown tipo ```json ... ``` se presenti
            if (rawJson.startsWith('```json')) {
                rawJson = rawJson.replace(/^```json/g, '').replace(/```$/g, '').trim();
            } else if (rawJson.startsWith('```')) {
                rawJson = rawJson.replace(/^```/g, '').replace(/```$/g, '').trim();
            }

            const mapData = JSON.parse(rawJson);

            generateSchemaBtn.querySelector('span').textContent = 'Disegno Grafica...';

            // --- ENGINE VETTORIALE CANVAS ---
            const canvas = document.createElement('canvas');
            // Aumentata risoluzione canvas per contenere fino a 5 rami x 4 foglie senza sovrapposizioni
            canvas.width = 2400;
            canvas.height = 1600;
            const ctx = canvas.getContext('2d');

            // Sfondo
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Palette Colori Dinamica per i Vari Rami
            const branchColors = ['#4f46e5', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981'];

            // Font Utils
            const drawText = (text, x, y, size, weight, color, align = 'left') => {
                ctx.font = `${weight} ${size}px 'Inter', sans-serif`;
                ctx.fillStyle = color;
                ctx.textAlign = align;
                ctx.fillText(text, x, y);
            };

            // Funzione Bolla con Testo
            const drawBubble = (text, cx, cy, w, h, bgColor, textColor, radius = 12, strokeColor = null) => {
                ctx.fillStyle = bgColor;
                ctx.beginPath();
                ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
                ctx.fill();

                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }

                // Ombra leggera premium
                ctx.shadowColor = 'rgba(0,0,0,0.08)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetY = 4;
                ctx.fill();
                ctx.shadowColor = 'transparent';

                // Troncamento se testo troppo lungo
                let cleanText = text.length > 55 ? text.substring(0, 52) + '...' : text;
                drawText(cleanText, cx, cy + 6, h * 0.25, '600', textColor, 'center');
            };

            // Traccia connessione Bezier
            const drawConnection = (startX, startY, endX, endY, color = '#cbd5e1') => {
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.bezierCurveTo(startX + 150, startY, endX - 150, endY, endX, endY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();
            };

            // 1) HEADER Documento
            drawText("MAPPA CONCETTUALE", 50, 80, 28, '700', '#64748b');
            drawText(`Libro: ${currentBookContext.title}`, 50, 130, 42, '700', '#0f172a');
            drawText(`Autore: ${currentBookContext.author || 'N/D'}`, 50, 180, 24, '400', '#475569');
            drawText("Generato tramite Sintesi Libri AI", 50, canvas.height - 50, 18, '400', '#94a3b8');

            // 2) Posizioni Logiche del Grafo
            const rootX = 350;
            const rootY = canvas.height / 2; // Centraggio vert

            // ROOT NODE (Nero)
            drawBubble(mapData.root || 'Root', rootX, rootY, 400, 90, '#1e293b', '#ffffff', 20);

            // Disegna rami e foglie
            if (mapData.branches && mapData.branches.length > 0) {
                const totalBranches = mapData.branches.length;
                const branchX = 1000;

                // Spazio Y macro-ramo
                const branchSpanY = (canvas.height - 150) / totalBranches;

                mapData.branches.forEach((branch, bIdx) => {
                    const branchY = 75 + (branchSpanY * bIdx) + (branchSpanY / 2);
                    const bColor = branchColors[bIdx % branchColors.length];

                    // Linea Root -> Branch
                    drawConnection(rootX + 200, rootY, branchX - 250, branchY, '#e2e8f0');

                    // Bolla Branch Colorata
                    drawBubble(branch.title || 'Tema', branchX, branchY, 450, 80, bColor, '#ffffff', 16);

                    // Disegna Nodi Finali
                    if (branch.nodes && branch.nodes.length > 0) {
                        const totalNodes = branch.nodes.length;
                        const nodeX = 1800;
                        const nodeSpan = 100; // px di stacco tra fratelli

                        // Centratura Y relativa al ramo
                        const startNodeY = branchY - ((totalNodes - 1) * nodeSpan) / 2;

                        branch.nodes.forEach((nodeStr, nIdx) => {
                            const nodeY = startNodeY + (nIdx * nodeSpan);

                            // Linea semi-trasparente col colore del ramo + bolla bordata
                            drawConnection(branchX + 225, branchY, nodeX - 300, nodeY, bColor + '60');
                            drawBubble(nodeStr, nodeX, nodeY, 600, 65, '#ffffff', '#0f172a', 12, bColor);
                        });
                    }
                });
            }

            generateSchemaBtn.querySelector('span').textContent = 'Creazione PDF in alta fedeltà...';

            // --- ESPORTAZIONE JSPDF DIRETTA (No Stampa Nativa) ---
            setTimeout(() => {
                const imgData = canvas.toDataURL('image/png');

                const { jsPDF } = window.jspdf;
                // A4 in Landscape = 297 x 210 mm
                const pdf = new jsPDF('landscape', 'mm', 'a4');

                // Aggiungiamo PNG occupando tutto A4
                pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);

                const sanitizedTitle = (currentBookContext?.title || 'Libro').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                pdf.save(`${sanitizedTitle}_diagramma.pdf`);

                generateSchemaBtn.querySelector('span').textContent = 'Mappa Concettuale';
                schemaSpinner.classList.add('hidden');
                generateSchemaBtn.disabled = false;
            }, 500);

        } catch (err) {
            console.error("Errore Mappa Concettuale", err);
            generateSchemaBtn.disabled = false;
            schemaSpinner.classList.add('hidden');
            generateSchemaBtn.querySelector('span').textContent = 'Riprova';
        }
    });

});
