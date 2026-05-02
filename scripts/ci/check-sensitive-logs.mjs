import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const URL_WITH_CREDENTIALS_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@[^\s"']+/giu;
const URL_PROTOCOL_PATTERN = /\b(?<scheme>redis|postgres|postgresql):\/\/(?<rest>[^\s"']+)/giu;
const AUTHORIZATION_VALUE_PATTERN =
  /(?<prefix>\bauthorization\b\s*[:=]\s*)(?<quote>"?)(?<value>[^",}]+)(?<suffix>"?)/giu;
const BEARER_TOKEN_PATTERN = /\bBearer\s+(?<token>[A-Za-z0-9._~+/=-]{8,})/gu;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /(?<key>"?(?:password|secret)"?\s*[:=]\s*)(?<quote>"?)(?<value>[^"\s,}]+)(?<suffix>"?)/giu;
const SENSITIVE_QUERY_VALUE_PATTERN =
  /(?<prefix>[?&](?:code|state|access_token|refresh_token|id_token|token|authorization|client_secret|secret|openid\.sig|openid\.return_to)=)(?!\*\*\*|\[REDACTED\])(?<value>[^\s"'&,}]+)/giu;

const BLOCKING_PATTERNS = [
  {
    id: 'authorization_header',
    pattern: /authorization\s*[:=]\s*"?[^\s",}]+/iu,
  },
  {
    id: 'bearer_token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/u,
  },
  {
    id: 'redis_url',
    pattern: /\bredis:\/\/[^\s"']+/iu,
  },
  {
    id: 'postgres_url',
    pattern: /\bpostgres(?:ql)?:\/\/[^\s"']+/iu,
  },
  {
    id: 'url_with_credentials',
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@[^\s"']+/iu,
  },
  {
    id: 'password_assignment',
    pattern: /"?(?:password|secret)"?\s*[:=]\s*"?(?!\*\*\*|redacted|null|undefined|false|true)[^"\s,}]+/iu,
  },
  {
    id: 'oauth_code_query',
    pattern: /[?&]code=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'oauth_state_query',
    pattern: /[?&]state=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'access_token_query',
    pattern: /[?&]access_token=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'refresh_token_query',
    pattern: /[?&]refresh_token=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'id_token_query',
    pattern: /[?&]id_token=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'token_query',
    pattern: /[?&]token=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'openid_signature_query',
    pattern: /[?&]openid\.sig=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'openid_return_to_query',
    pattern: /[?&]openid\.return_to=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'authorization_query',
    pattern: /[?&]authorization=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'client_secret_query',
    pattern: /[?&]client_secret=(?!\[REDACTED\])[^&\s"']+/iu,
  },
  {
    id: 'secret_query',
    pattern: /[?&]secret=(?!\[REDACTED\])[^&\s"']+/iu,
  },
];

function sanitizeConnectionUrl(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);
    const port = parsedUrl.port || (parsedUrl.protocol === 'redis:' ? '6379' : '');
    const portSegment = port ? ` port=${port}` : '';

    return `[connection scheme=${parsedUrl.protocol.replace(':', '')} host=${parsedUrl.hostname}${portSegment}]`;
  } catch {
    return '[connection redacted]';
  }
}

export function sanitizeLogLine(line) {
  return line
    .replace(URL_WITH_CREDENTIALS_PATTERN, (match) => sanitizeConnectionUrl(match))
    .replace(URL_PROTOCOL_PATTERN, (match) => sanitizeConnectionUrl(match))
    .replace(
      AUTHORIZATION_VALUE_PATTERN,
      (_match, prefix, quote, _value, suffix) => `${prefix}${quote}***${suffix}`,
    )
    .replace(BEARER_TOKEN_PATTERN, 'Bearer ***')
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (_match, key, quote, _value, suffix) => `${key}${quote}***${suffix}`,
    )
    .replace(
      SENSITIVE_QUERY_VALUE_PATTERN,
      (_match, prefix) => `${prefix}[REDACTED]`,
    );
}

export function scanLogContent(content) {
  const lines = content.split(/\r?\n/u);

  return lines.flatMap((line, index) => {
    if (line.trim().length === 0) {
      return [];
    }

    const matchedRules = BLOCKING_PATTERNS.filter(({ pattern }) => pattern.test(line));

    if (matchedRules.length === 0) {
      return [];
    }

    return matchedRules.map((matchedRule) => ({
      ruleId: matchedRule.id,
      lineNumber: index + 1,
      line: sanitizeLogLine(line),
    }));
  });
}

async function loadContent(filePath) {
  if (!filePath) {
    throw new Error('Informe o caminho do arquivo de logs.');
  }

  return readFile(filePath, 'utf8');
}

async function main() {
  const [, , mode = 'scan', filePath] = process.argv;
  const content = await loadContent(filePath);

  if (mode === 'sanitize') {
    process.stdout.write(sanitizeLogLine(content));
    return;
  }

  if (mode !== 'scan') {
    throw new Error(`Modo nao suportado: ${mode}`);
  }

  const findings = scanLogContent(content);

  if (findings.length === 0) {
    console.log(`[log-gate] nenhum padrao bloqueante encontrado em ${filePath}`);
    return;
  }

  console.error(`[log-gate] ${findings.length} padrao(oes) bloqueante(s) encontrado(s) em ${filePath}`);

  for (const finding of findings) {
    console.error(
      `[log-gate] ${finding.ruleId} na linha ${finding.lineNumber}: ${finding.line}`,
    );
  }

  process.exitCode = 1;
}

const isDirectExecution =
  typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  main().catch((error) => {
    console.error('[log-gate] falha ao validar logs:', error);
    process.exit(1);
  });
}
