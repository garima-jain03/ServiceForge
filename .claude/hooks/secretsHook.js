const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/, // AWS
  /AIza[0-9A-Za-z\-_]{35}/, // Google API key
  /0x[0-9a-fA-F]{40}/, // Ethereum private key-ish
  /-----BEGIN PRIVATE KEY-----/,
  /secret[_-]?key/i,
  /password\s*=/i
];

function containsSecret(content) {
  if (!content) return false;
  return SECRET_PATTERNS.some(re => re.test(content));
}

// Pulls proposed content out of whichever shape the matched tool used (Write uses
// `content`/`file_text`; Edit uses `new_string`); checks every candidate field so
// neither tool's payload shape is silently skipped.
function extractContent(toolInput) {
  if (!toolInput) return '';
  const candidates = [toolInput.content, toolInput.file_text, toolInput.new_string, toolInput.new_str];
  if (Array.isArray(toolInput.files)) {
    candidates.push(toolInput.files.map(f => f.content).join('\n'));
  }
  return candidates.filter(Boolean).join('\n');
}

// The PreToolUse hook runtime passes a JSON object via stdin with { tool_input }
try {
  const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const content = extractContent(input && input.tool_input);
  if (containsSecret(content)) {
    console.error('PreToolUse secretsHook: secret-like pattern detected, blocking write.');
    process.exit(2); // blocks the write
  }
  process.exit(0);
} catch (err) {
  // Fail closed: a security gate that fails open on its own error is not a gate.
  console.error('PreToolUse secretsHook: failed to parse input or run scan, blocking as a precaution', err);
  process.exit(2);
}
