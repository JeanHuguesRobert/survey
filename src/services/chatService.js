export async function sendMessageStream(question, onChunk, onComplete, onError) {
  try {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onComplete?.(fullText);
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      
      onChunk?.(chunk, fullText);
    }

    return fullText;
  } catch (error) {
    console.error('[ChatService] Error:', error);
    onError?.(error);
    throw error;
  }
}