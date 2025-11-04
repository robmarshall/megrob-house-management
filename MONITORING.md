# Monitoring Strategy for Home Management App

## Overview

This document outlines the monitoring and observability strategy for the home management application. While not currently implemented, this serves as a roadmap for adding comprehensive monitoring when moving to production.

---

## 1. Logging Strategy

### Backend Logging (Recommended: Pino)

**Why Pino?**
- Fast, low-overhead structured logging
- Native JSON output for easy parsing
- Built-in serializers for common objects
- Great for serverless and containerized environments

**Implementation Plan:**

```typescript
// backend/src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// Usage examples:
logger.info({ userId, listId }, 'Shopping list created');
logger.error({ error, userId, endpoint }, 'Failed to create list');
logger.warn({ userId, attemptCount }, 'Rate limit approaching');
```

**What to Log:**

| Event Type | Level | Required Fields | Example |
|------------|-------|-----------------|---------|
| Request Start | debug | `method`, `path`, `userId` | GET /api/shopping-lists |
| Request Complete | info | `method`, `path`, `status`, `duration` | 200 OK in 45ms |
| Database Query | debug | `query`, `duration` | SELECT took 12ms |
| Authentication | info | `userId`, `action` | User login successful |
| Authorization Failure | warn | `userId`, `resource`, `action` | Access denied to list #123 |
| Validation Error | info | `userId`, `field`, `error` | Invalid email format |
| Server Error | error | `error`, `stack`, `context` | Database connection failed |
| Rate Limit Hit | warn | `userId`, `endpoint`, `limit` | User exceeded 100 req/min |

**Structured Logging Best Practices:**

```typescript
// ✅ GOOD - Structured with context
logger.info({
  userId: '123',
  listId: 456,
  itemCount: 10,
  duration: 45
}, 'Shopping list created successfully');

// ❌ BAD - Unstructured string interpolation
logger.info(`User ${userId} created list ${listId} with ${itemCount} items in ${duration}ms`);
```

---

## 2. Error Tracking

### Recommended: Sentry

**Why Sentry?**
- Automatic error capture and stack traces
- Release tracking and source maps
- User context and breadcrumbs
- Performance monitoring built-in
- Free tier suitable for personal projects

**Frontend Setup:**

```typescript
// frontend/src/lib/sentry.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Wrap App component
<Sentry.ErrorBoundary fallback={<ErrorPage />}>
  <App />
</Sentry.ErrorBoundary>
```

**Backend Setup:**

```typescript
// backend/src/lib/sentry.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Add to Hono middleware
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    Sentry.captureException(error, {
      user: { id: getUserId(c) },
      extra: { endpoint: c.req.path, method: c.req.method }
    });
    throw error;
  }
});
```

**What to Track:**

- All unhandled exceptions
- API request failures (4xx, 5xx)
- Database connection errors
- Authentication/authorization failures
- Failed form submissions
- React component errors (ErrorBoundary)
- Network timeouts

**User Context:**

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  // Never include passwords or tokens!
});
```

---

## 3. Performance Monitoring

### Application Performance Monitoring (APM)

**Recommended Tools:**
- **Sentry Performance:** Built into Sentry, tracks transaction times
- **New Relic:** Comprehensive APM with database query tracking
- **Datadog:** Enterprise-grade, great for microservices

**Key Metrics to Track:**

| Metric | Target | Alert Threshold | Description |
|--------|--------|-----------------|-------------|
| API Response Time (p95) | < 200ms | > 500ms | 95th percentile API latency |
| API Response Time (p99) | < 500ms | > 1000ms | 99th percentile API latency |
| Database Query Time | < 50ms | > 200ms | Average DB query duration |
| Error Rate | < 1% | > 5% | Percentage of failed requests |
| Frontend Load Time | < 2s | > 5s | Time to interactive |
| React Component Render | < 16ms | > 100ms | Component render duration |

**Backend Instrumentation:**

```typescript
// Middleware to track request duration
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, 'Request completed');

  // Send to APM
  // metrics.recordDuration('api.request', duration, { path: c.req.path });
});
```

**Frontend Instrumentation:**

```typescript
// Track page navigation timing
import { useEffect } from 'react';

export function usePageLoadTracking() {
  useEffect(() => {
    const navigationTiming = performance.getEntriesByType('navigation')[0];
    // Send to APM
    // metrics.recordTiming('page.load', navigationTiming.duration);
  }, []);
}
```

---

## 4. Health Checks

### Enhanced Health Endpoint

Currently: Basic `/health` endpoint returns static JSON.

**Recommended Enhancement:**

```typescript
// backend/src/routes/health.ts
import { db } from '../db/index.js';
import { supabase } from '../lib/supabase.js';

