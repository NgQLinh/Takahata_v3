"use client";

import { searchMachineMaintenanceProcess } from "@/app/services/machine/MachineService";
import type { MachineLog } from "@/app/types/machine/MachineLog";
import type { MachineMaintenanceProcess } from "@/app/types/machine/MachineMaintenanceProcess";
import { getStatusTag } from "@/app/utilities/UtilityState";
import { Empty, Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

interface MaintenanceScheduleModalProps {
  open: boolean;
  machine: MachineLog | null;
  onClose: () => void;
}

export default function MaintenanceScheduleModal({
  open,
  machine,
  onClose,
}: MaintenanceScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<MachineMaintenanceProcess[]>([]);

  useEffect(() => {
    if (!open || !machine) {
      return;
    }

    let cancelled = false;

    const loadSchedules = async () => {
      setLoading(true);
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const response = await searchMachineMaintenanceProcess({
          machineIds: [machine.id],
          from: today,
          to: today,
          page: 1,
          pageSize: 100,
        });

        if (!cancelled) {
          setSchedules(response.data);
        }
      } catch (error) {
        console.error("Không thể tải lịch bảo dưỡng của máy:", error);
        toast.error("Không thể tải thông tin lịch bảo dưỡng.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [machine, open]);

  const columns = useMemo<ColumnsType<MachineMaintenanceProcess>>(
    () => [
      {
        title: "Ngày kế hoạch",
        dataIndex: "plantDate",
        width: 140,
        render: (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "-"),
      },
      {
        title: "Bắt đầu",
        dataIndex: "startTime",
        width: 160,
        render: (value) =>
          value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-",
      },
      {
        title: "Kết thúc",
        dataIndex: "endTime",
        width: 160,
        render: (value) =>
          value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-",
      },
      {
        title: "Dự kiến",
        dataIndex: "estimatedTime",
        width: 110,
        render: (value) => (value != null ? `${value} giờ` : "-"),
      },
      {
        title: "Người thực hiện",
        dataIndex: "performedBy",
        width: 160,
        render: (value) => value || "-",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 160,
        render: getStatusTag,
      },
      {
        title: "Ghi chú",
        dataIndex: "note",
        width: 220,
        render: (value) => value || "-",
      },
    ],
    [],
  );

  return (
    <Modal
      title={`Lịch bảo dưỡng - ${machine?.name ?? ""} (${machine?.code ?? ""})`}
      open={open}
      onCancel={onClose}
      width={1000}
      centered
      footer={null}
      destroyOnHidden
    >
      <Table<MachineMaintenanceProcess>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={schedules}
        locale={{
          emptyText: (
            <Empty description="Không có lịch bảo dưỡng trong ngày hôm nay" />
          ),
        }}
        scroll={{ x: "max-content" }}
        pagination={false}
      />
    </Modal>
  );
}
