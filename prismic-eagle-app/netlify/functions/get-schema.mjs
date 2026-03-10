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

        const systemPrompt = `Sei un professore universitario esperto in tecniche di memorizzazione e riassunto strutturato.
Il tuo compito è creare degli APPUNTI SCHEMATICI perfetti per il ripasso rapido del libro "${bookTitle}" scritto da ${author || 'un autore'}.

L'output deve essere un riassunto a elenco puntato ben strutturato usando ESCLUSIVAMENTE markdown semplice:
- Usa i titoli "##" per dividere il testo in 3 o 4 macro-sezioni chiave (es: "1. Introduzione", "2. Temi Centrali", "3. Conclusione").
- Usa il bullet point "*" per elencare i punti importanti sotto ogni sezione.
- Usa il grassetto "**" per evidenziare le parole chiave vere e proprie.

Non dilungarti in discorsi. Sii preciso, schematico, telegrafico, per facilitare il colpo d'occhio.`;

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
