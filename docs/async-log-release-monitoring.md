# Async Log Release Monitoring Checklist

Use this checklist for the first 24-48 hours after deploying async log processing.

## Service Health

- Confirm backend `/health` stays healthy under normal mobile traffic.
- Track request latency for `POST /api/logs` and `GET /api/logs/{log_id}`.
- Monitor 4xx/5xx error rates for `POST /api/logs`, `GET /api/logs/{log_id}`, and `POST /api/analyze-food`.

## Pending Lifecycle

- Measure count of logs in `pending` status over time.
- Alert if pending logs remain unresolved for more than 2 minutes.
- Compare pending->completed and pending->failed transition rates after release.

## Failure and Retry Signals

- Track failed analyses (`status=failed`) with error categories.
- Alert on unusual spikes in `failed` transitions.
- Verify duplicate-submit idempotency works (same idempotency key returns same log).

## User Experience Checks

- Confirm newly submitted logs appear instantly with a visible pending indicator.
- Confirm completed results replace pending state without duplicate entries.
- Confirm failed logs show clear status and remain visible for manual retry.

## Capacity and Backlog

- Watch throughput of async analysis tasks versus create-log traffic.
- Alert on growing backlog trend (pending creation rate > completion rate for sustained window).
- Record average time-to-completion and p95 completion time for analysis jobs.
