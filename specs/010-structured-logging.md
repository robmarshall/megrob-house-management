# Spec 010: Structured Logging & Error Handling

## Problem
The backend uses `console.log`/`console.error` for all logging. There's no structured logging, no log levels, and no centralized error handling. Production debugging is difficult.

## Requirements
- Replace all `console.log`/`console.error` with structured logger (pino)
- Log levels: debug, info, warn, error
- Request logging middleware: method, path, status, duration, userId
- Error handling middleware: catch unhandled errors, log with stack trace, return safe error response
- Correlation IDs: assign unique request ID to each request for tracing
- Environment-aware: pretty print in development, JSON in production

## Files to Create/Modify
- `backend/src/lib/logger.ts` (new - pino configuration)
- `backend/src/middleware/requestLogger.ts` (new - request/response logging)
- `backend/src/middleware/errorHandler.ts` (new - centralized error handling)
- `backend/src/index.ts` (register middleware)
- All route files (replace console.log with logger calls)
- `backend/package.json` (add pino, pino-pretty dependencies)

## Out of Scope
- External log aggregation (Logtail, Datadog)
- APM/distributed tracing
- Alerting
