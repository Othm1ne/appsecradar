// Vite inlines every VITE_ variable into the public bundle.
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

export async function summarize(text) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: `Summarize: ${text}` }] }),
  });
  return (await res.json()).choices[0].message.content;
}
