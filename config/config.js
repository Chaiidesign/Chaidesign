// config.js
// =============================================================================
// Chat Application Configuration
// =============================================================================
// This configuration file stores metadata and descriptions related to the Chat Agent component.
// The goal is to keep the main component clean and maintainable.
//
// Key Features:
// - Stores the descriptive header for the chat component.
// - Provides metadata such as the author and version.
// - Can be extended for additional configuration settings in the future.
// =============================================================================

const chatConfig = {
  flowURL:
    "https://api.zerowidth.ai/v1/process/4qE2oEOScJgkv6JZ8FYz/3T5oWea6DieHvUUv8fpQ",
  header: {
    title: "chat with Chaitanya",
    description:
      "Greetings, I am a draft clone of Chai he must be busy thinking about something how can i help you?.",
  },
  suggestedPromptsTitle: "Here are some suggested prompts.",
  suggestedPrompts: [
    "I spend too much time with computers.",
    "I feel overwhelmed trying to keep up with AI trends.",
    "I am anxious about the future.",
    "I am anxious about the future.",
    "I am anxious about the future.",
    "I am anxious about the future.",
  ],
  chatInputPlaceholder: "Chat with this agent...",
  maxChatHeight: 200,
};

export default chatConfig;
