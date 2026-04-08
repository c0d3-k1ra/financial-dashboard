export function TypingIndicator() {
  return (
    <div className="flex justify-start ai-message-enter">
      <div className="glass-1 rounded-lg rounded-bl-sm px-4 py-3 bubble-ai-dark">
        <div className="flex items-center gap-1.5">
          <div className="ai-typing-dot" />
          <div className="ai-typing-dot" />
          <div className="ai-typing-dot" />
        </div>
      </div>
    </div>
  );
}
