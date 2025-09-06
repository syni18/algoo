export const chatService = {
  async processMessage(message: string): Promise<string> {
    await Promise.resolve(); // dummy await to satisfy ESLint
    return `Processed chat message: ${message}`;
  },
};
