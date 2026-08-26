import { BaseContextProvider } from "../";
import { ContextProviderName } from "../../";

import ClipboardContextProvider from "./ClipboardContextProvider";
import CodebaseContextProvider from "./CodebaseContextProvider";
import CodeContextProvider from "./CodeContextProvider";

import CurrentFileContextProvider from "./CurrentFileContextProvider";
import DebugLocalsProvider from "./DebugLocalsProvider";
import DiffContextProvider from "./DiffContextProvider";
import FileContextProvider from "./FileContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import GitCommitContextProvider from "./GitCommitContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import OSContextProvider from "./OSContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import RepoMapContextProvider from "./RepoMapContextProvider";
import RulesContextProvider from "./RulesContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";

// ── REMOVED (network-capable) providers ─────────────────────────────────
// The following have been removed from this air-gapped fork because they
// make outbound network requests:
//   GoogleContextProvider, WebContextProvider, URLContextProvider,
//   DocsContextProvider, HttpContextProvider, GitHubIssuesContextProvider,
//   GitLabMergeRequestContextProvider, GreptileContextProvider,
//   DiscordContextProvider, PostgresContextProvider,
//   DatabaseContextProvider, MCPContextProvider

/**
 * Note: We are currently omitting the following providers due to bugs:
 * - `CodeOutlineContextProvider`
 * - `CodeHighlightsContextProvider`
 *
 * See this issue for details: https://github.com/continuedev/continue/issues/1365
 */
export const Providers: (typeof BaseContextProvider)[] = [
  FileContextProvider,
  DiffContextProvider,
  FileTreeContextProvider,
  TerminalContextProvider,
  DebugLocalsProvider,
  OpenFilesContextProvider,
  SearchContextProvider,
  OSContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,
  CodebaseContextProvider,
  CodeContextProvider,
  CurrentFileContextProvider,
  RepoMapContextProvider,
  GitCommitContextProvider,
  ClipboardContextProvider,
  RulesContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName,
): typeof BaseContextProvider | undefined {
  const provider = Providers.find((cls) => cls.description.title === name);

  return provider;
}

