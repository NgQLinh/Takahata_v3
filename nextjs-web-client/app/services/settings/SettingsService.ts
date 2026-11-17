import { ReadMachineBitsResponse, Setting } from "@/app/types";
import { apiClient } from "../common/apiClient";

export const getSettingsAsync = async (): Promise<Setting> => {
  const response = await apiClient.post<Setting>("/Settings/query");
  return response.data;
};

export const updateSettingsAsync = async (
  request: unknown,
): Promise<boolean> => {
  const response = await apiClient.post<boolean>("/Settings/update", request);
  return response.data;
};

export interface TestPLCConnectionResponse {
  isConnected: boolean;
  message: string;
}

export const testPLCConnectionAsync = async (
  request: { ipAddress: string; port: number },
): Promise<TestPLCConnectionResponse> => {
  const response = await apiClient.post<TestPLCConnectionResponse>(
    "/Settings/test-connection",
    request,
  );
  return response.data;
};

export interface ClearPendingDailyCutoverResponse {
  machineId: number;
  reportDate: string;
}

export const clearPendingDailyCutoverAsync = async (
  machineId: number,
): Promise<ClearPendingDailyCutoverResponse> => {
  const response = await apiClient.post<ClearPendingDailyCutoverResponse>(
    "/Settings/clear-pending-daily-cutover",
    { machineId },
  );
  return response.data;
};

export interface ResetDailyCutoverStateResponse {
  resetCount: number;
  skippedCount: number;
  pendingMachineCount: number;
  pendingClearedCount: number;
}

export const resetDailyCutoverStateAsync =
  async (): Promise<ResetDailyCutoverStateResponse> => {
    const response = await apiClient.post<ResetDailyCutoverStateResponse>(
      "/Settings/reset-daily-cutover-state",
    );
    return response.data;
  };

export const writeMachineBitsAsync = async (
  request: unknown,
): Promise<boolean> => {
  const response = await apiClient.post<boolean>(
    "/Settings/write-machine-bits",
    request,
  );
  return response.data;
};

export const readMachineBitsAsync = async (
  request: unknown,
): Promise<ReadMachineBitsResponse> => {
  const response = await apiClient.post<ReadMachineBitsResponse>(
    "/Settings/read-machine-bits",
    request,
  );
  return response.data;
};
