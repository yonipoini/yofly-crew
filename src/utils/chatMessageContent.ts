export type ParsedChatMessageContent = {
  text: string;
  attachmentUrl?: string;
};

type SerializedChatMessageContent = {
  text?: string;
  attachmentUrl?: string;
};

const RICH_MESSAGE_VERSION = 'yofly-chat-v1';

export const parseChatMessageContent = (rawContent?: string | null): ParsedChatMessageContent => {
  if (!rawContent) {
    return { text: '' };
  }

  try {
    const parsed = JSON.parse(rawContent) as { __type?: string } & SerializedChatMessageContent;

    if (parsed.__type === RICH_MESSAGE_VERSION) {
      return {
        text: parsed.text || '',
        attachmentUrl: parsed.attachmentUrl,
      };
    }
  } catch (_error) {
    // Plain text legacy message
  }

  return {
    text: rawContent,
  };
};

export const serializeChatMessageContent = (content: SerializedChatMessageContent) =>
  JSON.stringify({
    __type: RICH_MESSAGE_VERSION,
    text: content.text || '',
    attachmentUrl: content.attachmentUrl,
  });
