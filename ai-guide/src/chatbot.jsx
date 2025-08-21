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

  const txtButtons = Array.from(document.querySelectorAll("button"))
    .map((b) => b.innerText.trim())
    .filter((t) => t);

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
  const [pendingSecondPhase, setPendingSecondPhase] = useState([]);

  // Joyride
  const [joySteps, setJoySteps] = useState([]);
  const [runJoyride, setRunJoyride] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Get GPT + JSON
  // const sendMessage = async () => {
  //   if (!input.trim()) return;
  //   const userMsg = input.trim();
  //   setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
  //   setInput("");

  //   const meta = extractUIMetadata();

  //   try {
  //     const res = await axios.post("http://localhost:3000/assistant/message", {
  //       userMessage: userMsg,
  //       uiMetadata: meta
  //     });

  //     const raw = res.data.raw;
  //     let steps = [];
  //     let explanation = "";

  //     // try to parse the reply into JSON
  //     try {
  //       const obj = JSON.parse(raw);
  //       steps = obj.steps || [];
  //       explanation = obj.explanation || "";
  //     } catch (err) {
  //       // fallback - raw text
  //       explanation = raw;
  //     }

  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         role: "assistant",
  //         text: explanation,
  //         steps // attach parsed steps for later
  //       }
  //     ]);
  //   } catch (err) {
  //     console.error(err);
  //     setMessages((prev) => [
  //       ...prev,
  //       { role: "assistant", text: "Error contacting server." }
  //     ]);
  //   }
  // };

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

  // Helper: find a DOM element button with exact text
  function findButtonByText(text) {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find(
      (b) => b.innerText.trim().toLowerCase() === text.trim().toLowerCase()
    );
  }
  function findFieldByLabel(labelText) {
    const labels = Array.from(
      document.querySelectorAll(".MuiInputLabel-root, label")
    ).filter(
      (l) => l.innerText.trim().toLowerCase() === labelText.toLowerCase()
    );
    return labels[0] || null;
  }
  // Joyride starter
  const startVisualDemo = (stepsJson) => {
    console.log(stepsJson, "stepsJson");
    // Split into first click step vs. rest
    let navFound = false;
    const preNav = [];
    const postNav = [];

    stepsJson.forEach((st) => {
      if (!navFound && st.action === "click") {
        preNav.push(st);
        navFound = true;
      } else {
        postNav.push(st);
      }
    });

    // Prepare phase 1 steps (first click)
    const joyFirst = preNav.map((st) => {
      const el = findButtonByText(st.targetText);
      return {
        target: el || "body",
        content: `Step ${st.step}: Click '${st.targetText}'`,
      };
    });

    setJoySteps(joyFirst);
    setRunJoyride(true);
    setPendingSecondPhase(postNav); // store the rest
  };
  useEffect(() => {
    // If we have pending 'postNav' steps and URL changed
    if (pendingSecondPhase.length > 0) {
      // Build steps for second page:
      const secondJoySteps = pendingSecondPhase
        .map((st) => {
          if (st.action === "fill") {
            const f = findFieldByLabel(st.targetLabel);
            return {
              target: f || "body",
              content: `Fill '${st.targetLabel}'`,
            };
          }
          if (st.action === "click") {
            const b = findButtonByText(st.targetText);
            return {
              target: b || "body",
              content: `Click '${st.targetText}'`,
            };
          }
          return null;
        })
        .filter(Boolean);

      setJoySteps(secondJoySteps);
      setRunJoyride(true);
      setPendingSecondPhase([]); // clear
    }
  }, [window.location.pathname]);

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
                  {m.role === "assistant" && m.steps && m.steps.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => startVisualDemo(m.steps)}
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
