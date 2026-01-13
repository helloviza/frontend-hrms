// apps/frontend/src/lib/workspaceApi.ts
import api from "./api";

export type WorkspaceMe = {
  customerId?: string; // MasterData Business _id
  workspaceId?: string; // if you use this naming anywhere
  name?: string;
  businessName?: string;
};

export async function getWorkspaceMe() {
  return api.get<WorkspaceMe>("/v1/workspace/me");
}
