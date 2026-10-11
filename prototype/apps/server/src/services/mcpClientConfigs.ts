import { basename } from 'node:path';

export type McpStdioServer = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export function resolveBunCommand(): string {
  const exe = process.execPath;
  if (/bun/i.test(basename(exe))) return exe.replace(/\\/g, '/');
  return 'bun';
}

export function cursorMcpInstallLink(name: string, serverConfig: McpStdioServer): string {
  const configB64 = Buffer.from(JSON.stringify(serverConfig), 'utf8').toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(configB64)}`;
}

/** Build install artifacts for popular + custom MCP clients (token-only auth). */
export function buildMcpClientConfigs(opts: {
  token: string;
  mcpCwd: string;
  bunCommand?: string;
}) {
  const bunCommand = opts.bunCommand ?? resolveBunCommand();
  const envBlock = { GESTALT_MCP_TOKEN: opts.token };

  const stdioServer: McpStdioServer = {
    command: bunCommand,
    args: ['run', '--cwd', opts.mcpCwd, 'start'],
    env: envBlock,
  };

  const cursorConfig = { mcpServers: { 'gestalt-org': stdioServer } };
  const claudeCodeConfig = {
    mcpServers: {
      'gestalt-org': { type: 'stdio' as const, ...stdioServer },
    },
  };

  /** Generic MCP stdio shape used by Windsurf, Continue, Cline, custom hosts, etc. */
  const genericStdioConfig = {
    mcpServers: {
      'gestalt-org': {
        transport: 'stdio',
        ...stdioServer,
      },
    },
  };

  /**
   * Custom / HTTP-style clients: pass the PAT as a bearer (when you host streamable HTTP later)
   * or as env GESTALT_MCP_TOKEN for stdio wrappers.
   */
  const customClientHint = {
    auth: {
      type: 'bearer_or_env',
      header: 'Authorization: Bearer <token>',
      env: 'GESTALT_MCP_TOKEN',
      token: opts.token,
      note: 'Stdio clients set env. Remote HTTP MCP clients should send Bearer. Never put user ids in client config.',
    },
    stdio: stdioServer,
  };

  const claudeCliCommand = [
    'claude mcp add',
    '--transport stdio',
    `--env GESTALT_MCP_TOKEN=${opts.token}`,
    '--scope project',
    'gestalt-org',
    '--',
    bunCommand,
    'run',
    '--cwd',
    opts.mcpCwd,
    'start',
  ].join(' ');

  return {
    bunCommand,
    stdioServer,
    cursorInstallLink: cursorMcpInstallLink('gestalt-org', stdioServer),
    cursorConfig,
    cursorConfigJson: JSON.stringify(cursorConfig, null, 2),
    claudeCodeConfig,
    claudeCodeConfigJson: JSON.stringify(claudeCodeConfig, null, 2),
    claudeCliCommand,
    genericStdioConfig,
    genericStdioConfigJson: JSON.stringify(genericStdioConfig, null, 2),
    customClientHint,
    customClientHintJson: JSON.stringify(customClientHint, null, 2),
    clients: [
      { id: 'cursor', name: 'Cursor', install: 'deeplink' },
      { id: 'claude-code', name: 'Claude Code', install: 'mcp_json_or_cli' },
      { id: 'generic', name: 'Other MCP hosts (Windsurf, Continue, Cline, …)', install: 'generic_json' },
      { id: 'custom', name: 'Custom MCP client', install: 'env_or_bearer' },
    ] as const,
  };
}
