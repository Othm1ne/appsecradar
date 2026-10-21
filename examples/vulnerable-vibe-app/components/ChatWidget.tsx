"use client";

import { useState } from "react";

// FAKE demo key: appsecradar should flag this.
const OPENAI_API_KEY = "sk-proj-DEMO0000fake0000key0000for0000appsecradar0000";

export default function ChatWidget() {
  const [answer, setAnswer] = useState("");

  async function ask(question: string) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }],
      }),
    });
    const data = await res.json();
    setAnswer(data.choices[0].message.content);
  }

  return (
    <div>
      <button onClick={() => ask("Hello!")}>Ask</button>
      <p>{answer}</p>
    </div>
  );
}
