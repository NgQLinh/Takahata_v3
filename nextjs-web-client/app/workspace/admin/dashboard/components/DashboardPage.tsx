"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";

import {
  getLatestMachineLogsAsync,
  getMachinesAsync,
} from "@/app/services/machine/MachineService";
import { MachineLog } from "@/app/types/machine/MachineLog";
import { MachineStatus } from "@/app/types/machine/MachineStatus";
import { Button, Card, Tooltip } from "antd";
import DetailPlant from "./DetailPlant";
import MaintenanceScheduleModal from "./MaintenanceScheduleModal";
import "./DashboardPage.css";

export const statusConfig: Record<
  MachineStatus,
  {
    text: string;
    color: string;
    foreground: string;
    icon: string;
  }
> = {
  [MachineStatus.None]: {
    text: "NONE",
    color: "#6c757d",
    foreground: "#fff",
    icon: "bi-circle",
  },

  [MachineStatus.Running]: {
    text: "RUNNING",
    color: "#198754",
    foreground: "#fff",
    icon: "bi-play-circle-fill",
  },

  [MachineStatus.Paused]: {
    text: "PAUSED",
    color: "#ffd166",
    foreground: "#212529",
    icon: "bi-pause-circle-fill",
  },

  [MachineStatus.Stopped]: {
    text: "STOPPED",
    color: "#fd7e14",
    foreground: "#fff",
    icon: "bi-stop-circle-fill",
  },

  [MachineStatus.Alarm]: {
    text: "ALARM",
    color: "#dc3545",
    foreground: "#fff",
    icon: "bi-exclamation-triangle-fill",
  },

  [MachineStatus.Maintenance]: {
    text: "MAINTENANCE",
    color: "#dc3545",
    foreground: "#fff",
    icon: "bi-tools",
  },

  [MachineStatus.Idle]: {
    text: "IDLE",
    color: "#ffc107",
    foreground: "#212529",
    icon: "bi-record-circle-fill",
  },
};

const MACHINE_GRID_GAP = 10;

