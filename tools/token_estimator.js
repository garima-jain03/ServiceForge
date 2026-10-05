#!/usr/bin/env node
// Simple token estimator CLI without external deps
// Usage: node token_estimator.js --systemChars 800 --retrievedChars 4000 --userChars 200 --outputChars 250 --pricePerK 0.0012

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        out[key] = val;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function estimateTokens(chars) {
  // heuristic: 4 characters per token
  return Math.max(1, Math.round(chars / 4));
}

const args = parseArgs(process.argv.slice(2));
const systemChars = Number(args.systemChars || 0);
const retrievedChars = Number(args.retrievedChars || 0);
const userChars = Number(args.userChars || 0);
const outputChars = Number(args.outputChars || 0);
const pricePerK = Number(args.pricePerK || 0); // price per 1000 tokens in USD

const inputTokens = estimateTokens(systemChars + retrievedChars + userChars);
const outputTokens = estimateTokens(outputChars);
const totalTokens = inputTokens + outputTokens;
const cost = pricePerK * (totalTokens / 1000);

console.log('Estimation result:');
console.log(`  systemChars: ${systemChars} -> ${estimateTokens(systemChars)} tokens`);
console.log(`  retrievedChars: ${retrievedChars} -> ${estimateTokens(retrievedChars)} tokens`);
console.log(`  userChars: ${userChars} -> ${estimateTokens(userChars)} tokens`);
console.log(`  inputTokens: ${inputTokens}`);
console.log(`  outputChars: ${outputChars} -> ${outputTokens} tokens`);
console.log(`  totalTokens: ${totalTokens}`);
if (pricePerK > 0) console.log(`  estimatedCost (USD): $${cost.toFixed(6)}`);

module.exports = { estimateTokens };
