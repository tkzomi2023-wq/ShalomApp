import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { StandingsGroup, FootballTeam } from "../types/football";
import { motion } from "motion/react";
import { List, Award, TrendingUp, HelpCircle } from "lucide-react";

interface D3LeagueTableProps {
  standings: StandingsGroup[];
}

interface TableRowData {
  team: FootballTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  rank: number;
}

export const D3LeagueTable: React.FC<D3LeagueTableProps> = ({ standings }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [sortBy, setSortBy] = useState<keyof TableRowData>("points");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const d3ContainerRef = useRef<HTMLDivElement>(null);

  // Set initial selected group
  useEffect(() => {
    if (standings.length > 0 && !selectedGroup) {
      setSelectedGroup(standings[0].group);
    }
  }, [standings, selectedGroup]);

  // Flatten or extract current group's team list with initial ranks
  const currentGroupData = standings.find((g) => g.group === selectedGroup);
  const rawRows: TableRowData[] = currentGroupData
    ? currentGroupData.teams.map((t, idx) => ({
        team: t.team,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        points: t.points,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        goalDifference: t.goalDifference,
        rank: idx + 1,
      }))
    : [];

  // Sort rows dynamically
  const sortedRows = [...rawRows].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === "team") {
      valA = a.team.name.toLowerCase();
      valB = b.team.name.toLowerCase();
    }

    if (valA < valB) return sortOrder === "desc" ? 1 : -1;
    if (valA > valB) return sortOrder === "desc" ? -1 : 1;
    
    // Secondary sort: points -> goalDifference -> goalsFor
    if (sortBy !== "points") {
      if (a.points !== b.points) return b.points - a.points;
    }
    if (sortBy !== "goalDifference") {
      if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    }
    return b.goalsFor - a.goalsFor;
  });

  const handleSort = (field: keyof TableRowData) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // D3-based dynamic table visualization & animation
  useEffect(() => {
    if (!d3ContainerRef.current || sortedRows.length === 0) return;

    // Clear previous D3 table container content to build cleanly
    const container = d3.select(d3ContainerRef.current);
    container.selectAll("*").remove();

    // Create a beautifully styled responsive table
    const table = container
      .append("table")
      .attr("class", "w-full text-left text-xs text-stone-800 dark:text-stone-200 border-collapse select-none");

    // Table Header (thead)
    const thead = table.append("thead");
    const headerRow = thead
      .append("tr")
      .attr("class", "text-[10px] text-stone-400 dark:text-stone-500 font-black uppercase border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 rounded-t-xl");

    // Header column configuration
    const cols: { label: string; key: keyof TableRowData; align: "left" | "center" | "right"; width?: string }[] = [
      { label: "Pos", key: "rank", align: "left", width: "w-10" },
      { label: "Team", key: "team", align: "left" },
      { label: "P", key: "played", align: "center", width: "w-10" },
      { label: "W", key: "won", align: "center", width: "w-10" },
      { label: "D", key: "drawn", align: "center", width: "w-10" },
      { label: "L", key: "lost", align: "center", width: "w-10" },
      { label: "GD", key: "goalDifference", align: "center", width: "w-12" },
      { label: "Pts", key: "points", align: "right", width: "w-14" },
      { label: "Form Chart", key: "points", align: "center", width: "w-32" }, // D3 dynamic SVG mini bar
    ];

    cols.forEach((col) => {
      const th = headerRow
        .append("th")
        .attr("class", `py-3 px-3 cursor-pointer hover:text-stone-700 dark:hover:text-stone-300 transition duration-150 ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"} ${col.width || ""}`)
        .on("click", () => {
          if (col.key !== "rank") {
            handleSort(col.key);
          }
        });

      // Show column sorting arrow
      const indicator = col.key === sortBy 
        ? (sortOrder === "desc" ? " ⬇" : " ⬆") 
        : "";
      th.html(`${col.label}<span class="text-[9px] text-emerald-500 font-bold">${indicator}</span>`);
    });

    // Table Body (tbody)
    const tbody = table.append("tbody");

    // Max points in current list for visual scale scaling
    const maxPoints = d3.max(sortedRows, (d) => d.points) || 1;

    // Selection of rows
    const rows = tbody
      .selectAll("tr")
      .data(sortedRows, (d: any) => d.team.id)
      .join(
        (enter) => {
          const r = enter
            .append("tr")
            .attr("class", "border-b border-stone-100 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-800/20 transition-all duration-300 opacity-0")
            .style("transform", "translateY(-10px)");
          
          r.transition()
            .duration(400)
            .style("opacity", "1")
            .style("transform", "translateY(0)");
          
          return r;
        },
        (update) => {
          update.style("transform", "translateY(0)");
          return update;
        },
        (exit) => exit.transition().duration(200).style("opacity", "0").style("transform", "translateY(10px)").remove()
      );

    // Append table cells
    rows.each(function (d, i) {
      const row = d3.select(this);
      row.selectAll("td").remove(); // clean updates

      // Position Rank
      row.append("td")
        .attr("class", "py-3 px-3 font-mono font-black text-stone-400 dark:text-stone-500 text-xs")
        .text(i + 1);

      // Team logo and name
      const teamTd = row.append("td").attr("class", "py-3 px-3 font-extrabold text-stone-850 dark:text-stone-100");
      const teamContainer = teamTd.append("div").attr("class", "flex items-center gap-2.5");
      teamContainer
        .append("img")
        .attr("src", d.team.logo || "")
        .attr("alt", d.team.name)
        .attr("referrerpolicy", "no-referrer")
        .attr("class", "w-5 h-5 object-contain");
      teamContainer
        .append("span")
        .attr("class", "truncate max-w-[120px] md:max-w-[180px]")
        .text(d.team.name);

      // Played, Won, Drawn, Lost
      row.append("td").attr("class", "py-3 px-3 text-center font-mono text-stone-550 dark:text-stone-400").text(d.played);
      row.append("td").attr("class", "py-3 px-3 text-center font-mono").text(d.won);
      row.append("td").attr("class", "py-3 px-3 text-center font-mono").text(d.drawn);
      row.append("td").attr("class", "py-3 px-3 text-center font-mono").text(d.lost);

      // Goal Difference
      const gdClass = d.goalDifference > 0 
        ? "text-emerald-600 dark:text-emerald-400 font-black font-mono" 
        : d.goalDifference < 0 
          ? "text-rose-600 font-black font-mono" 
          : "text-stone-400 font-mono";
      row.append("td")
        .attr("class", `py-3 px-3 text-center ${gdClass}`)
        .text(d.goalDifference > 0 ? `+${d.goalDifference}` : d.goalDifference);

      // Points
      row.append("td")
        .attr("class", "py-3 px-3 text-right font-mono font-black text-stone-950 dark:text-white text-sm")
        .text(d.points);

      // Interactive mini D3 SVG horizontal bar representing points contribution
      const chartTd = row.append("td").attr("class", "py-3 px-3 text-center align-middle w-32 hidden sm:table-cell");
      const svg = chartTd
        .append("svg")
        .attr("width", "100")
        .attr("height", "14")
        .attr("class", "overflow-visible block mx-auto");

      // Draw background bar
      svg.append("rect")
        .attr("width", "100")
        .attr("height", "8")
        .attr("rx", "4")
        .attr("y", "3")
        .attr("class", "fill-stone-100 dark:fill-stone-800");

      // Draw colored progress bar representing relative points
      const barWidth = (d.points / maxPoints) * 100;
      const bar = svg.append("rect")
        .attr("width", "0")
        .attr("height", "8")
        .attr("rx", "4")
        .attr("y", "3")
        .attr("class", "fill-emerald-500 dark:fill-emerald-400");

      bar.transition()
        .duration(800)
        .delay(i * 30)
        .attr("width", Math.max(5, barWidth).toString());
    });

  }, [sortedRows, sortBy, sortOrder]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-900 dark:text-white leading-tight">
                Interactive League Standings
              </h3>
              <p className="text-[11px] text-stone-400 font-bold mt-0.5">
                Dynamic D3-powered standings table. Click headers to sort.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[10px] font-black text-stone-400 uppercase whitespace-nowrap">
              Group Filter:
            </span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm"
            >
              {standings.map((g) => (
                <option key={g.group} value={g.group}>
                  {g.group}
                </option>
              ))}
            </select>
          </div>
        </div>

        {standings.length === 0 ? (
          <div className="py-16 text-center">
            <HelpCircle className="w-12 h-12 text-stone-300 mx-auto mb-3 stroke-[1.5]" />
            <p className="text-stone-500 text-xs font-semibold">No standings records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-stone-800">
            <div ref={d3ContainerRef} className="min-w-[600px]" />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 bg-stone-50 dark:bg-stone-900/50 rounded-xl p-3 border border-stone-100 dark:border-stone-900/40">
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
            <strong>D3 dynamic columns</strong> are fully interactive: Hover rows to highlight, click any header column (GD, W, D, L, Pts) to sort, and view the mini performance charts. Standings sync in real-time.
          </span>
        </div>
      </div>
    </motion.div>
  );
};
