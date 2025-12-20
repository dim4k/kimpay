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
            // Using $app.store() for persistent storage across requests
            const rateLimitKey = `ocr_rate_${userId}`;
            const now = Date.now();
            const windowMs = 60 * 1000; // 1 minute
            const maxRequests = 5;
            
            let rateData = $app.store().get(rateLimitKey);
            if (!rateData || typeof rateData !== "object") {
                rateData = { windowStart: now, count: 0 };
            }
            
            // Reset window if expired
            if (now - rateData.windowStart > windowMs) {
                rateData = { windowStart: now, count: 0 };
            }
            
            if (rateData.count >= maxRequests) {
                return e.json(429, { message: "Too many requests. Please wait a minute." });
            }
            
            rateData.count++;
            $app.store().set(rateLimitKey, rateData);

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

            // Get target language from request (default to English)
            const targetLang = data.language === "fr" ? "French" : "English";

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

            let imageBase64 = data.image;
            if (imageBase64.includes(",")) {
                imageBase64 = imageBase64.split(",")[1];
            }

            const geminiBody = {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: imageBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1024
                }
            };

            // Use lite model by default (cheaper), fallback to flash if needed
            const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
            let response = null;
            let lastError = null;

            for (const model of models) {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                
                response = $http.send({
                    url: geminiUrl,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
            const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

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
