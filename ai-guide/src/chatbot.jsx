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
import axios from "axios";
import ChatIcon from "@mui/icons-material/Chat";

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

// Metadata extractor (for MUI & general UI)
function extractUIMetadata() {
  const path = window.location.pathname;
  const h1 = document.querySelector("h1,h2,h3");
  const pageTitle = (h1 ? h1.innerText : path).trim();

  // MUI Table Headers
  const columns = Array.from(document.querySelectorAll('[role="columnheader"]'))
    .map((c) => c.innerText.trim())
    .filter(Boolean);

  // Form labels (MuiInputLabel-root OR plain <label>)
  const labelEls = Array.from(
    document.querySelectorAll(".MuiInputLabel-root, label")
  );
  const formLabels = labelEls.map((l) => l.innerText.trim()).filter(Boolean);

  // visible button text
  const textButtons = Array.from(document.querySelectorAll("button"))
    .map((b) => b.innerText.trim())
    .filter((t) => t !== "");

  // Detect icon-based buttons (aria-label/title)
  const iconButtons = Array.from(document.querySelectorAll("button")).map(
    (b) => {
      const aria = b.getAttribute("aria-label") || "";
      const title = b.getAttribute("title") || "";
      return { ariaLabel: aria.trim(), title: title.trim() };
    }
  );

  return {
    pageTitle,
    currentPath: path,
    tableHeaders: columns,
    formLabels,
    textButtons,
    iconButtons,
  };
}

export default function UIAssistantModal() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef();

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    const metadata = extractUIMetadata(); // collect UI context

    try {
      const res = await axios.post("http://localhost:3000/assistant/message", {
        userMessage: userMsg,
        uiMetadata: metadata,
      });
      const reply = res.data.message;
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error contacting server." },
      ]);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
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

      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          {/* Header with close */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6">UI Assistant</Typography>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Chat history */}
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #eee",
              p: 1,
              mb: 1,
              minHeight: "200px",
            }}
          >
            {messages.length === 0 ? (
              <Typography color="text.secondary">No messages yet.</Typography>
            ) : (
              messages.map((m, i) => (
                <Box
                  key={i}
                  sx={{
                    textAlign: m.role === "user" ? "right" : "left",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      display: "inline-block",
                      bgcolor: m.role === "user" ? "#e0f7fa" : "#f2f2f2",
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                    }}
                  >
                    <b>{m.role}:</b> {m.text}
                  </Typography>
                </Box>
              ))
            )}
          </Box>

          {/* Input area */}
          <Box sx={{ display: "flex" }}>
            <TextField
              placeholder="Type..."
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
