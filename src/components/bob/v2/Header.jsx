import React from "react";

export default function Header({
  botName = "Ophélia",
  welcomeMessage = "Bonjour !",
  isMobile = false,
  user = null,
  onSignIn = () => {},
  onSignOut = () => {},
}) {
  return (
    <div className={`chat-header ${isMobile ? "mobile" : ""}`}>
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center">
          <div className="chat-avatar">🤖</div>
          <div className="chat-info">
            <div className="chat-title">{botName}</div>
            {!isMobile && <div className="chat-subtitle">{welcomeMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
