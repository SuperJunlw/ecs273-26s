import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { isEmpty, debounce } from "lodash";

import { ComponentSize, Margin } from "../types";

interface StockRow {
  date:  Date;
  open:  number;
  high:  number;
  low:   number;
  close: number;
}

type LineKey = "open" | "high" | "low" | "close";

const margin = { left: 60, right: 100, top: 20, bottom: 80 } as Margin;

export function LineChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [rows, setRows] = useState<StockRow[]>([]);

  useEffect(() => {
    const initialStock = (d3.select("#bar-select").node() as HTMLSelectElement)?.value ?? "";
    if (initialStock) loadData(initialStock, setRows);

    d3.select("#bar-select").on("change.linechart", function (event) {
      loadData(event.target.value, setRows);
    });

    return () => {
      d3.select("#bar-select").on("change.linechart", null);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    const resizeObserver = new ResizeObserver(
      debounce((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target !== containerRef.current) continue;
          const { width, height } = entry.contentRect as ComponentSize;
          if (width && height && !isEmpty(rows)) {
            drawChart(svgRef.current!, rows, width, height);
          }
        }
      }, 100)
    );

    resizeObserver.observe(containerRef.current);

    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width && height && !isEmpty(rows)) {
      drawChart(svgRef.current!, rows, width, height);
    }

    return () => resizeObserver.disconnect();
  }, [rows]);

  return (
    <div className="chart-container d-flex" ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <svg id="line-svg" ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
}

function loadData(ticker: string, setRows: (rows: StockRow[]) => void) {
  d3.csv(`/data/stockdata/${ticker}.csv`).then((raw) => {
    const parsed: StockRow[] = raw
      .map((d) => ({
        date:  new Date(d["Date"]  ?? d["date"]  ?? ""),
        open:  +(d["Open"]  ?? d["open"]  ?? 0),
        high:  +(d["High"]  ?? d["high"]  ?? 0),
        low:   +(d["Low"]   ?? d["low"]   ?? 0),
        close: +(d["Close"] ?? d["close"] ?? 0),
      }))
      .filter((d) => !isNaN(d.date.getTime()));

    parsed.sort((a, b) => a.date.getTime() - b.date.getTime());
    setRows(parsed);
  });
}

const LINE_META: { key: LineKey; label: string; color: string }[] = [
  { key: "open",  label: "Open",  color: "blue" },
  { key: "high",  label: "High",  color: "green" },
  { key: "low",   label: "Low",   color: "red" },
  { key: "close", label: "Close", color: "orange" },
];

