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

DEVI RISPONDERE ESCLUSIVAMENTE CON UN OGGETTO JSON. Non inserire markdown, backticks o altro testo fuori dal JSON.
La struttura del JSON deve essere ESATTAMENTE questa:
{
  "root": "Titolo Breve Libro",
  "branches": [
    {
      "title": "Tema o Capitolo 1",
      "nodes": ["Concetto chiave 1", "Concetto 2"]
    },
    {
      "title": "Tema 2",
      "nodes": ["Dettaglio 1", "Dettaglio 2"]
    }
  ]
}
Assicurati di creare massimo 5 branches, e per ogni branch massimo 4 nodes super-sintetici.`;

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
