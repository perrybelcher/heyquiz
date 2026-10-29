export type InterfaceVersion = "v1" | "v2";
export type InterfacePreference = InterfaceVersion | null;
export interface InterfaceView {
  preferredVersion: InterfacePreference;
  effectiveVersion: InterfaceVersion;
  eligible: boolean;
  revision: number;
}
