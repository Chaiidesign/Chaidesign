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

  // Initialize session ID and user ID on the client side
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
  }, []);

  /**
   * Scrolls the chat container to the bottom to ensure the latest message is visible.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to the latest message whenever the conversation updates.
  useEffect(() => {
    if (document.querySelector(".chat-container")) {
      scrollToBottom();
    }
  }, [conversation]);

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
      margin: 0,
      maxWidth: "80%",
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
      width: "731px",
      maxWidth: "731px",
      position: "relative",
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
    // Submit the prompt to the chat.
    setTimeout(() => {
      submitMessage(prompt);
    }, 0); // Ensures the state has been updated before calling submitMessage
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

  return (
    <div
      style={{
        padding: 0,
        width: "100%",
        maxWidth: "710.91px",
        margin: "40px auto 0 auto",
        fontFamily: "Arial, sans-serif",
        borderRadius: 0,
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "none",
        border: "none",
      }}
    >
      {/* Chat conversation container displaying messages in bubbles */}
      <div
        className="chat-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          marginBottom: "0px",
          height: chatConfig.maxChatHeight ? Math.max(500, parseInt(chatConfig.maxChatHeight)) : 500, // Increase chat view box height
          overflowY: "auto", // Enable vertical scrolling
          border: "none",
          padding: 0,
          borderRadius: 0,
          background: "none",
          width: "100%",
        }}
      >
        {conversation.map((msg, index) => {
          // Feedback state per message
          const [feedback, setFeedback] = useState({ like: false, dislike: false, copied: false });
          const [hovered, setHovered] = useState("");
          // Copy handler
          const handleCopy = (text) => {
            navigator.clipboard.writeText(text);
            setFeedback({ ...feedback, copied: true });
            setTimeout(() => setFeedback({ ...feedback, copied: false }), 1200);
          };
          return (
            <div
              key={index}
              style={msg.role === "user" ? bubbleStyles.user : bubbleStyles.agent}
            >
              {msg.role === "agent" ? (
                <div style={{ position: "relative", width: "100%" }}>
                  <span style={{
                    color: "#000",
                    fontFamily: 'Acumin Pro, Arial, sans-serif',
                    fontSize: "14px",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "normal",
                    wordBreak: "break-word"
                  }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </span>
                  {/* Feedback stack */}
                  <span
                    style={{
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "-8px",
                      position: "absolute",
                      right: 5,
                      bottom: 5,
                      background: "none"
                    }}
                  >
                    {/* Like icon */}
                    <span
                      style={{ width: "19px", height: "19px", display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: "8px", cursor: "pointer", position: "relative" }}
                      onClick={() => setFeedback({ like: !feedback.like, dislike: false, copied: false })}
                      onMouseEnter={() => setHovered("like")}
                      onMouseLeave={() => setHovered("")}
                    >
                      {feedback.like ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                          <mask id="mask0_147_602" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                            <rect x="0.23938" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_147_602)">
                            <path d="M13.9538 16.2396H6.33465V6.33473L11.668 1.00134L12.6204 1.95373C12.7093 2.04262 12.7823 2.16326 12.8395 2.31564C12.8966 2.46802 12.9252 2.61406 12.9252 2.75374V3.02041L12.0871 6.33473H16.2395C16.6459 6.33473 17.0014 6.48711 17.3062 6.79187C17.6109 7.09664 17.7633 7.4522 17.7633 7.85855V9.38237C17.7633 9.47126 17.7538 9.5665 17.7348 9.66809C17.7157 9.76968 17.6871 9.86492 17.649 9.95381L15.3633 15.3253C15.249 15.5793 15.0585 15.7951 14.7919 15.9729C14.5252 16.1507 14.2458 16.2396 13.9538 16.2396ZM4.81083 6.33473V16.2396H1.76318V6.33473H4.81083Z" fill="#1C1B1F"/>
                          </g>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <mask id="mask0_141_520" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="14">
                            <rect x="0.719971" y="0.719971" width="12.56" height="12.56" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_141_520)">
                            <path d="M10.1399 11.71H4.38327V4.90662L8.0466 1.24329L8.70077 1.89745C8.76182 1.95851 8.81198 2.04137 8.85123 2.14604C8.89048 2.2507 8.9101 2.35101 8.9101 2.44695V2.63012L8.33444 4.90662H11.7099C11.989 4.90662 12.2333 5.01129 12.4426 5.22062C12.6519 5.42995 12.7566 5.67418 12.7566 5.95329V6.99995C12.7566 7.06101 12.7479 7.12643 12.7304 7.1962C12.713 7.26598 12.6955 7.3314 12.6781 7.39245L11.1081 11.082C11.0296 11.2564 10.8988 11.4047 10.7156 11.5268C10.5324 11.6489 10.3405 11.71 10.1399 11.71ZM5.42994 10.6633H10.1399L11.7099 6.99995V5.95329H6.99994L7.70644 3.07495L5.42994 5.35145V10.6633ZM4.38327 4.90662V5.95329H2.81327V10.6633H4.38327V11.71H1.7666V4.90662H4.38327Z" fill="#1C1B1F"/>
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
                          flexShrink: 0,
                          borderRadius: "14.143px",
                          background: "#D9D9D9",
                          position: "absolute",
                          top: "22px",
                          left: "50%",
                          transform: "translateX(-50%)",
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
                      style={{ width: "19px", height: "19px", display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: "8px", cursor: "pointer", position: "relative" }}
                      onClick={() => setFeedback({ like: false, dislike: !feedback.dislike, copied: false })}
                      onMouseEnter={() => setHovered("dislike")}
                      onMouseLeave={() => setHovered("")}
                    >
                      {feedback.dislike ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                          <mask id="mask0_147_613" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                            <rect x="0.357056" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_147_613)">
                            <path d="M4.92858 2.52515H12.5477V12.43L7.21431 17.7634L6.26192 16.811C6.17303 16.7221 6.10002 16.6015 6.04287 16.4491C5.98573 16.2967 5.95716 16.1507 5.95716 16.011V15.7443L6.79526 12.43H2.64284C2.23649 12.43 1.88093 12.2776 1.57617 11.9729C1.2714 11.6681 1.11902 11.3125 1.11902 10.9062V9.38235C1.11902 9.29346 1.12854 9.19822 1.14759 9.09664C1.16664 8.99505 1.19521 8.89981 1.23331 8.81092L3.51904 3.43944C3.63333 3.18547 3.82381 2.9696 4.09047 2.79182C4.35714 2.61404 4.63651 2.52515 4.92858 2.52515ZM14.0715 12.43V2.52515H17.1192V12.43H14.0715Z" fill="#1C1B1F"/>
                          </g>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <mask id="mask0_141_534" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="14">
                            <rect x="0.719971" y="0.719971" width="12.56" height="12.56" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_141_534)">
                            <path d="M3.85995 2.28992H9.61662V9.09325L5.95329 12.7566L5.29912 12.1024C5.23806 12.0414 5.18791 11.9585 5.14866 11.8538C5.10941 11.7492 5.08979 11.6489 5.08979 11.5529V11.3698L5.66545 9.09325H2.28995C2.01084 9.09325 1.76662 8.98858 1.55729 8.77925C1.34795 8.56992 1.24329 8.3257 1.24329 8.04658V6.99992C1.24329 6.93886 1.25201 6.87345 1.26945 6.80367C1.2869 6.73389 1.30434 6.66847 1.32179 6.60742L2.89179 2.91792C2.97029 2.74347 3.10112 2.59519 3.28429 2.47308C3.46745 2.35097 3.65934 2.28992 3.85995 2.28992ZM8.56995 3.33658H3.85995L2.28995 6.99992V8.04658H6.99995L6.29345 10.9249L8.56995 8.64842V3.33658ZM9.61662 9.09325V8.04658H11.1866V3.33658H9.61662V2.28992H12.2333V9.09325H9.61662Z" fill="#1C1B1F"/>
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
                          flexShrink: 0,
                          borderRadius: "14.143px",
                          background: "#D9D9D9",
                          position: "absolute",
                          top: "22px",
                          left: "50%",
                          transform: "translateX(-50%)",
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
                      style={{ width: "19px", height: "19px", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
                      onClick={() => handleCopy(msg.content)}
                      onMouseEnter={() => setHovered("copy")}
                      onMouseLeave={() => setHovered("")}
                    >
                      {feedback.copied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
                          <mask id="mask0_147_624" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="19" height="19">
                            <rect x="0.474731" y="0.23938" width="18.2859" height="18.2859" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_147_624)">
                            <path d="M7.33197 13.9538C6.91292 13.9538 6.55418 13.8046 6.25577 13.5062C5.95735 13.2077 5.80815 12.849 5.80815 12.4299V3.28701C5.80815 2.86796 5.95735 2.50922 6.25577 2.21081C6.55418 1.91239 6.91292 1.76318 7.33197 1.76318H14.1892C14.6082 1.76318 14.967 1.91239 15.2654 2.21081C15.5638 2.50922 15.713 2.86796 15.713 3.28701V12.4299C15.713 12.849 15.5638 13.2077 15.2654 13.5062C14.967 13.8046 14.6082 13.9538 14.1892 13.9538H7.33197ZM4.28432 17.0014C3.86527 17.0014 3.50654 16.8522 3.20812 16.5538C2.90971 16.2554 2.7605 15.8966 2.7605 15.4776V4.81083H4.28432V15.4776H12.6654V17.0014H4.28432Z" fill="#1C1B1F"/>
                          </g>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <mask id="mask0_141_505" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="14">
                            <rect x="0.719971" y="0.719971" width="12.56" height="12.56" fill="#D9D9D9"/>
                          </mask>
                          <g mask="url(#mask0_141_505)">
                            <path d="M5.42992 10.1399C5.14208 10.1399 4.89568 10.0374 4.69071 9.83248C4.48574 9.62751 4.38325 9.3811 4.38325 9.09327V2.81327C4.38325 2.52543 4.48574 2.27903 4.69071 2.07406C4.89568 1.86909 5.14208 1.7666 5.42992 1.7666H10.1399C10.4277 1.7666 10.6742 1.86909 10.8791 2.07406C11.0841 2.27903 11.1866 2.52543 11.1866 2.81327V9.09327C11.1866 9.3811 11.0841 9.62751 10.8791 9.83248C10.6742 10.0374 10.4277 10.1399 10.1399 10.1399H5.42992ZM5.42992 9.09327H10.1399V2.81327H5.42992V9.09327ZM3.33658 12.2333C3.04875 12.2333 2.80235 12.1308 2.59738 11.9258C2.3924 11.7208 2.28992 11.4744 2.28992 11.1866V3.85994H3.33658V11.1866H9.09325V12.2333H3.33658Z" fill="#1C1B1F"/>
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
                          flexShrink: 0,
                          borderRadius: "14.143px",
                          background: "#D9D9D9",
                          position: "absolute",
                          top: "22px",
                          left: "50%",
                          transform: "translateX(-50%)",
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
                  </span>
                </div>
              ) : (
                // Display user messages as plain text.
                msg.content
              )}
          </div>
        );
      })}
        {/* Dummy element to ensure the latest message is scrolled into view */}
        <div ref={messagesEndRef} />
      </div>

      {/* OUTERMOST LAYER */}
      <div
        style={{
          display: "flex",
          width: "754px",
          height: "205px",
          minWidth: "400px",
          maxWidth: "754px",
          flexDirection: "column",
          alignItems: "center",
          gap: "5px",
          flexShrink: 0,
          margin: "0 auto 24px auto",
        }}
      >
        {/* SUGGESTION PILLS GRID */}
        <div
          style={{
            display: "grid",
            height: "84px",
            padding: "0px 41.774px 0.441px 41px",
            rowGap: "62px",
            columnGap: "62px",
            alignSelf: "stretch",
            gridTemplateRows: "repeat(1, minmax(0, 1fr))",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            width: "100%",
            boxSizing: "border-box",
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
                height: "83.559px",
                flexDirection: "column",
                alignItems: "center",
                gap: "7px",
                flexShrink: 0,
                gridRow: "1 / span 1",
                gridColumn: `${idx + 1} / span 1`,
                boxSizing: "border-box",
                cursor: "pointer",
              }}
            >
              <div
                className="suggestion-circle"
                style={{
                  width: "59.559px",
                  height: "59.559px",
                  flexShrink: 0,
                  borderRadius: "46px",
                  border: "1px solid #000",
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
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d3d3d3" }} />
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  color: "#000",
                  textAlign: "center",
                  fontFamily: 'Acumin Pro, Arial, sans-serif',
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                }}
              >
                {s.title}
              </div>
            </div>
          ))}
        </div>
        {/* INPUT STACK BELOW */}
        <div
          style={{
            display: "flex",
            minWidth: "400px",
            maxWidth: "730px",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "17px",
            alignSelf: "stretch",
            width: "100%",
            boxSizing: "border-box",
            marginTop: "5px", // Add 5px gap from the info stack above
          }}
        >
          {/* Chat input form for the user to send messages */}
          <form onSubmit={handleSubmit} style={{ border: "none", background: "none", padding: 0, margin: 0, width: "100%" }}>
            <div
              className="chat-input-container"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "16px 12px",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: "8px",
                alignSelf: "stretch",
                maxWidth: "730px",
                width: "100%",
                boxSizing: "border-box",
                borderRadius: "16px",
                border: "0.5px solid rgba(0, 0, 0, 0.10)",
                background: "#FFF",
                margin: "0 auto",
              }}
            >
              {/* Row 1: Input (with stack and typography) */}
              <div
                style={{
                  display: "flex",
                  minHeight: "28px",
                  padding: "4px 8px",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  gap: "8px",
                  alignSelf: "stretch",
                  borderRadius: "8px",
                  background: "#FFF",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <input
                  type="text"
                  id="message"
                  placeholder={inputPlaceholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    alignSelf: "stretch",
                    color: "#000",
                    fontFamily: 'Acumin Pro, Arial, sans-serif',
                    fontSize: "14px",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "normal",
                    letterSpacing: "0px",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {/* Row 2: Icons */}
              <div
                className="icon-row"
                style={{
                  display: "flex",
                  height: "28px",
                  minHeight: "28px",
                  alignItems: "center",
                  alignContent: "center",
                  gap: "8px",
                  alignSelf: "stretch",
                  flexWrap: "wrap",
                  borderRadius: "8px",
                  width: "100%",
                  justifyContent: "space-between",
                }}
              >
                {/* Left icon stack (star) */}
                <div
                  style={{
                    display: "flex",
                    minWidth: "28px",
                    minHeight: "28px",
                    padding: "4px",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "4px",
                    borderRadius: "8px",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="17" viewBox="0 0 16 17" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.74998 3.7387L6.11944 5.44269C5.94219 5.9217 5.56452 6.29937 5.08552 6.47662L3.38152 7.10715L5.08551 7.73769C5.56452 7.91494 5.94219 8.29261 6.11944 8.77162L6.74998 10.4756L7.38051 8.77162C7.55776 8.29261 7.93543 7.91494 8.41444 7.73769L10.1184 7.10715L8.41444 6.47662C7.93543 6.29937 7.55776 5.9217 7.38051 5.44269L6.74998 3.7387ZM7.45337 2.75803C7.21175 2.10507 6.28821 2.10507 6.04659 2.75803L5.18159 5.09566C5.10563 5.30095 4.94377 5.4628 4.73848 5.53877L2.40086 6.40377C1.74789 6.64538 1.74789 7.56892 2.40086 7.81054L4.73848 8.67554C4.94377 8.75151 5.10563 8.91336 5.18159 9.11865L6.04659 11.4563C6.28821 12.1092 7.21175 12.1092 7.45337 11.4563L8.31836 9.11865C8.39433 8.91336 8.55619 8.75151 8.76148 8.67554L11.0991 7.81054C11.7521 7.56892 11.7521 6.64538 11.0991 6.40377L8.76148 5.53877C8.55619 5.4628 8.39433 5.30095 8.31836 5.09566L7.45337 2.75803Z" fill="black"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.7499 10.5183L11.5202 11.139C11.3936 11.4811 11.1238 11.7509 10.7817 11.8775L10.161 12.1072L10.7817 12.3368C11.1238 12.4635 11.3936 12.7332 11.5202 13.0754L11.7499 13.696L11.9795 13.0754C12.1062 12.7332 12.3759 12.4635 12.7181 12.3368L13.3387 12.1072L12.7181 11.8775C12.3759 11.7509 12.1062 11.4811 11.9795 11.139L11.7499 10.5183ZM12.2188 9.62443C12.0577 9.18912 11.442 9.18912 11.281 9.62443L10.8168 10.8787C10.7662 11.0156 10.6583 11.1235 10.5214 11.1741L9.26713 11.6383C8.83182 11.7993 8.83182 12.415 9.26713 12.5761L10.5214 13.0402C10.6583 13.0909 10.7662 13.1988 10.8168 13.3356L11.281 14.5899C11.442 15.0252 12.0577 15.0252 12.2188 14.5899L12.6829 13.3356C12.7336 13.1988 12.8415 13.0909 12.9783 13.0402L14.2326 12.5761C14.6679 12.415 14.6679 11.7993 14.2326 11.6383L12.9783 11.1741C12.8415 11.1235 12.7336 11.0156 12.6829 10.8787L12.2188 9.62443Z" fill="black"/>
                  </svg>
                </div>
                {/* Middle stack (input area) - already handled above */}
                {/* Right icon stack (send button) */}
                <div
                  style={{
                    display: "flex",
                    minWidth: "28px",
                    minHeight: "28px",
                    padding: "4px",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "8px",
                  }}
                >
                  <button
                    type="submit"
                    aria-label="Send prompt"
                    data-testid="send-button"
                    disabled={isLoading}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: isLoading ? "default" : "pointer",
                      padding: 0,
                      margin: 0,
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="21" viewBox="0 0 20 21" fill="none">
                      <path d="M17.4898 9.26352L4.36484 1.77212C4.1436 1.64801 3.88983 1.59416 3.63726 1.6177C3.38468 1.64125 3.14525 1.74109 2.95076 1.90395C2.75628 2.06681 2.61594 2.28499 2.54841 2.52951C2.48087 2.77403 2.48933 3.0333 2.57265 3.2729L4.99452 10.3409C4.99421 10.3435 4.99421 10.3461 4.99452 10.3487C4.99409 10.3513 4.99409 10.3539 4.99452 10.3565L2.57265 17.4401C2.50592 17.6286 2.48538 17.8303 2.51274 18.0284C2.5401 18.2264 2.61458 18.415 2.72991 18.5783C2.84525 18.7417 2.99808 18.8749 3.17557 18.967C3.35307 19.059 3.55005 19.1071 3.74999 19.1073C3.96692 19.1067 4.18004 19.0502 4.36874 18.9432L17.4867 11.4393C17.6802 11.3309 17.8414 11.173 17.9537 10.9817C18.066 10.7905 18.1254 10.5728 18.1258 10.351C18.1262 10.1292 18.0676 9.9113 17.956 9.71964C17.8443 9.52799 17.6837 9.36949 17.4906 9.2604L17.4898 9.26352ZM3.74999 17.8573V17.8502L6.10468 10.9823H10.625C10.7908 10.9823 10.9497 10.9164 11.0669 10.7992C11.1841 10.682 11.25 10.523 11.25 10.3573C11.25 10.1915 11.1841 10.0325 11.0669 9.91533C10.9497 9.79812 10.7908 9.73227 10.625 9.73227H6.11093L3.75468 2.86665L3.74999 2.85727L16.875 10.344L3.74999 17.8573Z" fill="black"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Info stack below chat */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "9px",
              marginTop: "8px",
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

      {/* Define keyframes for the spin animation */}
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
