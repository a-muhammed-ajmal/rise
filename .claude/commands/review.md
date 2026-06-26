# /review

Review the current git diff for code quality and issues.

## Checklist

Analyze the staged changes and provide findings for:

1. **Security Vulnerabilities** — Any potential security issues:
   - Hardcoded secrets, API keys, credentials
   - SQL injection risks or unsafe query patterns
   - XSS vulnerabilities in DOM manipulation
   - CSRF token handling
   - Authentication/authorization bypasses
   - Input validation gaps

2. **Performance Issues** — Optimization opportunities:
   - Unnecessary loops or nested operations
   - Missing memoization or caching
   - Database query inefficiencies
   - Large bundle size increases
   - N+1 query problems
   - Missing indexes or poor algorithm choices

3. **Missing Error Handling** — Exception coverage gaps:
   - Unhandled promise rejections
   - Missing try/catch blocks
   - No null/undefined checks
   - Graceful degradation for edge cases
   - Missing timeout handling

4. **Test Coverage Gaps** — Testing deficiencies:
   - New functions or methods without tests
   - Edge cases not covered
   - Missing integration or E2E tests
   - Untested error paths
   - Low coverage percentage for critical paths

## Output Format

Format findings as a **prioritized list** with severity ratings:

- **CRITICAL** — Must fix before merge (security, data loss risk)
- **HIGH** — Should fix before merge (significant performance/UX impact)
- **MEDIUM** — Fix soon (code quality, maintainability)
- **LOW** — Nice to have (minor improvements, style)

For each finding, provide:
- The specific line(s) or function affected
- Why it's a concern
- Suggested fix (if applicable)

End with a summary: "Safe to merge" or "Recommend changes before merge".