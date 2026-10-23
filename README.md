# Chat Me

A friendly, responsive AI assistant powered by the Gemini API. The Gemini key is read from the `GEMINI_API_KEY` environment variable; it is not stored in this project.

## Run locally

1. Install Python 3.10 or newer.
2. Install dependencies: `pip install -r requirements.txt`
3. Set `GEMINI_API_KEY` in your terminal environment.
4. Start the app with `python app.py` (development) or `gunicorn app:app` (production).
5. Open `http://localhost:5000`.

PowerShell example for the current terminal session:

```powershell
$env:GEMINI_API_KEY = "your-key-here"
python app.py
```

## Deploy on Render

1. Create a new **Web Service** in the Render Dashboard and connect the repository containing this folder (or upload/push the project to a Git provider first).
2. Set **Root Directory** to `CHAT_ME` if this folder is inside a larger repository. Leave it blank if this project folder is the repository root.
3. Set **Build Command** to `pip install -r requirements.txt`.
4. Set **Start Command** to `gunicorn app:app`.
5. In the service's **Environment** settings, add `GEMINI_API_KEY` and paste your Gemini API key as its value. Save and deploy. Do not put the key in `app.py` or commit it to source control.
6. Optionally add `GEMINI_MODEL` to choose another model available to your API key. The default is `gemini-3.8-flash`.

The requirements include Gunicorn for the production Flask/WSGI service and Uvicorn explicitly (`uvicorn==0.35.0`). This app uses Gunicorn for the Render start command because Flask is served here as a WSGI app.

## Features

- Modern responsive chat layout with a welcome screen and suggested prompts
- User and assistant message bubbles, typing indicator, and automatic scroll
- Conversation context for recent messages
- Clear-chat control and friendly API error messages
- `/health` endpoint for a basic service health check
- Invalid JSON and oversized request handling

## Voice controls

Use the microphone button to dictate a question. Chat Me can also read its replies aloud; use **Voice on/off** to control speech. While the microphone is listening, say **“clear chat”**, **“repeat that”**, or **“stop speaking”** for voice commands. Microphone input requires browser permission and is available in browsers that support Web Speech recognition (such as current Chrome or Edge); deployed sites need HTTPS. If voice input is unavailable, typed chat still works.




