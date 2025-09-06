export const chatService = {
  async processMessage(message: string): Promise<string> {
    // Your business logic here, e.g., sanitize, store, broadcast
    return `Processed chat message: ${message}`;
  },
};
