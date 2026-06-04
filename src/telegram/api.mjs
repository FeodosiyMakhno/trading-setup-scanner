export class TelegramApi {
  constructor(token, { apiBase = "https://api.telegram.org" } = {}) {
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required.");
    this.baseUrl = `${apiBase}/bot${token}`;
  }

  async request(method, payload = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      const description = data?.description ?? `${response.status} ${response.statusText}`;
      throw new Error(`Telegram ${method} failed: ${description}`);
    }

    return data.result;
  }

  getMe() {
    return this.request("getMe");
  }

  getUpdates(options) {
    return this.request("getUpdates", options);
  }

  sendMessage(payload) {
    return this.request("sendMessage", {
      disable_web_page_preview: true,
      ...payload,
    });
  }

  editMessageText(payload) {
    return this.request("editMessageText", {
      disable_web_page_preview: true,
      ...payload,
    });
  }

  answerCallbackQuery(payload) {
    return this.request("answerCallbackQuery", payload);
  }
}
