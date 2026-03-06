"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

const PIPELINE_STAGES = [
  { id: "status", label: "1. Presentation" },
  { id: "color_mm0gvm7j", label: "1b. Call" },
  { id: "color_mksah081", label: "2. NDA" },
  { id: "color_mksa17kf", label: "3. MIF Form" },
  { id: "color_mksakysh", label: "4. Rates" },
  { id: "color_mksahbew", label: "5. KYC/AML" },
  { id: "color_mkwfzxr4", label: "6. SFP" },
  { id: "color_mksa9qkk", label: "7. Agreement" },
  { id: "color_mksabbma", label: "8. Integration" },
];

const GROUP_COLORS = {
  group_mkx1bnzx: "#757575",
  topics: "#df2f4a",
  group_mksdq9bg: "#ffcb00",
  group_mksdwekt: "#00c875",
  group_mktca2fg: "#ff642e",
  group_mktry9g7: "#ff007f",
};

const GROUP_LABELS = {
  group_mkx1bnzx: "Slow Onboarding",
  topics: "Onboarding/Introducing",
  group_mksdq9bg: "Integrating",
  group_mksdwekt: "Connected",
  group_mktca2fg: "Bolsa",
  group_mktry9g7: "Stopped by Processors",
};

const DONE_VALUES = [
  "Sent", "Signed", "Completed", "Approved", "Connected", "Done", "YES",
  "No need", "1. Credentials Sent", "2. Dashboard created", "3. Test Environment",
  "4. Merch testing", "5. Live",
];
const IN_PROGRESS_VALUES = [
  "Working on it", "Discussing", "In process", "Analyzing docs",
  "Waiting", "Waiting for documentation", "Draft sent", "Strategy Planning",
  "Slowed down", "Missing docs",
];
const STUCK_VALUES = ["Stuck", "PAUSED", "Not appproved", "Never/Stopped"];

const FUNNEL_COLORS = {
  done: "#00c875",
  "in-progress": "#fdab3d",
  stuck: "#df2f4a",
};

const GROUP_ORDER = [
  "topics", "group_mkx1bnzx", "group_mksdq9bg",
  "group_mksdwekt", "group_mktca2fg", "group_mktry9g7",
];

