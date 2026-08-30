import { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { Message } from "core/protocol/messenger";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { IMessenger } from "../../../core/protocol/messenger";

import { handleLLMError } from "./util/errorHandling";
import { logInfo, logError, logWarn } from "./util/debugLogger";

export class VsCodeWebviewProtocol
  implements IMessenger<FromWebviewProtocol, ToWebviewProtocol>
{
  listeners = new Map<
    keyof FromWebviewProtocol,
    ((message: Message) => any)[]
  >();

  send(messageType: string, data: any, messageId?: string): string {
    const id = messageId ?? uuidv4();
    this.webview?.postMessage({
      messageType,
      data,
      messageId: id,
    });
    return id;
  }

  on<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }

  _webview?: vscode.Webview;
  _webviewListener?: vscode.Disposable;

  get webview(): vscode.Webview | undefined {
    return this._webview;
  }

  set webview(webView: vscode.Webview) {
    if (this._webview === webView && this._webviewListener) {
      return;
    }
    logInfo("WebviewProtocol", "Setting new webview instance and attaching onDidReceiveMessage listener");
    this._webview = webView;
    this._webviewListener?.dispose();

    const handleMessage = async (msg: Message): Promise<void> => {
      if (!("messageType" in msg) || !("messageId" in msg)) {
        logError("WebviewProtocol", `Invalid webview msg: ${JSON.stringify(msg)}`);
        return; // Silently discard rather than throw — throwing kills the whole listener
      }

      // Log all incoming messages; truncate data for readability
      const isChat = msg.messageType === "llm/streamChat" || msg.messageType === "chatDescriber/describe";
      if (isChat) {
        logInfo("WebviewProtocol", `>>> CHAT REQUEST received (id=${msg.messageId}): messageType=${msg.messageType}, model=${(msg.data as any)?.completionOptions?.model ?? "<default>"}`);
      } else {
        logInfo("WebviewProtocol", `Webview msg: ${msg.messageType} (id=${msg.messageId})`);
      }

      const respond = (message: any) => {
        if (isChat) {
          logInfo("WebviewProtocol", `<<< CHAT RESPONSE chunk (id=${msg.messageId}): done=${message?.done}, status=${message?.status}, hasContent=${!!message?.content}, error=${message?.error ?? "none"}`);
        }
        return this.send(msg.messageType, message, msg.messageId);
      };

      const handlers =
        this.listeners.get(msg.messageType as keyof FromWebviewProtocol) || [];

      if (handlers.length === 0) {
        logWarn("WebviewProtocol", `No handler registered for message type: ${msg.messageType}`);
      }

      for (const handler of handlers) {
        try {
          const response = await handler(msg);
          // For generator types e.g. llm/streamChat
          if (
            response &&
            typeof response[Symbol.asyncIterator] === "function"
          ) {
            if (isChat) {
              logInfo("WebviewProtocol", `CHAT: got async generator response, starting streaming...`);
            }
            let chunkCount = 0;
            let next = await response.next();
            while (!next.done) {
              chunkCount++;
              respond({
                done: false,
                content: next.value,
                status: "success",
              });
              next = await response.next();
            }
            if (isChat) {
              logInfo("WebviewProtocol", `CHAT: stream complete. Sent ${chunkCount} chunks.`);
            }
            respond({
              done: true,
              content: next.value,
              status: "success",
            });
          } else {
            respond({ done: true, content: response, status: "success" });
          }
        } catch (e: any) {
          // Build the most useful error message before responding
          let message: string = e.message ?? "Unknown error";

          if (e.cause) {
            if (e.cause.name === "ConnectTimeoutError") {
              message = `Connection timed out. If you expect it to take a long time to connect, you can increase the timeout in your config.`;
            } else if (e.cause.code === "ECONNREFUSED") {
              message = `Connection refused — make sure Ollama is running at http://localhost:11434.`;
            } else {
              message = `Request failed with "${e.cause.name}": ${e.cause.message}`;
            }
          }

          logError("WebviewProtocol", `Error in handler for ${msg.messageType}: ${message}\nStack: ${e.stack}`);
          console.error(`[Continue] Error handling webview message ${msg.messageType}: ${message}\n${e.stack}`);

          const wasHandled = await handleLLMError(e);
          void wasHandled; // fire-and-forget toast notification
          // Always send exactly ONE done=true response with the error
          respond({ done: true, error: message, status: "error" });
        }
      }
    };

    this._webviewListener = this._webview.onDidReceiveMessage(handleMessage);
  }

  constructor() {}

  invoke<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
  ): FromWebviewProtocol[T][1] {
    throw new Error("Method not implemented.");
  }

  onError(handler: (message: Message, error: Error) => void): void {
    throw new Error("Method not implemented.");
  }

  public request<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][0],
    retry: boolean = true,
  ): Promise<ToWebviewProtocol[T][1]> {
    const messageId = uuidv4();
    return new Promise(async (resolve) => {
      if (retry) {
        let i = 0;
        while (!this.webview) {
          if (i >= 10) {
            resolve(undefined);
            return;
          } else {
            await new Promise((res) => setTimeout(res, i >= 5 ? 1000 : 500));
            i++;
          }
        }
      }

      this.send(messageType, data, messageId);

      if (this.webview) {
        const disposable = this.webview.onDidReceiveMessage(
          (msg: Message<ToWebviewProtocol[T][1]>) => {
            if (msg.messageId === messageId) {
              resolve(msg.data);
              disposable?.dispose();
            }
          },
        );
      } else if (!retry) {
        resolve(undefined);
      }
    });
  }
}
