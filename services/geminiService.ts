import { GoogleGenAI } from "@google/genai";

// Guideline: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`.
// The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
// We assume it is available via the define plugin in vite.config.ts.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDogSnapshot = async (base64Image: string): Promise<string> => {
  try {
    // Strip the data URL prefix if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const modelId = "gemini-2.5-flash"; 
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: "This is a security camera feed from a dog door. Analyze this image briefly. Is there a dog present? If so, describe its behavior (e.g., waiting, sleeping, barking, playing) and estimate if it wants to go out. Keep it under 50 words.",
          },
        ],
      },
    });

    // The GenerateContentResponse object features a `text` property that directly returns the string output.
    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error analyzing image. Please try again.";
  }
};