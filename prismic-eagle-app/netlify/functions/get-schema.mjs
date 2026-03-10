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

        const systemPrompt = `Sei un professore universitario esperto in tecniche di memorizzazione visiva e mappe mentali.
Il tuo compito è creare una MAPPA CONCETTUALE testuale perfetta per afferrare la struttura del libro "${bookTitle}" scritto da ${author || 'un autore'}.

L'output deve essere un riassunto a elenco gerarchico puntato ben strutturato usando ESCLUSIVAMENTE markdown semplice:
- Usa i titoli "##" per dividere i rami principali della mappa (es: "1. Tema Centrale", "2. Evoluzione dei Personaggi", "3. Conflitto Principale").
- Usa il bullet point "*" per elencare i sotto-nodi o concetti collegati sotto ogni ramo.
- Usa il grassetto "**" per evidenziare i concetti chiave veri e propri.

Non dilungarti in discorsi lunghi. Sii iper-sintetico, schematico e visivo (simula una mappa ad albero testuale), per facilitare la memorizzazione a colpo d'occhio.`;

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
