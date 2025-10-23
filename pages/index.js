// =============================================================================
// Chat Agent with User & Agent Bubbles (React + Vercel)
//
// This React component renders a chat interface where users can type messages
// and receive responses from an agent via a serverless API endpoint on Vercel.
// Messages are displayed in styled chat bubbles to clearly differentiate between
// user messages (right-aligned) and agent messages (left-aligned).
//
// Key Features:
// - Maintains a conversation history.
// - Displays each message in a styled bubble.
// - Sends user messages to the API and appends the agent's response (rendered as Markdown) to the chat.
// - Automatically scrolls to the latest message in a scrollable parent container.
// - Animates the submit button while the agent is "thinking".
// - Provides detailed comments for ease of understanding.
//
// Author: Thomas J McLeish
// Date: March 2, 2025
// =============================================================================

// Import the chat configuration settings.
// includes the header title, description, and suggested prompts.
import chatConfig from "../config/config";
// Import React hooks for managing state and side effects.
import { useState, useEffect, useRef } from "react";
// Import react-markdown to render markdown content.
import ReactMarkdown from "react-markdown";
// Import UUID to generate session ID
import { v4 as uuidv4 } from "uuid";

/**
 * Retrieves or generates a session ID and stores it in sessionStorage.
 * Ensures it only runs on the client side and limits it to 32 characters.
 * @returns {string} The session ID.
 */
const getSessionId = () => {
  if (typeof window === "undefined") return ""; // Prevent SSR issues

  let sessionId = sessionStorage.getItem("sessionId");
  //if the id is greater than 32 characters, we need to generate a new one.
  sessionId = sessionId && sessionId.length <= 32 ? sessionId : null;

  if (!sessionId) {
    //the generated id is 36 characters long, so we need to remove the dashes and limit it to 32 characters.
    sessionId = uuidv4().replace(/-/g, "").slice(0, 32); // Ensure max 32 chars
    sessionStorage.setItem("sessionId", sessionId);
  }
  return sessionId;
};

/**
 * Retrieves or generates a persistent user ID and stores it in localStorage.
 * Ensures it only runs on the client side and limits it to 32 characters.
 * @returns {string} The user ID.
 */
const getUserId = () => {
  if (typeof window === "undefined") return ""; // Prevent SSR issues

  let userId = localStorage.getItem("userId");
  //if the id is greater than 32 characters, we need to generate a new one.
  userId = userId && userId.length <= 32 ? userId : null;

  if (!userId) {
    //the generated id is 36 characters long, so we need to remove the dashes and limit it to 32 characters.
    userId = uuidv4().replace(/-/g, "").slice(0, 32); // Ensure max 32 chars
    localStorage.setItem("userId", userId);
  }
  return userId;
};

/**
 * AgentComponent renders a chat interface with user and agent bubbles.
 * It manages the conversation state, handles user input and API requests,
 * and renders responses as Markdown.
 *
 * @returns {JSX.Element} The rendered chat interface.
 */
