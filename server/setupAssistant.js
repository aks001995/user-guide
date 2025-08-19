// setupAssistant.js
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// async function uploadFile(filePath) {
//   const readable = fs.createReadStream(filePath);
//   const response = await openai.files.create({
//     file: readable,
//     purpose: 'assistants'
//   });
//   console.log('Uploaded:', filePath, '=>', response.id);
//   return response.id;
// }

async function uploadFile(filePath) {
  let uploadPath = filePath;

  // Convert .jsx files to .js extension temporarily
  if (filePath.endsWith('.jsx')) {
    const jsCopy = filePath.replace(/\.jsx$/, '.js');
    fs.copyFileSync(filePath, jsCopy);
    uploadPath = jsCopy;
  }

  const readable = fs.createReadStream(uploadPath);
  const response = await openai.files.create({
    file: readable,
    purpose: 'assistants'
  });

  // Clean up temporary js copy if created
  if (filePath.endsWith('.jsx')) {
    fs.unlinkSync(uploadPath);
  }

  console.log('Uploaded:', filePath, '=>', response.id);
  return response.id;
}


async function main() {
  const srcFolder = path.resolve('../ai-guide/src'); // adjust path if needed
  const filesInSrc = fs.readdirSync(srcFolder);

  const fileIds = [];
  for (let filename of filesInSrc) {
    const fullPath = path.join(srcFolder, filename);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const fileId = await uploadFile(fullPath);
      fileIds.push(fileId);
    }
  }

  // Create the Assistant with retrieval tool
  const assistant = await openai.beta.assistants.create({
    name: "UI React Assistant",
    model: "gpt-4o-mini",
    // tools: [{ type: "retrieval" }],
    tools: [{ type: "file_search" }],
    description: "Helps users understand the UI and code"
  });

  console.log("\nAssistant created!");
  console.log("Assistant ID:", assistant.id);
  console.log("Uploaded File IDs:", fileIds);
}

main().catch(console.error);