const SORT_OPTIONS = [
  { value: "progress-desc", label: "Progress (high to low)" },
  { value: "progress-asc", label: "Progress (low to high)" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
];

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function getStageStatus(value) {
  if (!value) return "none";
  if (DONE_VALUES.includes(value)) return "done";
  if (IN_PROGRESS_VALUES.includes(value)) return "in-progress";
  if (STUCK_VALUES.includes(value)) return "stuck";
  return "none";
}

function getCompletedStageCount(item) {
  return PIPELINE_STAGES.filter((stage) => {
    const col = item.column_values.find((c) => c.id === stage.id);
    return col && getStageStatus(col.text) === "done";
  }).length;
}

function getProgressPercent(item) {
  return Math.round((getCompletedStageCount(item) / PIPELINE_STAGES.length) * 100);
}

function getProgressColor(percent) {
  if (percent >= 80) return "#00c875";
  if (percent >= 50) return "#fdab3d";
  if (percent > 0) return "#579bfc";
  return "#c4c4c4";
}

function getProgressClass(percent) {
  if (percent >= 80) return "high";
  if (percent >= 50) return "medium";
  if (percent > 0) return "low";
  return "zero";
}

async function queryMonday(query) {
  const res = await fetch("/api/monday", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

const BOARD_ID = 2025086909;
const COLUMN_IDS = [
  "color_mksax617", "status", "color_mm0gvm7j", "color_mksah081",
  "color_mksa17kf", "color_mksakysh", "color_mksahbew", "color_mkwfzxr4",
  "color_mksa9qkk", "color_mksabbma", "color_mm0gj9q8", "color_mm0nh0ps",
];

const ITEMS_QUERY_FIELDS = `
  id name
  group { id title }
  column_values(ids: [${COLUMN_IDS.map((c) => `"${c}"`).join(", ")}]) { id text }
`;

function exportToCSV(items) {
  const headers = ["Name", "Group", "Vertical", "Progress %", ...PIPELINE_STAGES.map((s) => s.label)];
  const rows = items.map((item) => {
    const vertical = item.column_values.find((c) => c.id === "color_mksax617");
    const stages = PIPELINE_STAGES.map((stage) => {
      const col = item.column_values.find((c) => c.id === stage.id);
      return col?.text || "";
    });
    return [
      item.name,
      GROUP_LABELS[item.group.id] || item.group.title,
      vertical?.text || "",
      getProgressPercent(item),
      ...stages,
    ];
  });

  const csv = [headers, ...rows].map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `merchant-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("progress-desc");
  const [expandedItem, setExpandedItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAllItems = useCallback(async () => {
    setLoading(true);
    let allItems = [];

    try {
      const firstRes = await queryMonday(`{
        boards(ids: [${BOARD_ID}]) {
          items_page(limit: 100) {
            cursor
            items { ${ITEMS_QUERY_FIELDS} }
          }
        }
      }`);

      const page = firstRes.data.boards[0].items_page;
      allItems = page.items;
      let cursor = page.cursor;

      while (cursor) {
        const nextRes = await queryMonday(`{
          next_items_page(limit: 100, cursor: "${cursor}") {
            cursor
            items { ${ITEMS_QUERY_FIELDS} }
          }
        }`);
        const nextPage = nextRes.data.next_items_page;
        allItems = allItems.concat(nextPage.items);
        cursor = nextPage.cursor;
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    }

    setItems(allItems);
    setLoading(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchAllItems();
    const interval = setInterval(fetchAllItems, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchAllItems]);

  const verticals = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const v = item.column_values.find((c) => c.id === "color_mksax617");
      if (v?.text) set.add(v.text);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeFilter !== "all") {
      result = result.filter((item) => {
        const v = item.column_values.find((c) => c.id === "color_mksax617");
        return v?.text === activeFilter;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeFilter, searchQuery]);

  const sortedItems = useCallback((itemList) => {
    return [...itemList].sort((a, b) => {
      switch (sortBy) {
        case "progress-desc":
          return getCompletedStageCount(b) - getCompletedStageCount(a);
        case "progress-asc":
          return getCompletedStageCount(a) - getCompletedStageCount(b);
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
  }, [sortBy]);

  const funnelData = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      let done = 0, inProgress = 0, stuck = 0;
      filteredItems.forEach((item) => {
        const col = item.column_values.find((c) => c.id === stage.id);
        const status = getStageStatus(col?.text);
        if (status === "done") done++;
        else if (status === "in-progress") inProgress++;
        else if (status === "stuck") stuck++;
      });
      return { ...stage, done, inProgress, stuck };
    });
  }, [filteredItems]);

  const maxFunnel = Math.max(...funnelData.map((d) => d.done + d.inProgress + d.stuck), 1);

  const groupData = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      const gid = item.group.id;
      if (!groups[gid]) {
        groups[gid] = {
          id: gid,
          title: GROUP_LABELS[gid] || item.group.title,
          color: GROUP_COLORS[gid] || "#0073ea",
          items: [],
        };
      }
      groups[gid].items.push(item);
    });

    Object.values(groups).forEach((g) => {
      g.items = sortedItems(g.items);
    });

    return GROUP_ORDER.map((id) => groups[id]).filter(Boolean);
  }, [filteredItems, sortedItems]);

  const totalItems = items.length;

  if (loading && items.length === 0) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading merchants...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-top">
          <div>
            <h1>Merchant Pipeline</h1>
            <div className="header-meta">
              <span className="count-badge">{filteredItems.length}</span>
              <span>merchants{activeFilter !== "all" ? ` in ${activeFilter}` : ""}</span>
              {lastUpdated && (
                <span className="last-updated">
                  · {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              {loading && <span className="refreshing">Refreshing...</span>}
            </div>
          </div>
          <div className="header-actions">
            <button className="action-btn" onClick={fetchAllItems} disabled={loading}>
              Refresh
            </button>
            <button className="action-btn primary" onClick={() => exportToCSV(filteredItems)}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search merchants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Vertical Filters */}
      <div className="filters">
        <button
          className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          All ({totalItems})
        </button>
        {verticals.map((v) => {
          const count = items.filter((item) => {
            const vert = item.column_values.find((c) => c.id === "color_mksax617");
            return vert?.text === v;
          }).length;
          return (
            <button
              key={v}
              className={`filter-btn ${activeFilter === v ? "active" : ""}`}
              onClick={() => setActiveFilter(v)}
            >
              {v} ({count})
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        {groupData.map((g) => (
          <div
            key={g.id}
            className="summary-card"
            style={{ borderLeftColor: g.color }}
          >
            <div className="count" style={{ color: g.color }}>
              {g.items.length}
            </div>
            <div className="label">{g.title}</div>
            <div
              className="card-bar"
              style={{
                width: `${totalItems > 0 ? (g.items.length / totalItems) * 100 : 0}%`,
                background: g.color,
                opacity: 0.3,
              }}
            />
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="funnel-section">
        <h2>Pipeline Funnel</h2>
        <p className="funnel-subtitle">
          Stage completion across {filteredItems.length} merchants
        </p>
        <div className="funnel-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#00c875" }} /> Done
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#fdab3d" }} /> In Progress
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#df2f4a" }} /> Stuck
          </span>
        </div>
        <div className="funnel">
          {funnelData.map((stage) => {
            const total = stage.done + stage.inProgress + stage.stuck;
            return (
              <div key={stage.id} className="funnel-stage">
                <div className="stage-label">{stage.label}</div>
                <div className="stage-bar-container">
                  <div className="stage-bar-stacked">
                    {stage.done > 0 && (
                      <div
                        className="bar-segment"
                        style={{
                          width: `${(stage.done / maxFunnel) * 100}%`,
                          background: FUNNEL_COLORS.done,
                        }}
                      >
                        {stage.done}
                      </div>
                    )}
                    {stage.inProgress > 0 && (
                      <div
                        className="bar-segment"
                        style={{
                          width: `${(stage.inProgress / maxFunnel) * 100}%`,
                          background: FUNNEL_COLORS["in-progress"],
                        }}
                      >
                        {stage.inProgress}
                      </div>
                    )}
                    {stage.stuck > 0 && (
                      <div
                        className="bar-segment"
                        style={{
                          width: `${(stage.stuck / maxFunnel) * 100}%`,
                          background: FUNNEL_COLORS.stuck,
                        }}
                      >
                        {stage.stuck}
                      </div>
                    )}
                  </div>
                </div>
                <span className="stage-count">
                  {total}/{filteredItems.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">O</div>
          <h3>No merchants found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}

      {/* Pipeline Columns */}
      {filteredItems.length > 0 && (
        <div className="pipeline-section">
          <div className="pipeline-section-header">
            <h2>Merchants by Group</h2>
          </div>
          <div className="pipeline-columns">
            {groupData.map((group) => (
              <div key={group.id} className="pipeline-column">
                <div
                  className="pipeline-column-header"
                  style={{ background: group.color }}
                >
                  {group.title}
                  <span className="col-count">{group.items.length}</span>
                </div>
                <div className="pipeline-column-items">
                  {group.items.map((item) => {
                    const vertical = item.column_values.find(
                      (c) => c.id === "color_mksax617"
                    );
                    const progress = getProgressPercent(item);
                    const isExpanded = expandedItem === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`merchant-card ${isExpanded ? "expanded" : ""}`}
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      >
                        <div className="merchant-card-top">
                          <div>
                            <div className="merchant-name">{item.name}</div>
                            <div className="merchant-vertical">
                              {vertical?.text || "N/A"}
                            </div>
                          </div>
                          <div className={`merchant-progress-badge ${getProgressClass(progress)}`}>
                            {progress}%
                          </div>
                        </div>

                        <div className="progress-bar-container">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${progress}%`,
                              background: getProgressColor(progress),
                            }}
                          />
                        </div>

                        <div className="merchant-stages">
                          {PIPELINE_STAGES.map((stage) => {
                            const col = item.column_values.find(
                              (c) => c.id === stage.id
                            );
                            const status = getStageStatus(col?.text);
                            return (
                              <div key={stage.id} className="stage-dot-wrapper">
                                <div className={`stage-dot ${status}`} />
                                <div className="stage-tooltip">
                                  <strong>{stage.label}</strong>
                                  <br />
                                  {col?.text || "Empty"}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {isExpanded && (
                          <div className="merchant-detail">
                            {PIPELINE_STAGES.map((stage) => {
                              const col = item.column_values.find(
                                (c) => c.id === stage.id
                              );
                              const status = getStageStatus(col?.text);
                              return (
                                <div key={stage.id} className="detail-row">
                                  <span className={`detail-indicator ${status}`} />
                                  <span className="detail-label">{stage.label}</span>
                                  <span className={`detail-value ${status}`}>
                                    {col?.text || "\u2014"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
