import { formatBytes } from "@utils/formatBytes.js";
import { MetricsSnapshot } from "../system/sys.js";
import { formatTimestamp } from "@utils/formatTimestamp.js";
import os from "os";

export const renderHealthHTML = (
  snap: MetricsSnapshot,
  meta: {
    status: string;
    service: string;
    version: string;
    environment: string;
    uptime: string;
    timestamp: string;
  }
): string => {
  const rows = [
    { Metric: "Timestamp", Value: formatTimestamp(snap.ts) },
    { Metric: "CPU Cores", Value: snap.cpu.cores },
    { Metric: "CPU Model", Value: snap.cpu.model },
    { Metric: "Load Avg", Value: snap.cpu.loadavg.join(", ") },
    { Metric: "Memory Total", Value: formatBytes(snap.memory.total) },
    { Metric: "Memory Used", Value: formatBytes(snap.memory.used) },
    { Metric: "Memory Free", Value: formatBytes(snap.memory.free) },
    { Metric: "Process PID", Value: snap.process.pid },
    { Metric: "Process Uptime (s)", Value: snap.process.uptime.toFixed(2) },
    { Metric: "Disk", Value: snap.disk || "N/A" },
    { Metric: "Public IP", Value: snap.publicIP || "N/A" },
  ];

  // 🔹 Collect & filter only external (non-internal) interfaces
  const netInterfaces = os.networkInterfaces();
  const network = Object.keys(netInterfaces).flatMap((iface) =>
    (netInterfaces[iface] || [])
      .filter((net) => !net.internal) // skip loopback/internal
      .map((net) => ({
        interface: iface,
        address: net.address,
        family: net.family,
        mac: net.mac,
        cidr: net.cidr,
      }))
  );

  const networkTable =
    network.length > 0
      ? `
        <h3>🌐 Network Interfaces</h3>
        <table>
          <tr><th>Interface</th><th>Address</th><th>Family</th><th>MAC</th><th>CIDR</th></tr>
          ${network
            .map(
              (n) =>
                `<tr>
                  <td>${n.interface}</td>
                  <td>${n.address}</td>
                  <td>${n.family}</td>
                  <td>${n.mac}</td>
                  <td>${n.cidr}</td>
                </tr>`
            )
            .join("")}
        </table>
      `
      : "<p><i>No external network interfaces detected</i></p>";

  return `
    <html>
      <head>
        <title>Health Check</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 80%; margin: 20px auto; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          tr:nth-child(even) { background: #fafafa; }
        </style>
      </head>
      <body>
        <h2>🚦 Service Health - ${meta.service}</h2>
        <p><b>Status:</b> ${meta.status}</p>
        <p><b>Version:</b> ${meta.version}</p>
        <p><b>Environment:</b> ${meta.environment}</p>
        <p><b>Uptime:</b> ${meta.uptime}</p>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          ${rows.map((r) => `<tr><td>${r.Metric}</td><td>${r.Value}</td></tr>`).join("")}
        </table>
        ${networkTable}
      </body>
    </html>
  `;
};
