// app.js - Logica principale dell'applicazione con integrazione Gemini AI

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

    // Referenze Modale API
    const settingsBtn = document.getElementById('settingsBtn');
    const apiModal = document.getElementById('apiModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const saveApiSuccess = document.getElementById('saveApiSuccess');

    // --- LOGICA GESTIONE API KEY --- 

    // Carica la chiave API dal LocalStorage all'avvio
    let currentApiKey = localStorage.getItem('gemini_api_key') || '';
    if (currentApiKey) {
        apiKeyInput.value = currentApiKey;
    }

    // Apre e chiude il modale impostazioni
    settingsBtn.addEventListener('click', () => {
        apiModal.classList.remove('hidden');
        saveApiSuccess.classList.add('hidden'); // Nascondi successo al riaprire
    });

    closeSettingsBtn.addEventListener('click', () => {
        apiModal.classList.add('hidden');
    });

    // Cliccando fuori dal modale, chiudilo
    apiModal.addEventListener('click', (e) => {
        if (e.target === apiModal) {
            apiModal.classList.add('hidden');
        }
    });

    // Salva l'API key
    saveApiBtn.addEventListener('click', () => {
        const val = apiKeyInput.value.trim();
        if (val) {
            currentApiKey = val;
            localStorage.setItem('gemini_api_key', currentApiKey);
            saveApiSuccess.classList.remove('hidden');
            setTimeout(() => {
                apiModal.classList.add('hidden');
            }, 1200);
        }
    });


    // --- INTEGRAZIONE CON GOOGLE GEMINI ---

    const fetchBookSummaryFromGemini = async (bookTitle) => {
        if (!currentApiKey) {
            throw new Error('missing_api_key');
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentApiKey}`;

        // Questo è il prompt che guida l'AI a generare la risposta esatta che desideriamo.
        const systemPrompt = `Sei un esperto di letteratura e di sintesi concettuale. 
Il tuo compito è analizzare il libro "${bookTitle}" e restituire ESATTAMENTE 4 concetti chiave essenziali espressi in quel libro.
Devi restituire i risultati UNICAMENTE in formato JSON testuale, seguendo perfettamente questa struttura:
{
  "title": "Titolo completo del libro e autore se lo conosci",
  "concepts": [
    {
      "title": "Titolo breve del concetto forte e accattivante",
      "description": "Una spiegazione approfondita del concetto in 3-4 frasi chiare e scorrevoli."
    }
  ]
}
IMPORTANTE: Restituisci SOLO l'oggetto JSON, senza tag markdown \`\`\`json e nessuna parola extra prima o dopo.`;

        const requestBody = {
            contents: [{
                parts: [{ text: systemPrompt }]
            }],
            generationConfig: {
                temperature: 0.2, // Bassa temperatura per ottenere risposte precise e coerenti con il libro
            }
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const rawData = await response.json();

            // Gestione errore dall'API di Google
            if (rawData.error) {
                console.error("Errore API Gemini:", rawData.error);
                throw new Error("api_error");
            }

            // Estrapolazione del testo generato
            let generatedText = rawData.candidates[0].content.parts[0].text;

            // Rimozione eventuale sintassi markdown che il modello potrebbe ostinatamente infilare
            generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsedData = JSON.parse(generatedText);
            return parsedData;

        } catch (error) {
            console.error(error);
            if (error.message === 'missing_api_key') throw error;
            throw new Error('parse_error');
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
            throw new Error("Formato risposta AI non valido.");
        }

        bookTitleDisplay.textContent = data.title;

        data.concepts.forEach((concept, index) => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            // Stagger animation delay per caduta a cascata
            card.style.transitionDelay = `${index * 0.15}s`;

            card.innerHTML = `
                <div class="concept-header">
                    <div class="concept-number">${index + 1}</div>
                    <h3>${concept.title}</h3>
                </div>
                <p>${concept.description}</p>
            `;

            conceptsList.appendChild(card);

            // Trigger reflow per avviare l'animazione d'ingresso dolcemente
            setTimeout(() => {
                card.classList.add('animate-in');
            }, 50);
        });

        resultsArea.classList.remove('hidden');
    };

    const showError = (type) => {
        if (type === 'missing_api_key') {
            errorMessageDisplay.innerHTML = `Oh no! Manca la Chiave API di Gemini.<br> Clicca sull'icona ingranaggio <span style="font-size: 1.2rem;">&#9881;</span> in basso a destra per inserirla!`;
        } else {
            errorMessageDisplay.innerHTML = `Si è verificato un errore nel comunicare con l'AI o comprendere la risposta.<br> Riprova tra poco o verifica se il libro esiste.`;
        }
        errorArea.classList.remove('hidden');
    };

    // Al click di Ricerca sull'App principale
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = bookInput.value.trim();
        if (!title) return;

        showLoading();

        try {
            const data = await fetchBookSummaryFromGemini(title);
            hideLoading();
            renderResults(data);
        } catch (err) {
            hideLoading();
            if (err.message === 'missing_api_key') {
                showError('missing_api_key');
            } else {
                showError('general');
            }
        }
    });

    // Se l'utente non ha la API Key al primo ingresso visivo, proviamo a richiamare un po' d'attenzione
    setTimeout(() => {
        if (!currentApiKey) {
            settingsBtn.style.transform = "scale(1.2)";
            settingsBtn.style.color = "var(--accent-primary)";
            settingsBtn.style.borderColor = "var(--accent-primary)";
            setTimeout(() => {
                settingsBtn.style.transform = "scale(1)";
                settingsBtn.style.color = "";
                settingsBtn.style.borderColor = "";
            }, 1000);
        }
    }, 2000);
});