function drawChart(
  svgElement: SVGSVGElement,
  rows: StockRow[],
  width: number,
  height: number
) {
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  const innerW = width  - margin.left - margin.right;
  const innerH = height - margin.top  - margin.bottom;

  svg.append("defs")
    .append("clipPath")
    .attr("id", "line-clip")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width",  innerW)
    .attr("height", innerH);

  const xExtent   = d3.extent(rows, (d) => d.date) as [Date, Date];
  const allValues = rows.flatMap((d) => [d.open, d.high, d.low, d.close]);
  const yExtent   = d3.extent(allValues) as [number, number];

  const xScale = d3.scaleTime()
    .domain(xExtent)
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([yExtent[0] * 0.98, yExtent[1] * 1.02])
    .range([height - margin.bottom, margin.top]);

  const xAxisG = svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(8)
        .tickFormat(d3.timeFormat("%b %Y") as any)
    );

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).ticks(6));

  svg.append("g")
    .attr("transform", `translate(18, ${height / 2}) rotate(-90)`)
    .append("text")
    .text("Price (USD)")
    .style("font-size", ".8rem");

  svg.append("g")
    .attr("transform", `translate(${width / 2 - margin.left}, ${height - margin.top - 5})`)
    .append("text")
    .text("Date")
    .style("font-size", ".8rem");

  svg.append("g")
    .append("text")
    .attr("transform", `translate(${width / 2}, ${height - margin.top + 5})`)
    .attr("dy", "0.5rem")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(`${(d3.select("#bar-select").node() as HTMLSelectElement)?.value ?? ""} Stock Price`);

  const linesG = svg.append("g").attr("clip-path", "url(#line-clip)");

  const lineGen = (key: LineKey, xS: d3.ScaleTime<number, number>) =>
    d3.line<StockRow>()
      .x((d) => xS(d.date))
      .y((d) => yScale(d[key]))
      .defined((d) => !isNaN(d[key]));

  LINE_META.forEach(({ key, color }) => {
    linesG.append("path")
      .datum(rows)
      .attr("class", `line-${key}`)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("d", lineGen(key, xScale));
  });

  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

  LINE_META.forEach(({ label, color }, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
    row.append("line")
      .attr("x1", 0).attr("x2", 18)
      .attr("y1", 7).attr("y2", 7)
      .attr("stroke", color)
      .attr("stroke-width", 2.5);
    row.append("text")
      .attr("x", 22).attr("y", 11)
      .style("font-size", ".8rem")
      .text(label);
  });

  // Scrollbar
  const scrollBarH = 8;
  const scrollY = height - margin.bottom + 30;

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", scrollY)
    .attr("width", innerW)
    .attr("height", scrollBarH)
    .attr("rx", 4)
    .attr("fill", "#ccc");

  const scrollThumb = svg.append("rect")
    .attr("x", margin.left)
    .attr("y", scrollY)
    .attr("width", innerW)
    .attr("height", scrollBarH)
    .attr("rx", 4)
    .attr("fill", "#888")
    .attr("cursor", "pointer");

  function updateScrollThumb(transform: d3.ZoomTransform) {
    const scale = transform.k;
    const thumbW = Math.max(innerW / scale, 20);
    const maxPan = innerW * (scale - 1);
    const panRatio = maxPan > 0
      ? Math.min(Math.max(-transform.x, 0), maxPan) / maxPan
      : 0;
    const thumbX = margin.left + panRatio * (innerW - thumbW);
    scrollThumb
      .attr("x", thumbX)
      .attr("width", thumbW);
  }

  // Zoom + pan
  const zoom = d3.zoom<SVGRectElement, unknown>()
    .scaleExtent([1, 40])
    .translateExtent([[margin.left, 0], [width - margin.right, height]])
    .extent([[margin.left, 0], [width - margin.right, height]])
    .on("zoom", (event: d3.D3ZoomEvent<SVGRectElement, unknown>) => {
      const newX = event.transform.rescaleX(xScale);

      xAxisG.call(
        d3.axisBottom(newX)
          .ticks(8)
          .tickFormat(d3.timeFormat("%b %Y") as any)
      );

      LINE_META.forEach(({ key }) => {
        linesG.select(`.line-${key}`)
          .attr("d", lineGen(key, newX)(rows));
      });

      updateScrollThumb(event.transform);
    });

  // Overlay rect captures zoom/pan pointer events
  const overlay = svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width",  innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .attr("cursor", "grab")
    .call(zoom);

  // Drag scrollbar thumb to pan
  let dragStartX = 0;
  let dragStartTransform: d3.ZoomTransform = d3.zoomIdentity;

  scrollThumb.call(
    d3.drag<SVGRectElement, unknown>()
      .on("start", (event) => {
        dragStartX = event.x;
        dragStartTransform = d3.zoomTransform(overlay.node()!);
      })
      .on("drag", (event) => {
        const scale = dragStartTransform.k;
        const maxPan = innerW * (scale - 1);
        const thumbTravelW = innerW - innerW / scale;
        if (thumbTravelW <= 0) return;
        const dx = event.x - dragStartX;
        const ratio = dx / thumbTravelW;
        const newTx = Math.min(0, Math.max(-maxPan, dragStartTransform.x - ratio * maxPan));
        const newTransform = d3.zoomIdentity.translate(newTx, 0).scale(scale);
        (overlay as any).call(zoom.transform, newTransform);
      })
  );
}