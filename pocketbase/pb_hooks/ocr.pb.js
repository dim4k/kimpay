// =============================================================================
// OCR Receipt Scanner (Gemini Flash Vision)
// =============================================================================

routerAdd(
    "POST", 
    "/api/ocr/receipt", 
    (e) => {
        try {
            const authRecord = e.auth;
            if (!authRecord) {
                return e.json(401, { message: "Authentication required" });
            }
            
            const userId = authRecord.id;

            // Rate limiting: 5 requests per minute per user
            const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
            if (!checkRateLimit(`ocr_rate_${userId}`, 5, 60 * 1000)) {
                return e.json(429, { message: "Too many requests. Please wait a minute." });
            }

            // Parse request body
            const data = new DynamicModel({
                image: "",
                language: ""
            });

            try {
                e.bindBody(data);
            } catch (err) {
                return e.json(400, { message: "Invalid JSON body" });
            }

            if (!data.image) {
                return e.json(400, { message: "Missing image data" });
            }

            const apiKey = process.env.GEMINI_API_KEY || $os.getenv("GEMINI_API_KEY");
            if (!apiKey) {
                return e.json(500, { message: "OCR service not configured" });
            }

            // Target language of the description: the app's languages (default English)
            const languages = { en: "English", fr: "French", de: "German", es: "Spanish", pt: "Portuguese" };
            const targetLang = languages[String(data.language).slice(0, 2).toLowerCase()] || "English";

            const prompt = `Analyze this receipt/invoice image and extract:
1. A short description (store name + main category, max 50 chars) - TRANSLATE TO ${targetLang}
2. The total amount (TTC/final amount including taxes)
3. The currency (ISO code like EUR, USD, GBP)
4. A single emoji that best represents the expense category (food=🍽️, coffee=☕, grocery=🛒, transport=🚗, hotel=🏨, shopping=🛍️, etc.)
5. The date on the receipt (format: YYYY-MM-DD), or null if not visible

Respond ONLY with valid JSON in this exact format:
{"description": "Store - Category", "amount": 12.34, "currency": "EUR", "emoji": "🍽️", "date": "2024-12-20"}

If you cannot read the receipt clearly, respond with:
{"error": "unreadable"}`;

            // A data URL ("data:image/png;base64,...") tells the image type: the
            // app only re-encodes large photos (to JPEG), smaller ones are sent as is.
            const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
            let imageBase64 = data.image;
            let mimeType = "image/jpeg";
            const dataUrl = /^data:([^;,]+);base64,/.exec(imageBase64);
            if (dataUrl) {
                if (imageTypes.indexOf(dataUrl[1].toLowerCase()) === -1) {
                    return e.json(400, { message: "Unsupported image type" });
                }
                mimeType = dataUrl[1].toLowerCase();
            }
            if (imageBase64.includes(",")) {
                imageBase64 = imageBase64.split(",")[1];
            }

            const geminiBody = {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    // temperature is ignored on Gemini 3.x (and rejected by future models)
                    responseMimeType: "application/json",
                    // Thinking tokens count against this limit (3.6 Flash thinks at "medium" by default)
                    maxOutputTokens: 4096
                }
            };

            // Use lite model by default (cheaper), fallback to flash if needed
            const models = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];
            let response = null;
            let lastError = null;

            for (const model of models) {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

                response = $http.send({
                    url: geminiUrl,
                    method: "POST",
                    // Key in a header, not the URL: URLs end up in proxy/error logs.
                    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                    body: JSON.stringify(geminiBody),
                    timeout: 30
                });

                if (response.statusCode === 200) {
                    break; // Success, use this response
                }

                if (response.statusCode === 429) {
                    lastError = "quota";
                    continue; // Try next model
                }

                // Other error, don't retry
                return e.json(502, { message: "OCR service error" });
            }

            if (response.statusCode !== 200) {
                return e.json(502, { message: lastError === "quota" ? "OCR quota exceeded. Try again later." : "OCR service error" });
            }

            // Parse Gemini response
            const geminiResult = JSON.parse(response.raw);
            // Gemini 3.x may return several parts (thought signatures, thoughts): keep the answer text only
            const parts = geminiResult.candidates?.[0]?.content?.parts || [];
            const textContent = parts.filter(p => p.text && !p.thought).map(p => p.text).join("");

            if (!textContent) {
                return e.json(502, { message: "Invalid response from OCR service" });
            }

            // Extract JSON from markdown code blocks
            let jsonStr = textContent;
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
            
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            const parsedResult = JSON.parse(jsonStr);

            if (parsedResult.error) {
                return e.json(422, { message: "Could not read receipt", error: parsedResult.error });
            }

            return e.json(200, {
                description: parsedResult.description || "",
                amount: parseFloat(parsedResult.amount) || 0,
                currency: parsedResult.currency || "EUR",
                emoji: parsedResult.emoji || null,
                date: parsedResult.date || null
            });

        } catch (err) {
            return e.json(500, { message: "Internal server error" });
        }
    }, 
    $apis.requireAuth()
);
