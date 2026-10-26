/** Browser-safe profile DTO. Provider credentials and account IDs never appear here. */
export interface ProfileView {
  name: string;
  company: string;
  email: string;
  pendingEmail?: string;
  revision: number;
  local?: boolean;
}
export interface ProfilePasswordResult { ok: true; reauthRequired?: boolean }
export const PROFILE_NAME_MAX = 160;
export const PROFILE_COMPANY_MAX = 200;
