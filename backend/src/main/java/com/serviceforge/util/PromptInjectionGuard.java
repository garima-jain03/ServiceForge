package com.serviceforge.util;

import java.util.List;
import java.util.Locale;

/**
 * Java port of {@code tools/guardrails/enforcer.js}'s detectPromptInjection, kept in sync with
 * {@code pipeline/rules/guardrails-config.json}'s promptInjectionPatterns. See
 * pipeline/rules/job-notes-injection-guardrail.md for the rule this enforces.
 */
public final class PromptInjectionGuard {

    private static final List<String> DEFAULT_PATTERNS = List.of(
            "ignore prior", "ignore previous", "ignore instructions", "refund $");

    private PromptInjectionGuard() {
    }

    public static boolean isSuspicious(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String pattern : DEFAULT_PATTERNS) {
            if (lower.contains(pattern)) {
                return true;
            }
        }
        return false;
    }
}
