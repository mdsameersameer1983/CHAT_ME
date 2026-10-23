import os

from flask import Flask, jsonify, render_template, request
from google import genai
from google.genai import types

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
SYSTEM_INSTRUCTION = (
    "You are Chat Me, a friendly, capable general-purpose AI assistant. "
    "Help with questions, writing, brainstorming, explanations, planning, and problem solving. "
    "Be clear, accurate, thoughtful, and concise; adapt your depth to the user's needs. "
    "Ask a short clarifying question when essential information is missing. "
    "Be honest when you are uncertain, and never claim to have taken an action you did not take."
)
MAX_TURNS = 12
MAX_MESSAGE_LENGTH = 4000


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "That request is too large. Please shorten your message and try again."}), 413


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send a valid JSON object with your message."}), 400
    message = payload.get("message", "")
    history = payload.get("history", [])

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Write a question before sending."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": "That message is too long. Please shorten it."}), 400
    if not isinstance(history, list):
        return jsonify({"error": "The chat history was invalid. Please clear the chat and try again."}), 400

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Chat Me is not configured yet. Add GEMINI_API_KEY in your Render environment variables."}), 503

    # Keep only recent, valid turns to limit request size and reject arbitrary payloads.
    contents = []
    for turn in history[-MAX_TURNS:]:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        text = turn.get("text")
        if role in ("user", "model") and isinstance(text, str) and text.strip():
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text[:MAX_MESSAGE_LENGTH])]))
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message.strip())]))

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                max_output_tokens=1200,
            ),
        )
        answer = (response.text or "").strip()
        if not answer:
            return jsonify({"error": "I could not form a response just now. Please try asking in a different way."}), 502
        return jsonify({"reply": answer})
    except Exception:
        app.logger.exception("Gemini request failed")
        return jsonify({"error": "Chat Me could not connect right now. Please try again in a moment."}), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)




