//#region src/agents.d.ts
type AgentAction = {
  tool: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput: string | Record<string, any>;
  log: string;
};
type AgentFinish = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  returnValues: Record<string, any>;
  log: string;
};
type AgentStep = {
  action: AgentAction;
  observation: string;
};
//#endregion
export { AgentAction, AgentFinish, AgentStep };
//# sourceMappingURL=agents.d.ts.map