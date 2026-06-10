// Feature flags — flip to false (or delete usages) to kill a feature instantly.
// Keep every experimental/removable feature behind one of these so an A/B
// branch or a rollback is a one-line change.

// AI pre-verification of checks ("AI verifies first, then friends").
// Backend side is env-gated separately (AI_VERIFY_PROVIDER in backend .env);
// this flag only controls the UI feedback (badges/messages). Safe to disable
// independently — the API response simply gets ignored.
export const AI_VERIFY_UI = true;

// Pivot A/B: snap-style flow (personal habits + multi-friend checks + stories
// + pair verification streaks) vs. shared/group-habit focused home.
// The pivot branch sets this true to hide group-habit emphasis on Home.
export const PIVOT_SNAP_FLOW = true;
