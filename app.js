// app.js - Logica principale dell'applicazione Client-Side

document.addEventListener('DOMContentLoaded', () => {
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

    // Area rendering risultati
    const bookTitleDisplay = document.getElementById('bookTitleDisplay');
    const conceptsList = document.getElementById('conceptsList');

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

    const renderResults = (data) => {
        if (!data.title || !data.concepts || !Array.isArray(data.concepts)) {
            throw new Error("Formato risposta del Server non valido.");
        }

        bookTitleDisplay.textContent = data.title;

        data.concepts.forEach((concept, index) => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            // Stagger animation delay per animazione cascata elegante
            card.style.transitionDelay = `${index * 0.15}s`;

            card.innerHTML = `
                <div class="concept-header">
                    <div class="concept-number">${index + 1}</div>
                    <h3>${concept.title}</h3>
                </div>
                <p>${concept.description}</p>
            `;

            conceptsList.appendChild(card);

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

    // --- EVENT LISTENER RICERCA ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = bookInput.value.trim();
        if (!title) return;

        showLoading();

        try {
            const data = await fetchBookSummaryFromServer(title);
            hideLoading();
            renderResults(data);
        } catch (err) {
            hideLoading();
            showError(err);
        }
    });

});
