// =============================================================================
// Observe OPAL Extension — Demo File
// Open this file in VS Code with the Observe OPAL extension to see:
//   - Syntax highlighting for verbs, functions, strings, comments
//   - IntelliSense autocomplete (type '|' or start a new line)
//   - Hover documentation on any verb or function
//   - Diagnostics for common mistakes
// =============================================================================

// --- Basic filtering ---
filter severity = "ERROR" or severity = "CRITICAL"

// --- Column projection ---
| make_col
    source_ip:get_field(FIELDS, "source.ip"),
    user:get_field(FIELDS, "user.name"),
    timestamp_str:format_time(@."_time", "YYYY-MM-DD HH:MI:SS"),
    message:upper(get_field(FIELDS, "message"))

// --- Aggregation ---
| statsby
    error_count:count(1),
    first_seen:min(@."_time"),
    last_seen:max(@."_time"),
    group_by(source_ip, user)

// --- Post-aggregation filtering ---
| filter error_count > 10

// --- Sorting ---
| order_by error_count desc

// --- Top results ---
| topk 25, error_count

// --- Time series example ---
// timechart 5m, event_count:count(1)

// --- Join example ---
// leftjoin source_ip = @IPReputation.ip, @IPReputation
// | make_col reputation:@IPReputation.score
