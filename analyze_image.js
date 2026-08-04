import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const imageBytes = fs.readFileSync("images/URTC_FLASHER_V1_1.png");
  const response = await ai.models.generateContent({
    model: "gemini-pro-latest",
    contents: [
      "Describe the UI of this application in detail. List all sections, buttons, inputs, dropdowns, labels, and status information shown. Please be extremely detailed about every single element present in this 'Flasher' application window.",
      {
        inlineData: {
          mimeType: "image/png",
          data: imageBytes.toString("base64")
        }
      }
    ]
  });
  console.log(response.text);
}
main().catch(console.error);
