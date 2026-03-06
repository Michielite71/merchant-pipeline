"use client";

import { useEffect, useState, useMemo } from "react";

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

const FUNNEL_COLORS = [
  "#0073ea", "#0060b9", "#004e96", "#003d75",
  "#579bfc", "#4eccc6", "#00c875", "#9d50dd", "#fdab3d",
];

const GROUP_ORDER = [
  "topics", "group_mkx1bnzx", "group_mksdq9bg",
  "group_mksdwekt", "group_mktca2fg", "group_mktry9g7",
];

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

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    fetchAllItems();
  }, []);

  async function fetchAllItems() {
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
  }

  const verticals = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const v = item.column_values.find((c) => c.id === "color_mksax617");
      if (v?.text) set.add(v.text);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => {
      const v = item.column_values.find((c) => c.id === "color_mksax617");
      return v?.text === activeFilter;
    });
  }, [items, activeFilter]);

  const funnelData = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const count = filteredItems.filter((item) => {
        const col = item.column_values.find((c) => c.id === stage.id);
        return col && getStageStatus(col.text) === "done";
      }).length;
      return { ...stage, count };
    });
  }, [filteredItems]);

  const maxFunnel = Math.max(...funnelData.map((d) => d.count), 1);

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
      g.items.sort((a, b) => getCompletedStageCount(b) - getCompletedStageCount(a));
    });

    return GROUP_ORDER.map((id) => groups[id]).filter(Boolean);
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        Loading merchants...
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Merchant Pipeline Dashboard</h1>
        <p>{filteredItems.length} merchants total</p>
      </div>

      <div className="filters">
        <button
          className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          All
        </button>
        {verticals.map((v) => (
          <button
            key={v}
            className={`filter-btn ${activeFilter === v ? "active" : ""}`}
            onClick={() => setActiveFilter(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="summary-cards">
        {groupData.map((g) => (
          <div key={g.id} className="summary-card">
            <div className="count" style={{ color: g.color }}>
              {g.items.length}
            </div>
            <div className="label">{g.title}</div>
          </div>
        ))}
      </div>

      <div className="funnel-section">
        <h2>Pipeline Funnel - Stages Completed</h2>
        <div className="funnel">
          {funnelData.map((stage, i) => (
            <div key={stage.id} className="funnel-stage">
              <div className="stage-label">{stage.label}</div>
              <div className="stage-bar-container">
                <div
                  className="stage-bar"
                  style={{
                    width: `${Math.max((stage.count / maxFunnel) * 100, 5)}%`,
                    background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                  }}
                >
                  {stage.count}
                </div>
              </div>
              <span className="stage-count">
                {filteredItems.length > 0
                  ? Math.round((stage.count / filteredItems.length) * 100)
                  : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pipeline-section">
        <h2>Merchants by Group</h2>
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
                  return (
                    <div key={item.id} className="merchant-card">
                      <div className="merchant-name">{item.name}</div>
                      <div className="merchant-vertical">
                        {vertical?.text || "N/A"}
                      </div>
                      <div className="merchant-stages">
                        {PIPELINE_STAGES.map((stage) => {
                          const col = item.column_values.find(
                            (c) => c.id === stage.id
                          );
                          const status = getStageStatus(col?.text);
                          return (
                            <div
                              key={stage.id}
                              className={`stage-dot ${status}`}
                              title={`${stage.label}: ${col?.text || "Empty"}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
