export type RootStackParamList = {
  Dashboard: undefined;
  Profiles: undefined;
  CycleLog: { profileId: number };
  Summary: undefined;
  SetupPin: { mode: "set" | "change" | "remove" };
};
