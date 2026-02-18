export type RootStackParamList = {
  Profiles: undefined;
  CycleLog: { profileId: number };
  Summary: undefined;
  SetupPin: { mode: "set" | "change" | "remove" };
};