export function DashboardPage() {
  const [now, setNow] = useState(dayjs());
  const [machineLogs, setMachineLogs] = useState<MachineLog[]>([]);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const machineGridRef = useRef<HTMLDivElement>(null);

  const [showPlan, setShowPlan] = useState(false);
  const [showMaintenanceSchedule, setShowMaintenanceSchedule] = useState(false);
  const [machineLog, setMachineLog] = useState<MachineLog | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<MachineStatus | null>(
    null,
  );

  const filteredMachineLogs = useMemo(() => {
    if (selectedStatus === null) {
      return machineLogs;
    }

    return machineLogs.filter(
      (log) => getMachineStatus(log) === selectedStatus,
    );
  }, [machineLogs, selectedStatus]);

  const machineLayout = useMemo(() => {
    const count = filteredMachineLogs.length;
    const { width, height } = gridSize;

    if (count === 0 || width === 0 || height === 0) {
      return null;
    }

    const idealRows = Math.sqrt((count * height) / width);
    let bestSize = 0;
    let bestRows = 1;
    let bestRowDistance = Number.POSITIVE_INFINITY;
    let bestColumns = count;
    let bestLandscapeSize = 0;
    let bestLandscapeRows = 1;
    let bestLandscapeColumns = count;
    let bestLandscapeRowDistance = Number.POSITIVE_INFINITY;

    for (let columns = 1; columns <= count; columns += 1) {
      const rows = Math.ceil(count / columns);
      const tileWidth =
        (width - MACHINE_GRID_GAP * (columns - 1)) / columns;
      const tileHeight = (height - MACHINE_GRID_GAP * (rows - 1)) / rows;
      const size = Math.floor(Math.min(tileWidth, tileHeight));
      const rowDistance = Math.abs(rows - idealRows);

      if (tileWidth <= 0 || tileHeight <= 0) {
        continue;
      }

      if (
        size > bestSize ||
        (size === bestSize &&
          (rowDistance < bestRowDistance ||
            (rowDistance === bestRowDistance && columns > bestColumns)))
      ) {
        bestSize = size;
        bestRows = rows;
        bestColumns = columns;
        bestRowDistance = rowDistance;
      }

      if (
        tileWidth >= tileHeight * 0.9 &&
        (size > bestLandscapeSize ||
          (size === bestLandscapeSize &&
            (rowDistance < bestLandscapeRowDistance ||
              (rowDistance === bestLandscapeRowDistance &&
                columns > bestLandscapeColumns))))
      ) {
        bestLandscapeSize = size;
        bestLandscapeRows = rows;
        bestLandscapeColumns = columns;
        bestLandscapeRowDistance = rowDistance;
      }
    }

    const useLandscapeLayout = bestLandscapeSize > 0;
    const rows = useLandscapeLayout ? bestLandscapeRows : bestRows;
    const columns = useLandscapeLayout ? bestLandscapeColumns : bestColumns;

    return {
      width: (width - MACHINE_GRID_GAP * (columns - 1)) / columns,
      height: (height - MACHINE_GRID_GAP * (rows - 1)) / rows,
      columns,
      rows,
    };
  }, [filteredMachineLogs.length, gridSize]);

  const machineRows = useMemo(() => {
    if (!machineLayout || filteredMachineLogs.length === 0) {
      return [];
    }

    return Array.from({ length: machineLayout.rows }, (_, rowIndex) =>
      filteredMachineLogs.slice(
        rowIndex * machineLayout.columns,
        (rowIndex + 1) * machineLayout.columns,
      ),
    );
  }, [filteredMachineLogs, machineLayout]);

  useEffect(() => {
    const grid = machineGridRef.current;
    if (!grid) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      setGridSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });

    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let loading = false;

    const load = async () => {
      if (loading) {
        return;
      }

      loading = true;
      try {
        const machines = await getMachinesAsync();
        const machineOrder = new Map(
          machines.map((machine, index) => [machine.id, index]),
        );
        const data = await getLatestMachineLogsAsync({
          machineIds: machines.map((machine) => machine.id),
        });

        data.sort(
          (first, second) =>
            (machineOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
            (machineOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER),
        );
        setMachineLogs(data);
      } catch (error) {
        console.log(error);
      } finally {
        loading = false;
      }
    };

    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const countStatus = (status: MachineStatus) =>
      machineLogs.filter((log) => getMachineStatus(log) === status).length;

    return {
      running: countStatus(MachineStatus.Running),
      paused: countStatus(MachineStatus.Paused),
      stopped: countStatus(MachineStatus.Stopped),
      idle: countStatus(MachineStatus.Idle),
      alarm: countStatus(MachineStatus.Alarm),
      maintenance: countStatus(MachineStatus.Maintenance),
      total: machineLogs.length,
    };
  }, [machineLogs]);

  return (
    <div
      className="container-fluid py-3 d-flex flex-column"
      style={{ height: "calc(100vh - 20px)" }}
    >
      {/* Summary */}
      {/* Summary */}
      <div className="row g-3 mb-3 shrink-0">
        <SummaryCard
          label="Running"
          value={summary.running}
          color="success"
          textColor={statusConfig[MachineStatus.Running].color}
          active={selectedStatus === MachineStatus.Running}
          onClick={() => setSelectedStatus(MachineStatus.Running)}
        />

        <SummaryCard
          label="Paused"
          value={summary.paused}
          color="warning"
          textColor={statusConfig[MachineStatus.Paused].color}
          active={selectedStatus === MachineStatus.Paused}
          onClick={() => setSelectedStatus(MachineStatus.Paused)}
        />

        <SummaryCard
          label="Stopped"
          value={summary.stopped}
          color="secondary"
          textColor={statusConfig[MachineStatus.Stopped].color}
          active={selectedStatus === MachineStatus.Stopped}
          onClick={() => setSelectedStatus(MachineStatus.Stopped)}
        />

        <SummaryCard
          label="Alarm"
          value={summary.alarm}
          color="danger"
          textColor={statusConfig[MachineStatus.Alarm].color}
          active={selectedStatus === MachineStatus.Alarm}
          onClick={() => setSelectedStatus(MachineStatus.Alarm)}
        />

        {/* <SummaryCard
          label="Maintenance"
          value={summary.maintenance}
          color="info"
          active={selectedStatus === MachineStatus.Maintenance}
          onClick={() => setSelectedStatus(MachineStatus.Maintenance)}
        /> */}

        <SummaryCard
          label="IDLE"
          value={summary.idle}
          color="secondary"
          textColor={statusConfig[MachineStatus.Idle].color}
          active={selectedStatus === MachineStatus.Idle}
          onClick={() => setSelectedStatus(MachineStatus.Idle)}
        />

        <SummaryCard
          label="Total"
          value={summary.total}
          color="dark"
          active={selectedStatus === null}
          onClick={() => setSelectedStatus(null)}
        />
      </div>

      {/* Danh sách máy */}
      <div className="card grow d-flex flex-column overflow-hidden dashboard-list">
        <div className="card-header d-flex justify-content-between align-items-center shrink-0">
          <strong>Trạng thái realtime</strong>
          <span>{now.format("DD/MM/YYYY HH:mm:ss")}</span>
        </div>

        <div className="card-body overflow-hidden dashboard-list-body">
          <div ref={machineGridRef} className="dashboard-machine-grid">
            <div className="dashboard-machine-grid-items">
              {machineRows.map((row, rowIndex) => (
                <div
                  className="dashboard-machine-row"
                  key={rowIndex}
                  style={{ height: machineLayout?.height ?? 0 }}
                >
                  {row.map((log) => (
                    <MachineCard
                      key={`${log.id}-${String(log.machineStatusChangeAt)}`}
                      machineLog={log}
                      width={machineLayout?.width ?? 0}
                      height={machineLayout?.height ?? 0}
                      onViewTodayPlan={(log) => {
                        setMachineLog(log);
                        setShowPlan(true);
                      }}
                      onViewMaintenanceSchedule={(log) => {
                        setMachineLog(log);
                        setShowMaintenanceSchedule(true);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DetailPlant
        open={showPlan}
        machineId={machineLog?.id || null}
        onClose={() => setShowPlan(false)}
      />
      {showMaintenanceSchedule && (
        <MaintenanceScheduleModal
          open={showMaintenanceSchedule}
          machine={machineLog}
          onClose={() => setShowMaintenanceSchedule(false)}
        />
      )}
    </div>
  );
}

function getMachineStatus(log: MachineLog): MachineStatus {
  if (log.hasScheduledMaintenance) {
    return MachineStatus.Maintenance;
  }

  return (log.machineStatus === MachineStatus.Stopped ||
    log.machineStatus === MachineStatus.Paused) &&
    log.idle
    ? MachineStatus.Idle
    : log.machineStatus;
}

function MachineCard({
  machineLog,
  width,
  height,
  onViewTodayPlan,
  onViewMaintenanceSchedule,
}: {
  machineLog: MachineLog;
  width: number;
  height: number;
  onViewTodayPlan: (log: MachineLog) => void;
  onViewMaintenanceSchedule: (log: MachineLog) => void;
}) {
  const machineStatus = getMachineStatus(machineLog);

  const cfg = statusConfig[machineStatus];

  const handleViewTodayPlan = (machine: MachineLog) => {
    onViewTodayPlan(machine);
  };

  return (
    <div
      className="dashboard-machine-tile"
      style={{
        width,
        height,
        border: `3px solid ${cfg?.color ?? "#94a3b8"}`,
      }}
    >
      <Card
        className="dashboard-machine-card"
        style={{ border: "none" }}
        styles={{
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <div className="dashboard-machine-content">
          <div
            className={`dashboard-machine-status ${
              machineLog.hasScheduledMaintenance
                ? "dashboard-machine-status-maintenance"
                : ""
            }`}
            style={{ backgroundColor: cfg?.color ?? "#f1f5f9" }}
          >
            {machineLog.hasScheduledMaintenance ? (
              <button
                type="button"
                className="dashboard-machine-status-label dashboard-machine-status-button"
                title="Xem lịch bảo dưỡng"
                onClick={() => onViewMaintenanceSchedule(machineLog)}
                style={{
                  backgroundColor: cfg?.color ?? "#334155",
                  color: cfg?.foreground ?? "#fff",
                }}
              >
                <i
                  className={`bi ${cfg?.icon ?? "bi-tools"} dashboard-maintenance-status-icon`}
                  aria-hidden="true"
                />
                <span className="dashboard-maintenance-status-text">
                  {cfg?.text ?? machineLog?.machineStatus ?? "-"}
                </span>
              </button>
            ) : (
              <div
                className="dashboard-machine-status-label"
                style={{
                  backgroundColor: cfg?.color ?? "#334155",
                  color: cfg?.foreground ?? "#fff",
                }}
              >
                <i className={`bi ${cfg?.icon ?? "bi-circle"} me-2`} />
                <span className="truncate">
                  {cfg?.text ?? machineLog?.machineStatus ?? "-"}
                </span>
              </div>
            )}
          </div>

          <div className="dashboard-machine-info">
            <Tooltip title={machineLog?.name}>
              <div className="dashboard-machine-name">
                {machineLog?.name ?? "-"}
              </div>
            </Tooltip>

            <div className="dashboard-machine-code">
              {machineLog?.code ?? "-"}
              {machineLog?.type ? ` · ${machineLog.type}` : ""}
            </div>
          </div>

          <div className="dashboard-machine-footer">
            <div className="dashboard-machine-part">
              <span className="dashboard-machine-part-label">
                Tên chi tiết:
              </span>
              <Tooltip
                title={`${machineLog?.part?.index?.code ?? "-"}-${machineLog?.part?.code ?? "-"}`}
              >
                <div className="dashboard-machine-part-code">
                  {machineLog?.part?.index?.code ?? "-"}-
                  {machineLog?.part?.code ?? "-"}
                </div>
              </Tooltip>
            </div>

            <Button
              type="primary"
              size="small"
              className="dashboard-machine-plan-button"
              title="Kế hoạch hôm nay"
              icon={<i className="bi bi-calendar3" />}
              onClick={() => handleViewTodayPlan(machineLog)}
            >
              Kế hoạch
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = "dark",
  textColor,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  textColor?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="col">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={`card border-${color} h-100 w-100 p-0 ${
          active ? "shadow border-3" : ""
        }`}
        style={{
          cursor: "pointer",
          backgroundColor: active
            ? `var(--bs-${color}-bg-subtle, #f0f0f0)`
            : "var(--bs-body-bg, #fff)",
          transition: "background-color 0.2s, box-shadow 0.2s",
        }}
      >
        <div className="card-body text-center w-100">
          <div
            className={textColor ? "fw-semibold" : `text-${color} fw-semibold`}
            style={textColor ? { color: textColor } : undefined}
          >
            {label}
          </div>

          <h2
            className={textColor ? "mb-0" : `text-${color} mb-0`}
            style={textColor ? { color: textColor } : undefined}
          >
            {value}
          </h2>
        </div>
      </button>
    </div>
  );
}