app.get('/health', async (c) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    checks: {
      database: 'unknown',
      supabase: 'unknown',
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Check database connection
  try {
    await db.execute('SELECT 1');
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
    logger.error({ error }, 'Database health check failed');
  }

  // Check Supabase API
  try {
    const { error } = await supabase.auth.getSession();
    checks.checks.supabase = error ? 'unhealthy' : 'healthy';
  } catch (error) {
    checks.checks.supabase = 'unhealthy';
    checks.status = 'degraded';
    logger.error({ error }, 'Supabase health check failed');
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return c.json(checks, statusCode);
});
```

**Health Check Monitoring:**
- Set up external monitoring (UptimeRobot, Pingdom, or StatusCake)
- Check `/health` endpoint every 1-5 minutes
- Alert if status is not 200 OK
- Track uptime percentage (target: 99.9%)

---

## 5. Alerting Strategy

### Alert Levels

| Severity | Response Time | Notification Method | Example |
|----------|---------------|---------------------|---------|
| Critical | Immediate | SMS + Email + Slack | Server down, database offline |
| High | 5 minutes | Email + Slack | Error rate > 10%, API timeout |
| Medium | 30 minutes | Email | Error rate > 5%, slow queries |
| Low | 1 hour | Email only | Disk space warning, rate limit hit |

### Alert Rules

**Critical Alerts:**
- Server/service is down (health check fails)
- Database connection lost
- Error rate exceeds 10%
- API response time p99 > 5 seconds

**High Priority Alerts:**
- Error rate exceeds 5%
- API response time p95 > 1 second
- Memory usage > 90%
- Disk space < 10% free

**Medium Priority Alerts:**
- Error rate exceeds 2%
- API response time p95 > 500ms
- Slow database queries (> 500ms)
- High rate limit usage (> 80% of limit)

**Low Priority Alerts:**
- Disk space < 20% free
- Memory usage > 70%
- Unusual traffic patterns

---

## 6. Metrics to Track

### Business Metrics

| Metric | Description | Importance |
|--------|-------------|------------|
| Daily Active Users (DAU) | Unique users per day | User engagement |
| Shopping Lists Created | New lists per day/week | Feature usage |
| Items Added | Items added to lists | Core activity |
| Items Checked | Completion rate | User success |
| User Retention (7-day) | Users returning after 7 days | Product stickiness |
| Session Duration | Average time spent in app | Engagement quality |

### Technical Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Request Rate | Requests per second | Monitor for spikes |
| Error Rate | Failed requests / total | < 1% |
| Database Connections | Active DB connections | < 80% of pool |
| Memory Usage | Heap usage | < 80% of limit |
| CPU Usage | Processor utilization | < 70% average |
| Network I/O | Bytes in/out per second | Monitor for anomalies |

### Database Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Query Duration (avg) | < 50ms | > 200ms |
| Query Duration (p95) | < 100ms | > 500ms |
| Slow Queries | 0 per hour | > 5 per hour |
| Connection Pool Usage | < 70% | > 90% |
| Deadlocks | 0 | > 0 |
| Table Size | Monitor growth | Unexpected spike |

---

## 7. Implementation Roadmap

### Phase 1: Essential Monitoring (Week 1)

**Backend:**
- [ ] Install Pino for structured logging
- [ ] Add request/response logging middleware
- [ ] Enhance `/health` endpoint with dependency checks
- [ ] Set up basic error handling with stack traces

**Frontend:**
- [ ] Set up Sentry error tracking
- [ ] Add ErrorBoundary components
- [ ] Track unhandled promise rejections

**DevOps:**
- [ ] Set up UptimeRobot for health checks (free tier)
- [ ] Configure email alerts for downtime

**Estimated Time:** 4-6 hours

---

### Phase 2: Performance Monitoring (Week 2)

**Backend:**
- [ ] Add request duration tracking
- [ ] Track database query performance
- [ ] Log slow queries (> 200ms)
- [ ] Add rate limiting metrics

**Frontend:**
- [ ] Set up Sentry Performance monitoring
- [ ] Track page load times
- [ ] Monitor React component render performance
- [ ] Track API call durations

**DevOps:**
- [ ] Set up monitoring dashboard (Grafana or similar)
- [ ] Create performance baseline metrics

**Estimated Time:** 6-8 hours

---

### Phase 3: Advanced Monitoring (Week 3+)

**Backend:**
- [ ] Implement comprehensive APM (New Relic/Datadog)
- [ ] Add distributed tracing
- [ ] Set up log aggregation (Logtail, Papertrail, or self-hosted Loki)
- [ ] Create custom dashboards

**Frontend:**
- [ ] Add user session replay (Sentry Replay)
- [ ] Track business metrics (feature usage, engagement)
- [ ] A/B testing instrumentation

**DevOps:**
- [ ] Set up alerting with PagerDuty or Opsgenie
- [ ] Create runbooks for common issues
- [ ] Implement automated remediation for known issues
- [ ] Set up status page (Statuspage.io)

**Estimated Time:** 10-15 hours

---

## 8. Cost Estimation

### Free Tier Options (Personal Project)

| Service | Free Tier | Paid Tier Starts At |
|---------|-----------|---------------------|
| Sentry | 5K errors/month, 10K transactions | $29/month |
| UptimeRobot | 50 monitors, 5-min checks | $7/month |
| Logtail (Logging) | 1GB logs/month | $5/month |
| Grafana Cloud | 10K metrics, 50GB logs | Free forever |

**Total for Free Tier:** $0/month (sufficient for personal/family use)

### Production Scale Options

| Service | Cost | Use Case |
|---------|------|----------|
| Sentry Pro | $29/month | 50K errors, 100K transactions |
| New Relic | $99/month | Full APM, 100GB logs |
| Datadog | $15/host/month | Enterprise APM |
| PagerDuty | $21/user/month | On-call management |

**Total for Production:** ~$150-200/month

---

## 9. Quick Wins (Immediate Actions)

### Zero-Cost Improvements (Today)

1. **Add structured console logging** (currently using basic `console.error`)
   - Wrap all console.error calls with context objects
   - Estimated time: 30 minutes

2. **Create a simple error logger utility:**
   ```typescript
   // backend/src/lib/errorLogger.ts
   export function logError(error: Error, context: Record<string, unknown>) {
     console.error(JSON.stringify({
       timestamp: new Date().toISOString(),
       error: {
         message: error.message,
         stack: error.stack,
         name: error.name,
       },
       ...context,
     }));
   }
   ```
   - Estimated time: 15 minutes

3. **Add request ID to all requests** (for tracing)
   ```typescript
   import { randomUUID } from 'crypto';

   app.use('*', async (c, next) => {
     c.set('requestId', randomUUID());
     await next();
   });
   ```
   - Estimated time: 10 minutes

4. **Create performance markers in frontend:**
   ```typescript
   performance.mark('shopping-list-load-start');
   // ... fetch data ...
   performance.mark('shopping-list-load-end');
   performance.measure('shopping-list-load', 'shopping-list-load-start', 'shopping-list-load-end');
   ```
   - Estimated time: 20 minutes

**Total Quick Wins Time:** ~1.5 hours

---

## 10. Monitoring Checklist

### Pre-Production

- [ ] Structured logging implemented
- [ ] Error tracking configured (Sentry or equivalent)
- [ ] Health checks working and monitored
- [ ] Uptime monitoring configured
- [ ] Email alerts for critical issues
- [ ] Performance baselines established
- [ ] Database slow query logging enabled

### Production-Ready

- [ ] APM solution deployed
- [ ] Alerting rules configured
- [ ] Dashboards created for key metrics
- [ ] Log aggregation and search enabled
- [ ] On-call rotation established (if team)
- [ ] Runbooks created for common issues
- [ ] Status page configured
- [ ] Post-mortem process defined

---

## 11. Useful Resources

- **Pino Documentation:** https://github.com/pinojs/pino
- **Sentry Setup Guide:** https://docs.sentry.io/platforms/javascript/guides/react/
- **Hono Middleware:** https://hono.dev/docs/guides/middleware
- **Grafana Cloud Free Tier:** https://grafana.com/products/cloud/
- **12-Factor App Logging:** https://12factor.net/logs

---

## Summary

**Current State:** Minimal logging (console.error), no error tracking, basic health checks.

**Next Steps:**
1. Implement structured logging with context (1-2 hours)
2. Set up Sentry for error tracking (1 hour)
3. Enhance health endpoint with dependency checks (1 hour)
4. Configure UptimeRobot for basic uptime monitoring (15 minutes)

**Long-term Goal:** Full observability stack with APM, alerting, and automated incident response.

**Recommendation:** Start with Phase 1 (Essential Monitoring) before production deployment, implement Phase 2 within first month of production operation.
