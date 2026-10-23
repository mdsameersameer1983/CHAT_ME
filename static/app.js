(() => {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#message-input");
  const messages = document.querySelector("#messages");
  const welcome = document.querySelector("#welcome");
  const sendButton = document.querySelector("#send-button");
  const micButton = document.querySelector("#mic-button");
  const voiceToggle = document.querySelector("#voice-toggle");
  const voiceStatus = document.querySelector("#voice-status");
  const clearButtons = [document.querySelector("#clear-chat"), document.querySelector("#clear-chat-top")];
  const template = document.querySelector("#message-template");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechInputAvailable = Boolean(SpeechRecognition);
  const speechOutputAvailable = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  let history = [];
  let busy = false;
  let voiceEnabled = speechOutputAvailable;
  let recognition = null;
  let listening = false;
  let lastReply = "";

  function setVoiceStatus(text, isError = false) {
    voiceStatus.textContent = text;
    voiceStatus.classList.toggle("error", isError);
  }

  function scrollToBottom() {
    const conversation = document.querySelector("#conversation");
    conversation.scrollTop = conversation.scrollHeight;
  }

  function speak(text) {
    if (!voiceEnabled || !speechOutputAvailable) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function addMessage(role, text, isError = false) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("user", role === "user");
    node.classList.toggle("error", isError);
    node.querySelector(".message-avatar").textContent = role === "user" ? "S" : "✳";
    node.querySelector(".message-name").textContent = role === "user" ? "You" : "Chat Me";
    node.querySelector(".message-bubble").textContent = text;
    messages.appendChild(node);
    welcome.hidden = true;
    scrollToBottom();
    return node;
  }

  function showTyping() {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.add("typing-message");
    node.querySelector(".message-avatar").textContent = "✳";
    node.querySelector(".message-name").textContent = "Chat Me";
    const bubble = node.querySelector(".message-bubble");
    bubble.classList.add("typing");
    bubble.setAttribute("aria-label", "Chat Me is thinking");
    bubble.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(node);
    scrollToBottom();
    return node;
  }

  function clearChat() {
    if (busy) return;
    history = [];
    lastReply = "";
    messages.replaceChildren();
    welcome.hidden = false;
    window.speechSynthesis?.cancel();
    setVoiceStatus(listening ? "Listening... say a question or a voice command." : "Chat cleared. Tap the microphone to speak to Chat Me.");
    input.focus();
  }

  function handleVoiceCommand(transcript) {
    const command = transcript.trim().toLowerCase().replace(/[.!?]+$/g, "");
    if (/^(clear|clear the|clear my) (chat|conversation)$/.test(command)) {
      clearChat();
      setVoiceStatus("Chat cleared by voice command.");
      return true;
    }
    if (/^(stop|stop speaking|stop reading|quiet|be quiet)$/.test(command)) {
      window.speechSynthesis?.cancel();
      setVoiceStatus("Spoken reply stopped.");
      return true;
    }
    if (/^(repeat|repeat that|repeat the answer|read that again)$/.test(command)) {
      if (lastReply) speak(lastReply);
      else setVoiceStatus("There is no reply to repeat yet.");
      return true;
    }
    return false;
  }

  async function sendMessage(value) {
    const message = value.trim();
    if (!message || busy) return;
    busy = true;
    setVoiceStatus("Thinking through that...");
    input.value = "";
    input.style.height = "auto";
    addMessage("user", message);
    sendButton.disabled = true;
    input.disabled = true;
    micButton.disabled = true;
    const typing = showTyping();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })
      });
      const data = await response.json().catch(() => ({}));
      typing.remove();
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("I didn't receive a reply. Please try again.");
      addMessage("model", data.reply);
      history.push({ role: "user", text: message }, { role: "model", text: data.reply });
      history = history.slice(-12);
      lastReply = data.reply;
      if (voiceEnabled) speak(data.reply);
    } catch (error) {
      typing.remove();
      addMessage("model", error.message || "I couldn't connect just now. Please try again.", true);
      setVoiceStatus(error.message || "I couldn't connect just now.", true);
    } finally {
      busy = false;
      sendButton.disabled = false;
      input.disabled = false;
      micButton.disabled = !recognition;
      input.focus();
      if (!voiceStatus.classList.contains("error")) {
        const idleStatus = speechInputAvailable
          ? "Tap the microphone to speak to Chat Me."
          : "Voice input is not supported here. You can keep typing.";
        setVoiceStatus(listening ? "Listening..." : idleStatus, !speechInputAvailable);
      }
    }
  }

  function startListening() {
    if (!recognition || listening || busy) return;
    try {
      recognition.start();
    } catch (_) {
      setVoiceStatus("Voice input could not start. Please try again.", true);
    }
  }

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      listening = true;
      micButton.classList.add("listening");
      micButton.setAttribute("aria-label", "Stop voice input");
      setVoiceStatus("Listening... say a question, “clear chat”, “repeat that”, or “stop speaking”.");
    };
    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
        isFinal = isFinal || event.results[i].isFinal;
      }
      input.value = transcript;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
      if (isFinal) {
        if (handleVoiceCommand(transcript)) {
          input.value = "";
          input.style.height = "auto";
        } else {
          sendMessage(transcript);
        }
      }
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Microphone access is blocked. Allow it in your browser settings."
        : event.error === "no-speech"
          ? "I didn't hear anything. Tap the microphone and try again."
          : "Voice input had a problem. Please try again.";
      setVoiceStatus(message, true);
    };
    recognition.onend = () => {
      listening = false;
      micButton.classList.remove("listening");
      micButton.setAttribute("aria-label", "Start voice input");
      if (!busy && !voiceStatus.classList.contains("error")) setVoiceStatus("Tap the microphone to speak to Chat Me.");
    };
    micButton.addEventListener("click", () => listening ? recognition.stop() : startListening());
  } else {
    micButton.disabled = true;
    micButton.title = "Voice input is not supported in this browser";
    setVoiceStatus("Voice input is not supported here. Try a recent version of Chrome or Edge.", true);
  }

  voiceToggle.addEventListener("click", () => {
    if (!speechOutputAvailable) return;
    voiceEnabled = !voiceEnabled;
    voiceToggle.textContent = voiceEnabled ? "Voice on" : "Voice off";
    voiceToggle.setAttribute("aria-pressed", String(voiceEnabled));
    voiceToggle.title = voiceEnabled ? "Turn spoken replies off" : "Turn spoken replies on";
    if (!voiceEnabled) window.speechSynthesis?.cancel();
    setVoiceStatus(voiceEnabled ? "Spoken replies are on." : "Spoken replies are off.");
  });
  if (!speechOutputAvailable) {
    voiceToggle.disabled = true;
    voiceToggle.textContent = "Voice unavailable";
    voiceToggle.setAttribute("aria-pressed", "false");
    voiceToggle.title = "Spoken replies are not supported in this browser";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  clearButtons.forEach((button) => button.addEventListener("click", clearChat));
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  });
})();



