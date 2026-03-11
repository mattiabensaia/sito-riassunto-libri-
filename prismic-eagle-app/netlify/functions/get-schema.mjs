// netlify/functions/get-schema.mjs

export const handler = async (event, context) => {
    // Gestione chiamate CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const data = JSON.parse(event.body);
        const { bookTitle, author } = data;

        if (!bookTitle) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Titolo libro mancante' }) };
        }

        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Configurazione Server Mancante' }) };
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

        const systemPrompt = `Sei un esperto creatore di mappe concettuali.
Il tuo compito è creare i dati per disegnare una mappa mentale ad albero del libro "${bookTitle}" scritto da ${author || 'Sconosciuto'}.

DEVI RISPONDERE ESCLUSIVAMENTE CON UN OGGETTO JSON. Non inserire markdown, backticks o altro test fuori dal JSON.
Il JSON deve avere ESATTAMENTE questa struttura, con ESATTAMENTE questi 5 rami fissi per avere il miglior riassunto schematico possibile, non aggiungere "astrazioni filosofiche":
{
  "root": "Titolo Breve Libro",
  "branches": [
    {
      "title": "Personaggi Principali",
      "nodes": ["Protagonista (ruolo)", "Antagonista (ruolo)", "Personaggio Modello", "Aiutante"]
    },
    {
      "title": "Sintesi della Trama",
      "nodes": ["L'inizio", "Lo sviluppo", "Il colpo di scena", "La conclusione"]
    },
    {
      "title": "Tematiche Chiave",
      "nodes": ["Tema forte 1", "Tema 2", "Tema 3"]
    },
    {
      "title": "Contesto e Ambientazione",
      "nodes": ["Epoca storica", "Luogo principale", "Atmosfera generale"]
    },
    {
      "title": "Insegnamento e Morale",
      "nodes": ["Cosa si impara 1", "Riflessione 2", "Messaggio finale"]
    }
  ]
}
Ogni array "nodes" deve avere al massimo 4 concetti iper-sintetici legati al libro specifico.`;

        const requestBody = {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.3 }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (rawData.error) {
            return { statusCode: 502, body: JSON.stringify({ error: 'Errore AI Schema' }) };
        }

        const generatedText = rawData.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ schema: generatedText })
        };

    } catch (error) {
        console.error("Errore Backend Schema:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Errore Server Interno' }) };
    }
};