export default function AgentComponent() {
  // Suggestion data (move here for SSR compatibility)
  const suggestions = [
    { title: "Work ex", message: "Tell me about your work experience" },
    { title: "Design", message: "What is your design process?" },
    { title: "Art", message: "Share your favorite art style" },
    { title: "Games", message: "What games do you enjoy?" },
    { title: "Food", message: "What's your favorite food?" },
    { title: "Music", message: "What music do you like?" }
  ];

  // State to store the user's current input from the text field.
  const [message, setMessage] = useState("");

  // State to store the conversation as an array of message objects.
  // Each message object has a role ("user" or "agent") and the message content.
  const [conversation, setConversation] = useState([]);

  // State to capture any errors during the API request.
  const [error, setError] = useState(null);

  // State to track if the agent is processing (loading state).
  const [isLoading, setIsLoading] = useState(false);

  // Create a ref to track the end of the messages container.
  const messagesEndRef = useRef(null);

  // Initialize session ID and user ID states.
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("");

  // Initialize the hovered index state for suggested prompts.
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // State to track if the submit button is hovered.
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

  // Add state for input placeholder
  const defaultPlaceholder = "Go! ahead..type something";
  const [inputPlaceholder, setInputPlaceholder] = useState(defaultPlaceholder);
  // Track if user is hovering a suggestion and the previous input value
  const [prevInput, setPrevInput] = useState("");

  // Feedback and hover state per message
  const [feedbackArr, setFeedbackArr] = useState([]);
  const [hoveredArr, setHoveredArr] = useState([]);

  // State to control pill visibility - hide after first interaction
  const [showPills, setShowPills] = useState(true);

  // Initialize session ID and user ID on the client side
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
  }, []);

  // Keep feedbackArr and hoveredArr in sync with conversation length
  useEffect(() => {
    if (feedbackArr.length !== conversation.length) {
      setFeedbackArr((prev) => {
        const arr = [...prev];
        while (arr.length < conversation.length) arr.push({ like: false, dislike: false, copied: false });
        return arr.slice(0, conversation.length);
      });
    }
    if (hoveredArr.length !== conversation.length) {
      setHoveredArr((prev) => {
        const arr = [...prev];
        while (arr.length < conversation.length) arr.push("");
        return arr.slice(0, conversation.length);
      });
    }
  }, [conversation.length]);

  /**
   * Scrolls the chat container to the bottom to ensure the latest message is visible.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Remove auto-scroll behavior - keep UI static during AI responses
  // useEffect(() => {
  //   if (document.querySelector(".chat-container")) {
  //     scrollToBottom();
  //   }
  // }, [conversation]);

  /**
   * Handles the form submission event.
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    submitMessage(message);
  };

  /**
   * Handles the submission of the chat input form.
   *
   * Prevents the default form submission behavior, updates the conversation
   * with the user's message, sends the message to the API, and appends the agent's
   * response to the conversation.
   *
   * @param {Event} e - The form submission event.
   * @returns {Promise<void>} A promise that resolves when the submission is complete.
   */
  const submitMessage = async (userInput) => {
    // If the message is empty, do nothing.
    if (!userInput.trim()) return;

    // Clear the input immediately after user submits
    setMessage("");

    // Clear any previous errors.
    setError(null);

    // Create a new conversation entry for the user's message.
    const userMessage = {
      role: "user",
      content: userInput.trim(),
    };

    // Update the conversation state by adding the user's message.
    setConversation((prev) => [...prev, userMessage]);

    // Hide pills after first interaction for cleaner UX
    setShowPills(false);

    // Prepare the payload for the API call.
    // Note: In production, user_id and session_id should be uniquely generated.
    const payload = {
      data: {
        message: userMessage,
      },
      stateful: true,
      stream: false,
      user_id: userId,
      session_id: sessionId,
      verbose: false,
    };

    try {
      // Set loading state to true to trigger the animation.
      setIsLoading(true);

      // Send a POST request to the serverless API endpoint on Vercel.
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // If the server response is not OK, throw an error.
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Parse the JSON response from the API.
      const data = await res.json();

      // Extract the agent's reply from output_data.content.
      // If output_data or content is missing, fall back to a default message.
      const agentReply =
        data.output_data && data.output_data.content
          ? data.output_data.content
          : "No valid response received from agent.";

      // Create a new conversation entry for the agent's response.
      const agentMessage = {
        role: "agent",
        content: agentReply,
      };

      // Update the conversation state by adding the agent's message.
      setConversation((prev) => [...prev, agentMessage]);

      // Clear the user input field.
      setMessage("");
    } catch (err) {
      // Log the error to the console for debugging.
      console.error("Error fetching agent response:", err);
      // Show error as a chat reply from the agent
      setConversation((prev) => [
        ...prev,
        {
          role: "agent",
          content: `Error: ${err.message}`,
        },
      ]);
    } finally {
      // Reset the loading state regardless of success or error.
      setIsLoading(false);
    }
  };

  /**
   * Inline styles for chat bubbles based on the message role.
   *
   * @type {Object}
   * @property {Object} user - Styles for user messages (right-aligned, light green background).
   * @property {Object} agent - Styles for agent messages (left-aligned, light gray background).
   */
  const bubbleStyles = {
    user: {
      display: "inline-flex",
      padding: "19px 13px",
      justifyContent: "center",
      alignItems: "center",
      gap: "10px",
      borderRadius: "13px",
      background: "#F7F7F7",
      color: "#000",
      fontFamily: 'Acumin Pro, Arial, sans-serif',
      fontSize: "14px",
      fontStyle: "normal",
      fontWeight: 400,
      lineHeight: "normal",
      alignSelf: "flex-end",
      margin: "0 0 0 auto",
      maxWidth: "70%",
      wordBreak: "break-word",
      overflowWrap: "break-word",
    },
    agent: {
      display: "inline-flex",
      padding: "19px 13px",
      justifyContent: "center",
      alignItems: "center",
      gap: "10px",
      borderRadius: "13px",
      background: "none",
      color: "#000",
      fontFamily: 'Acumin Pro, Arial, sans-serif',
      fontSize: "14px",
      fontStyle: "normal",
      fontWeight: 400,
      lineHeight: "normal",
      alignSelf: "flex-start",
      margin: 0,
      width: "100%",
      maxWidth: "731px",
      position: "relative",
      boxSizing: "border-box",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      overflow: "visible",
    },
  };

  /**
   * Handles the click event on a suggested prompt.
   *
   * Sets the chat input to the prompt text when clicked.
   * Submit the prompt to the chat
   *
   * @param {Object} prompt - The prompt object containing text and autoSubmit flag.
   */
  const handlePromptClick = async (prompt) => {
    // Set the chat input to the prompt text.
    setMessage(prompt);
    // Submit the prompt to the chat immediately
    await submitMessage(prompt);
  };

  /**
   * Handles the mouseover event on a suggested prompt.
   * @param {*} index
   */
  const handlePromptMouseOver = (index) => {
    if (!isLoading) {
      setHoveredIndex(index);
    }
  };

  /**
   * Handles the mouseout event on a suggested prompt.
   */
  const handlePromptMouseOut = () => {
    setHoveredIndex(null);
  };

  // Copy handler
  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setFeedbackArr((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], copied: true, like: false, dislike: false };
      return arr;
    });
    setTimeout(() => {
      setFeedbackArr((prev) => {
        const arr = [...prev];
        arr[idx] = { ...arr[idx], copied: false };
        return arr;
      });
    }, 1200);
  };
  // Like/Dislike handlers
  const handleLike = (idx) => {
    setFeedbackArr((prev) => {
      const arr = [...prev];
      arr[idx] = { like: !arr[idx].like, dislike: false, copied: false };
      return arr;
    });
  };
  const handleDislike = (idx) => {
    setFeedbackArr((prev) => {
      const arr = [...prev];
      arr[idx] = { like: false, dislike: !arr[idx].dislike, copied: false };
      return arr;
    });
  };
  // Hover handlers
  const setHoveredIdx = (idx, val) => {
    setHoveredArr((prev) => {
      const arr = [...prev];
      arr[idx] = val;
      return arr;
    });
  };

  // Main render - FRAMER OPTIMIZED FIXED CONTAINER
  return (
    <div
      className="main-container"
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        background: "transparent",
        margin: "0",
        padding: "20px",
        overflow: "visible",
        position: "relative",
        // RESPONSIVE: Three states - Website, Tablet, Mobile
      }}
    >
      {/* CARD CONTAINER - Chat Interface Layout */}
      <div
        style={{
          display: "flex",
          width: "784px",
          height: "784px",
          minWidth: "320px",
          maxWidth: "784px",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "0 auto",
          background: "#FFFFFF",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)",
          padding: "24px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* CHAT CONVERSATION AREA - FIXED HEIGHT */}
        <div
          style={{
            height: "500px",
            width: "100%",
            maxWidth: "736px",
            overflowY: "auto",
            padding: "0 0 16px 0",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Chat conversation container displaying messages in bubbles */}
          <div
            className="chat-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              marginBottom: "5px",
              maxHeight: "100%",
              overflowY: "auto",
              border: "none",
              padding: "0",
              borderRadius: 0,
              background: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {conversation.map((msg, index) => {
              const feedback = feedbackArr[index] || { like: false, dislike: false, copied: false };
              const hovered = hoveredArr[index] || "";
              return (
                <div
                  key={index}
                  style={msg.role === "user" ? bubbleStyles.user : bubbleStyles.agent}
                >
                  {msg.role === "agent" ? (
                    <div style={{ display: "flex", width: "100%", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{
                        color: "#000",
                        fontFamily: 'Acumin Pro, Arial, sans-serif',
                        fontSize: "14px",
                        fontStyle: "normal",
                        fontWeight: 400,
                        lineHeight: "normal",
                        wordBreak: "break-word",
                        marginLeft: "40px",
                        paddingBottom: "5px"
                      }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </span>
                      {/* Feedback stack container below text */}
                      <div style={{ display: "flex", height: "30px", alignItems: "center", alignSelf: "stretch", justifyContent: "flex-start", marginLeft: "40px" }}>
                        <div style={{ display: "flex", height: "30px", justifyContent: "flex-start", alignItems: "center", gap: "-11.647px" }}>
                          {/* Like icon */}
                          <span
                            style={{ width: "18.286px", height: "18.286px", aspectRatio: "18.29/18.29", display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: "8px", cursor: "pointer", position: "relative" }}
                            onClick={() => handleFeedback(index, "like")}
                            onMouseEnter={() => setHoveredIdx(index, "like")}
                            onMouseLeave={() => setHoveredIdx(index, "")}
                          >
                            {feedback.like ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_149_669" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_149_669)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.8046C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_148_651" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_148_651)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM7.33197 12.4299H14.1892V3.28701H7.33197V12.4299ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            )}
                            {/* Like label on hover */}
                            {hovered === "like" && (
                              <span style={{
                                display: "flex",
                                width: "33px",
                                height: "14.143px",
                                padding: "3.367px",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "6.735px",
                                borderRadius: "14.143px",
                                background: "#D9D9D9",
                                position: "absolute",
                                bottom: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                marginBottom: "4px",
                                zIndex: 1000,
                              }}>
                                <span style={{
                                  width: "27px",
                                  height: "9px",
                                  flexShrink: 0,
                                  color: "#424242",
                                  textAlign: "center",
                                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                                  fontSize: "8.082px",
                                  fontStyle: "normal",
                                  fontWeight: 700,
                                  lineHeight: "normal",
                                }}>Like</span>
                              </span>
                            )}
                          </span>
                          {/* Dislike icon */}
                          <span
                            style={{ width: "18.286px", height: "18.286px", aspectRatio: "18.29/18.29", display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: "8px", cursor: "pointer", position: "relative" }}
                            onClick={() => handleFeedback(index, "dislike")}
                            onMouseEnter={() => setHoveredIdx(index, "dislike")}
                            onMouseLeave={() => setHoveredIdx(index, "")}
                          >
                            {feedback.dislike ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_149_669" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_149_669)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_148_651" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_148_651)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM7.33197 12.4299H14.1892V3.28701H7.33197V12.4299ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            )}
                            {/* Dislike label on hover */}
                            {hovered === "dislike" && (
                              <span style={{
                                display: "flex",
                                width: "33px",
                                height: "14.143px",
                                padding: "3.367px",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "6.735px",
                                borderRadius: "14.143px",
                                background: "#D9D9D9",
                                position: "absolute",
                                bottom: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                marginBottom: "4px",
                                zIndex: 1000,
                              }}>
                                <span style={{
                                  width: "27px",
                                  height: "9px",
                                  flexShrink: 0,
                                  color: "#424242",
                                  textAlign: "center",
                                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                                  fontSize: "8.082px",
                                  fontStyle: "normal",
                                  fontWeight: 700,
                                  lineHeight: "normal",
                                }}>Dislike</span>
                              </span>
                            )}
                          </span>
                          {/* Copy icon */}
                          <span
                            style={{ width: "18.286px", height: "18.286px", aspectRatio: "18.29/18.29", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
                            onClick={() => handleCopy(msg.content, index)}
                            onMouseEnter={() => setHoveredIdx(index, "copy")}
                            onMouseLeave={() => setHoveredIdx(index, "")}
                          >
                            {feedback.copied ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_149_669" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_149_669)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                                <mask id="mask0_148_651" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                                  <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_148_651)">
                                  <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM7.33197 12.4299H14.1892V3.28701H7.33197V12.4299ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                                </g>
                              </svg>
                            )}
                            {/* Copy label on hover */}
                            {hovered === "copy" && (
                              <span style={{
                                display: "flex",
                                width: "33px",
                                height: "14.143px",
                                padding: "3.367px",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "6.735px",
                                borderRadius: "14.143px",
                                background: "#D9D9D9",
                                position: "absolute",
                                bottom: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                marginBottom: "4px",
                                zIndex: 1000,
                              }}>
                                <span style={{
                                  width: "27px",
                                  height: "9px",
                                  flexShrink: 0,
                                  color: "#424242",
                                  textAlign: "center",
                                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                                  fontSize: "8.082px",
                                  fontStyle: "normal",
                                  fontWeight: 700,
                                  lineHeight: "normal",
                                }}>Copy</span>
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span style={{
                      color: "#000",
                      fontFamily: 'Acumin Pro, Arial, sans-serif',
                      fontSize: "14px",
                      fontStyle: "normal",
                      fontWeight: 400,
                      lineHeight: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}>
                      {msg.content}
                    </span>
                  )}
                </div>
              );
            })}
            
            {/* THINKING STATE - Show when loading */}
            {isLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "19px 13px",
                  borderRadius: "13px",
                  background: "none",
                  color: "#666",
                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                  alignSelf: "flex-start",
                  margin: 0,
                  width: "100%",
                  maxWidth: "100%",
                  position: "relative",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", width: "100%", flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{
                    color: "#666",
                    fontFamily: 'Acumin Pro, Arial, sans-serif',
                    fontSize: "14px",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "normal",
                    marginLeft: "40px",
                    paddingBottom: "5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #666",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }}></div>
                    Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* BOTTOM SECTION - Pills and Input - FIXED HEIGHT */}
        <div
          style={{
            height: "200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            width: "100%",
            maxWidth: "736px",
          }}
        >
          {/* SUGGESTION PILLS GRID - HIDE AFTER FIRST INTERACTION */}
          {showPills && (
          <div
            style={{
              display: "grid",
              height: "auto",
              maxHeight: "76px",
              padding: "16px 0",
              rowGap: "16px",
              columnGap: "16px",
              alignSelf: "stretch",
              gridTemplateRows: "repeat(1, minmax(0, 1fr))",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              width: "100%",
              maxWidth: "744px",
              boxSizing: "border-box",
              background: "#FFF",
              overflow: "visible",
              position: "relative",
              zIndex: 10,
              margin: "0",
            }}
          >
          {suggestions.map((s, idx) => (
            <div
              key={s.title}
              onMouseOver={() => {
                setPrevInput(message);
                setMessage(s.message);
              }}
              onMouseOut={() => {
                setMessage(prevInput);
              }}
              onClick={() => setMessage(s.message)}
              style={{
                display: "flex",
                width: "59.559px",
                height: "75px",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                flexShrink: 0,
                gridRow: "1 / span 1",
                gridColumn: `${idx + 1} / span 1`,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <div
                className="suggestion-circle"
                style={{
                  width: "59.559px",
                  height: "59.559px",
                  flexShrink: 0,
                  borderRadius: "46px",
                  border: "1px solid rgba(255, 255, 255, 0.40)",
                  background: "rgba(128, 128, 128, 0.30)",
                  backgroundBlendMode: "luminosity",
                  backdropFilter: "blur(50px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s, border 0.2s",
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(128,128,128,0.5)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(128,128,128,0.30)'}
              >
                {/* Placeholder for icon */}
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#d3d3d3" }} />
              </div>
              <div
                style={{
                  width: "100%",
                  color: "#000",
                  textAlign: "center",
                  fontFamily: "Acumin Pro",
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
            </div>
          ))}
          
          {/* THINKING STATE - Show when loading */}
          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "19px 13px",
                borderRadius: "13px",
                background: "none",
                color: "#666",
                fontFamily: 'Acumin Pro, Arial, sans-serif',
                fontSize: "14px",
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: "normal",
                alignSelf: "flex-start",
                margin: 0,
                width: "100%",
                maxWidth: "731px",
                position: "relative",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", width: "731px", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{
                  color: "#666",
                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                  marginLeft: "40px",
                  paddingBottom: "5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <div style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #666",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
        )}
        
        {/* CARDBOX LAYOUT - INPUT SECTION - EQUAL PADDING */}
        <div
          style={{
            display: "flex",
            maxWidth: "744px",
            padding: "20px 20px",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "stretch",
            gap: "12px",
            alignSelf: "stretch",
            borderRadius: "12px",
            border: "1px solid rgba(0, 0, 0, 0.12)",
            background: "#FAFAFA",
            width: "100%",
            boxSizing: "border-box",
            position: "relative",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          {/* Chat input form */}
          <form onSubmit={handleSubmit} style={{ border: "none", background: "none", padding: 0, margin: 0, width: "100%" }}>
            <div
              className="chat-input-container"
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: "48px",
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: "24px",
                padding: "0 16px",
                boxSizing: "border-box",
                position: "relative",
              }}
            >
              <input
                type="text"
                id="message"
                placeholder={inputPlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  flex: "1",
                  color: "#000",
                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  boxSizing: "border-box",
                  padding: "0 8px 0 0",
                }}
              />
              {/* Send button - Inside input field */}
              <button
                type="submit"
                aria-label="Send prompt"
                data-testid="send-button"
                disabled={isLoading}
                style={{
                  background: "#FF6B9D",
                  border: "none",
                  cursor: isLoading ? "default" : "pointer",
                  padding: "8px",
                  margin: "0",
                  width: "32px",
                  height: "32px",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                  <path d="M17.4898 9.26352L4.36484 1.77212C4.1436 1.64801 3.88983 1.59416 3.63726 1.6177C3.38468 1.64125 3.14525 1.74109 2.95076 1.90395C2.75628 2.06681 2.61594 2.28499 2.54841 2.52951C2.48087 2.77403 2.48933 3.0333 2.57265 3.2729L4.99452 10.3409C4.99421 10.3435 4.99421 10.3461 4.99452 10.3487C4.99409 10.3513 4.99409 10.3539 4.99452 10.3565L2.57265 17.4401C2.50592 17.6286 2.48538 17.8303 2.51274 18.0284C2.5401 18.2264 2.61458 18.415 2.72991 18.5783C2.84525 18.7417 2.99808 18.8749 3.17557 18.967C3.35307 19.059 3.55005 19.1071 3.74999 19.1073C3.96692 19.1067 4.18004 19.0502 4.36874 18.9432L17.4867 11.4393C17.6802 11.3309 17.8414 11.173 17.9537 10.9817C18.066 10.7905 18.1254 10.5728 18.1258 10.351C18.1262 10.1292 18.0676 9.9113 17.956 9.71964C17.8443 9.52799 17.6837 9.36949 17.4906 9.2604L17.4898 9.26352ZM3.74999 17.8573V17.8502L6.10468 10.9823H10.625C10.7908 10.9823 10.9497 10.9164 11.0669 10.7992C11.1841 10.682 11.25 10.523 11.25 10.3573C11.25 10.1915 11.1841 10.0325 11.0669 9.91533C10.9497 9.79812 10.7908 9.73227 10.625 9.73227H6.11093L3.75468 2.86665L3.74999 2.85727L16.875 10.344L3.74999 17.8573Z" fill="white"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
        
        {/* BETA MESSAGE - No Card Background */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            maxWidth: "744px",
            padding: "8px 12px",
          }}
        >
          {/* BETA badge */}
          <div
            style={{
              display: "flex",
              width: "33px",
              height: "14.143px",
              padding: "3.367px",
              justifyContent: "center",
              alignItems: "center",
              gap: "6.735px",
              borderRadius: "14.143px",
              background: "#D9D9D9",
            }}
          >
            <span
              style={{
                width: "27px",
                height: "9px",
                flexShrink: 0,
                color: "#424242",
                textAlign: "center",
                fontFamily: 'Acumin Pro',
                fontSize: "8.082px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "normal",
                letterSpacing: 0,
              }}
            >
              BETA
            </span>
          </div>
          {/* Text holder */}
          <div
            style={{
              width: "186px",
              height: "11px",
              color: "#424242",
              fontFamily: 'Acumin Pro',
              fontSize: "11px",
              fontStyle: "normal",
              fontWeight: 400,
              lineHeight: "normal",
              display: "flex",
              alignItems: "center",
            }}
          >
            Chai.AI may create unexpected results
          </div>
        </div>
      </div>
      </div>

      {/* Define keyframes for the spin animation and responsive styles */}
      <style jsx>{`
        .chat-container::-webkit-scrollbar {
          width: 8px; /* Make scrollbar thinner */
        }
        .chat-container::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 5px; /* Ensures the track has rounded corners */
        }
        .chat-container::-webkit-scrollbar-thumb {
          background-color: #ccc;
          border-radius: 5px;
        }
        /* Firefox scrollbar styling */
        .chat-container {
          scrollbar-width: thin;
          scrollbar-color: #ccc transparent;
        }
        
        /* RESPONSIVE DESIGN - THREE STATES */
        
        /* 1. WEBSITE STATE (Desktop) - 1200px and above */
        @media (min-width: 1200px) {
          .chat-input-container {
            width: 754px !important;
            max-width: 754px !important;
          }
          .main-container {
            width: 785px !important;
            height: 700px !important;
          }
        }
        
        /* 2. TABLET STATE - 768px to 1199px */
        @media (min-width: 768px) and (max-width: 1199px) {
          .chat-input-container {
            width: 90% !important;
            max-width: 600px !important;
          }
          .main-container {
            width: 90% !important;
            max-width: 800px !important;
            height: 600px !important;
          }
          .suggestion-circle {
            width: 35px !important;
            height: 35px !important;
            border-radius: 17.5px !important;
          }
          .suggestion-circle div {
            width: 18px !important;
            height: 18px !important;
          }
         }
        
        /* 3. MOBILE STATE - Below 768px */
        @media (max-width: 767px) {
          .chat-input-container {
            width: 95% !important;
            max-width: 400px !important;
          }
          .main-container {
            width: 95% !important;
            max-width: 450px !important;
            height: 500px !important;
          }
          .suggestion-circle {
            width: 30px !important;
            height: 30px !important;
            border-radius: 15px !important;
          }
          .suggestion-circle div {
            width: 15px !important;
            height: 15px !important;
          }
        }
        
        /* Ensure no horizontal scrollbar */
        body, html {
          overflow-x: hidden !important;
        }
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
