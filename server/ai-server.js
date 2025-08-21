import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/assistant/message", async (req, res) => {
  try {
    const { userMessage, uiMetadata } = req.body;
    // Build a user-friendly context string:
    let summary = `Route: ${uiMetadata.currentPath}. Page: ${uiMetadata.pageTitle}. `;
    if (uiMetadata.tableHeaders.length > 0)
      summary += `Table columns: ${uiMetadata.tableHeaders.join(", ")}. `;
    if (uiMetadata.formLabels.length > 0)
      summary += `Form fields: ${uiMetadata.formLabels.join(", ")}. `;
    if (uiMetadata.textButtons.length > 0)
      summary += `Visible buttons: ${uiMetadata.textButtons.join(", ")}. `;
    const iconLabels = uiMetadata.iconButtons
      .filter((b) => b.ariaLabel !== "")
      .map((b) => b.ariaLabel);
    if (iconLabels.length > 0)
      summary += `Icon buttons: ${iconLabels.join(", ")}. `;

    const prompt = `
${summary}
User asked: "${userMessage}"
Please respond with step-by-step actions the user should take within this UI.
Be specific: mention which button or icon to click, or which field to fill.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a UI assistant for a web application UI." },
        { role: "user", content: prompt }
      ]
    });

    const answer = response.choices[0].message.content;
    res.json({ message: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to call Chat API" });
  }
});

const PORT = 3000;
// Binding to 0.0.0.0 is optional
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);


