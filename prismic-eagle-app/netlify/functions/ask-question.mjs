// netlify/functions/ask-question.mjs

export const handler = async (event, context) => {
    // Gestione chiamate "pre-flight" CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const data = JSON.parse(event.body);
        const { question, bookTitle, author } = data;

        if (!question || !bookTitle) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Parametri mancanti' }) };
        }

        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Configurazione Server Mancante' }) };
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

        const systemPrompt = `Sei un esperto letterario molto colloquiale e amichevole.
L'utente sta attualmente visualizzando una sintesi del libro "${bookTitle}" scritto da ${author || 'un autore'}.
Ha un forte dubbio e ti ha posto la seguente domanda: "${question}".
Rispondi in modo cordiale, esauriente e avvincente in circa 2-4 paragrafi, rimanendo perfettamente nel contesto del libro fornito.
Usa una formattazione testuale piana. Se pertinente aggiungi qualche emoji al testo. Non inventare se il libro non lo specifica.`;

        const requestBody = {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.4 }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (rawData.error) {
            return { statusCode: 502, body: JSON.stringify({ error: 'Errore AI Chat' }) };
        }

        const generatedText = rawData.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ answer: generatedText })
        };

    } catch (error) {
        console.error("Errore Backend Chat:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Errore Server Interno' }) };
    }
};
