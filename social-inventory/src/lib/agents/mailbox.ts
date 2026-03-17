// ============================================================================
// AGENT MAILBOX PROTOCOL
// ============================================================================
// All agents communicate via this message bus. Each agent has an inbox and
// processes messages asynchronously. This enables composability: the
// MediatorAgent can orchestrate VisionAgent + LedgerAgent without tight coupling.
// ============================================================================

import { AgentMessage, AgentResponse, AgentType } from '@/types';

type AgentHandler = (message: AgentMessage) => Promise<AgentResponse>;

class AgentMailbox {
  private handlers: Map<AgentType, AgentHandler> = new Map();
  private messageLog: { message: AgentMessage; response?: AgentResponse }[] = [];

  /** Register an agent to receive messages */
  register(agent: AgentType, handler: AgentHandler): void {
    this.handlers.set(agent, handler);
  }

  /** Send a message to an agent and await its response */
  async send(message: AgentMessage): Promise<AgentResponse> {
    const handler = this.handlers.get(message.to);
    if (!handler) {
      throw new Error(`Agent "${message.to}" is not registered in the mailbox.`);
    }

    const start = performance.now();
    const entry = { message };
    this.messageLog.push(entry);

    try {
      const response = await handler(message);
      response.duration_ms = Math.round(performance.now() - start);
      (entry as any).response = response;
      return response;
    } catch (error) {
      const failResponse: AgentResponse = {
        message_id: message.id,
        agent: message.to,
        success: false,
        result: { error: error instanceof Error ? error.message : 'Unknown error' },
        duration_ms: Math.round(performance.now() - start),
      };
      (entry as any).response = failResponse;
      return failResponse;
    }
  }

  /** Broadcast a message to all registered agents (fire-and-forget, returns all) */
  async broadcast(
    message: Omit<AgentMessage, 'to'>,
    targets?: AgentType[]
  ): Promise<AgentResponse[]> {
    const recipients = targets ?? Array.from(this.handlers.keys());
    return Promise.all(
      recipients.map((to) => this.send({ ...message, to } as AgentMessage))
    );
  }

  /** Get the full audit log for a correlation_id (useful for dispute resolution) */
  getCorrelationLog(correlationId: string) {
    return this.messageLog.filter(
      (e) => e.message.correlation_id === correlationId
    );
  }

  /** Get full log — designed to be serialized into the 1M token context window */
  getFullLog() {
    return this.messageLog;
  }
}

// Singleton — shared across the server runtime
export const mailbox = new AgentMailbox();

// Helper to create properly typed messages
export function createMessage(
  from: AgentType,
  to: AgentType,
  action: string,
  payload: Record<string, unknown>,
  priority: AgentMessage['priority'] = 'normal'
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    action,
    payload,
    correlation_id: crypto.randomUUID(),
    priority,
    timestamp: new Date().toISOString(),
  };
}