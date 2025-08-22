import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Modal,
  Box,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChatIcon from "@mui/icons-material/Chat";
import Joyride from "react-joyride";
import axios from "axios";

const modalStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 450,
  bgcolor: "white",
  border: "1px solid #ccc",
  boxShadow: 24,
  p: 2,
  display: "flex",
  flexDirection: "column",
  maxHeight: "80vh",
};

// Converts plain-text instructions into Joyride steps (best-effort)
function parsePlainTextSteps(text) {
  const steps = [];
  const sentences = text
    .split(/[.]/)
    .map((s) => s.trim())
    .filter(Boolean);

  sentences.forEach((sent) => {
    // Click detection
    if (sent.toLowerCase().includes("click")) {
      let target = "";
      const match = sent.match(/"([^"]+)"/); // text in quotes
      if (match) target = match[1];
      if (target) {
        steps.push({
          step: steps.length + 1,
          action: "click",
          targetText: target,
        });
      }
    }
    // Fill/Enter detection
    if (
      sent.toLowerCase().includes("fill") ||
      sent.toLowerCase().includes("enter")
    ) {
      const match = sent.match(/"([^"]+)"/);
      if (match) {
        steps.push({
          step: steps.length + 1,
          action: "fill",
          targetLabel: match[1],
        });
      }
    }
  });
  return steps;
}

// Extract UI metadata (MUI-aware)
function extractUIMetadata() {
  const path = window.location.pathname;
  const h1 = document.querySelector("h1,h2,h3");
  const pageTitle = (h1 ? h1.innerText : path).trim();

  const cols = Array.from(document.querySelectorAll('[role="columnheader"]'))
    .map((c) => c.innerText.trim())
    .filter(Boolean);

  const labels = Array.from(
    document.querySelectorAll(".MuiInputLabel-root, label")
  )
    .map((l) => l.innerText.trim())
    .filter(Boolean);
  const excludedButtons = ["SHOW VISUAL DEMO", "SEND"];
  const txtButtons = Array.from(document.querySelectorAll("button"))
    .map((b) => b.innerText.trim())
    .filter((t) => t && !excludedButtons.includes(t.toUpperCase()));
  // const txtButtons = Array.from(document.querySelectorAll("button"))
  //   .map((b) => b.innerText.trim())
  //   .filter((t) => t);

  const icons = Array.from(document.querySelectorAll("button")).map((b) => {
    const aria = b.getAttribute("aria-label") || "";
    return { ariaLabel: aria.trim() };
  });

  return {
    currentPath: path,
    pageTitle,
    tableHeaders: cols,
    formLabels: labels,
    textButtons: txtButtons,
    iconButtons: icons,
  };
}

export default function ChatAssistantModal() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef();

  // Joyride
  const [joySteps, setJoySteps] = useState([]);
  const [runJoyride, setRunJoyride] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    const meta = extractUIMetadata();

    try {
      const res = await axios.post("http://localhost:3000/assistant/message", {
        userMessage: userMsg,
        uiMetadata: meta,
      });

      // Always read res.data.raw if provided
      const raw = res.data.raw || res.data.message || res.data;
      let steps = [];
      let explanation = "";

      try {
        const parsed = JSON.parse(raw);
        steps = parsed.steps || [];
        explanation = parsed.explanation || "";
      } catch (err) {
        // Plain text fallback:
        explanation = raw;
        steps = parsePlainTextSteps(raw); // << Convert plain text into steps array
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: explanation, steps },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error contacting server." },
      ]);
    }
  };

  // Generic element finder by text
  function findElementByText(text) {
    // if (!text) return { element: document.body, actionType: "click" };

    const lowerText = text.toLowerCase().trim();

    // 1. Try buttons (by text or aria-label)
    const buttonEl = Array.from(document.querySelectorAll("button")).find(
      (b) =>
        b.innerText.trim().toLowerCase() === lowerText ||
        (b.getAttribute("aria-label") || "").trim().toLowerCase() === lowerText
    );
    if (buttonEl) return { element: buttonEl, actionType: "click" };

    // 2. Try links <a>
    const linkEl = Array.from(document.querySelectorAll("a")).find(
      (a) => a.innerText.trim().toLowerCase() === lowerText
    );
    if (linkEl) return { element: linkEl, actionType: "click" };

    // 3. Try input fields / textfields using associated labels
    const labelEl = Array.from(
      document.querySelectorAll("label, .MuiInputLabel-root")
    ).find((l) => l.innerText.trim().toLowerCase() === lowerText);
    if (labelEl) {
      // Look for input/textarea/select inside same parent
      const inputEl = labelEl.parentElement.querySelector(
        "input, textarea, select"
      );
      return { element: inputEl || labelEl, actionType: "fill" };
    }

    // fallback
    return { element: document.body, actionType: "click" };
  }

  // Usage in startVisualDemo
  const startVisualDemo = (stepsJson) => {
    handleClose();
    const joySteps = stepsJson.map((st) => {
      const targetText = st.targetText || st.targetLabel || "";
      const { element, actionType } = findElementByText(targetText);

      return {
        target: element,
        content: `Step ${st.step}: ${
          actionType === "click" ? "Click" : "Fill"
        } '${targetText}'`,
        disableBeacon: true,
        placement: "bottom",
      };
    });

    setJoySteps(joySteps);
    setRunJoyride(true);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating chat bubble */}
      <Button
        variant="contained"
        onClick={handleOpen}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          borderRadius: "50%",
          minWidth: "56px",
          minHeight: "56px",
        }}
      >
        <ChatIcon />
      </Button>

      {/* Joyride Component */}
      <Joyride
        steps={joySteps}
        run={runJoyride}
        continuous
        showSkipButton
        showProgress
        styles={{
          options: {
            zIndex: 99999, // Ensure the entire Joyride layer is on top
          },
          spotlight: {
            zIndex: 100000, // Keep spotlight above headers/sidebars
          },
          beacon: {
            zIndex: 100001, // Ensure the beacon/marker is always visible
          },
          tooltip: {
            zIndex: 100002, // Ensure tooltip text stays above everything
          },
        }}
        callback={(data) => {
          if (data.status === "finished" || data.status === "skipped") {
            setRunJoyride(false); // end tour
          }
        }}
      />

      {/* Chat Modal */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6">UI Assistant</Typography>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Chat history */}
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", mb: 1, p: 1 }}>
            {messages.map((m, idx) => (
              <Box
                key={idx}
                sx={{
                  textAlign: m.role === "user" ? "right" : "left",
                  mb: 1,
                }}
              >
                <Box
                  sx={{
                    display: "inline-block",
                    bgcolor: m.role === "user" ? "#e0f7fa" : "#f5f5f5",
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    maxWidth: "75%",
                    textAlign: "left",
                  }}
                >
                  <Typography variant="body2">
                    <b>{m.role === "user" ? "User" : "Assistant"}:</b> {m.text}
                  </Typography>

                  {/* If assistant message has steps, show link */}
                  {/* {m.role === "assistant" && m.steps && m.steps.length > 0 && ( */}
                  {m.role === "assistant" && (
                    <Button
                      size="small"
                      onClick={() => startVisualDemo(m.steps, m.text)}
                      sx={{ mt: 0.5 }}
                    >
                      Show Visual Demo
                    </Button>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Input + Send */}
          <Box sx={{ display: "flex" }}>
            <TextField
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              size="small"
            />
            <Button onClick={sendMessage} sx={{ ml: 1 }}>
              Send
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
