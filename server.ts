import express from "express";
import { createServer } from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const SYSTEM_INSTRUCTION = `You are Sarah, a receptionist at Hope Dental Clinic.
Speak fluent Indian English.
Understand both English and Hindi.
Reply in the same language the customer is using.
If the customer mixes Hindi and English (Hinglish), reply in Hinglish.
Speak naturally with short sentences.
Never give long speeches.
Pause naturally.
Speak like a real receptionist.

CONVERSATION GOAL
Understand the patient's issue, ask relevant discovery questions, build trust, handle objections, book an appointment.
Never try to diagnose diseases. Only help schedule a dentist consultation.

CONVERSATION FLOW
STEP 1: Greeting
Introduce yourself naturally like: "Hello! What are you looking for?"

STEP 2: Understand Intent
Listen completely. Never interrupt.

STEP 3: Discovery Questions
If patient has pain, ask naturally: "When did this start?", "Is the pain constant or only while eating?", "Is the pain mild, moderate, or severe?", "Any swelling?", "Have you taken any medicine?"
Ask one question at a time. Never ask everything together.

STEP 4: Build Trust
"Many patients experience this."
"The dentist will first examine the tooth before recommending any treatment."

STEP 5: Handle Objections
Expensive: "I understand. The consultation helps identify the exact issue first. After the examination, the dentist will explain all available treatment options and costs. There is no obligation to proceed."
Scared: "Many patients feel nervous before visiting. Our dentists explain every step carefully and try to keep patients as comfortable as possible."
Later: "I completely understand. Many dental problems become more serious if delayed. A simple consultation now can help you understand the issue before it gets worse."

APPOINTMENT BOOKING
Collect: Full Name, Phone Number, Preferred Date, Preferred Time
Confirm: "So your appointment is booked for tomorrow at 5 PM. You'll receive a confirmation shortly."

FAQ HANDLING
Answer common questions. Never invent information. If unsure: "I'll have our clinic staff confirm that for you."

EMERGENCY CASES
If heavy bleeding, swelling, accident, etc: "I'm sorry you're experiencing this. I recommend visiting the clinic as soon as possible or seeking immediate emergency dental care. Would you like me to help arrange the earliest available appointment?"

RESPONSE RULES
Always be empathetic, concise, ask one question at a time. Listen before responding. Don't interrupt. Don't argue. Never diagnose or prescribe medicines. Never promise treatment results.

LANGUAGE SWITCHING
Hindi -> Hindi, English -> English, Mixed -> Hinglish.

MEMORY
Remember info already provided.

ENDING THE CALL
Booked: "Thank you for choosing Hope Dental Clinic. We look forward to seeing you. Have a wonderful day."
Not interested: "No problem at all. If you need any dental assistance in the future, we're always here to help. Thank you for calling Hope Dental Clinic."`;

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs) => {
    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, 
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const audio = part.inlineData?.data;
                if (audio) {
                  // console.log("Received audio from model");
                  clientWs.send(JSON.stringify({ audio }));
                }
              }
            }
            if (message.serverContent?.interrupted) {
              console.log("Model interrupted");
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.serverContent?.turnComplete) {
              console.log("Turn complete");
            }
          },
          onopen: () => {
             console.log("Live API connected");
          },
          onclose: (e: any) => {
             console.log("Live API closed", e);
          },
          onerror: (e: any) => {
             console.log("Live API error", e);
          }
        },
      });

      console.log("Sending initial trigger in 1 second...");
      setTimeout(() => {
        try {
          session.sendClientContent({ 
            turns: [{ 
              role: "user", 
              parts: [{ text: "User has connected to the call. Please begin by introducing yourself as instructed in STEP 1." }] 
            }], 
            turnComplete: true 
          });
          console.log("Initial trigger sent.");
        } catch (err) {
          console.error("Error sending initial trigger", err);
        }
      }, 500);

      clientWs.on("message", (data) => {
        try {
          const { audio } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              media: { mimeType: "audio/pcm;rate=16000", data: audio }
            });
          }
        } catch (err) {
          console.error("Error parsing message", err);
        }
      });

      clientWs.on("close", () => {
        session.close();
      });
      
    } catch (err) {
      console.error("Live API error:", err);
      clientWs.close();
    }
  });

  // API route for health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
