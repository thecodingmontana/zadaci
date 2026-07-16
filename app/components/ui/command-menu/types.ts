export type CommandPresence = "online" | "busy" | "away";

export interface CommandPerson {
  kind: "person";
  id: string;
  name: string;
  role: string;
  avatar?: string;
  presence: CommandPresence;
}

export interface CommandProject {
  kind: "project";
  id: string;
  name: string;
  meta: string;
  gradient: [string, string];
  progress: number;
  shortcut: string;
}

export interface CommandAction {
  kind: "action";
  id: string;
  label: string;
  description?: string;
  glyph: string;
  shortcut: string;
  receipt: string;
}

export type CommandRow = CommandPerson | CommandProject | CommandAction;

export interface CommandGroup {
  title: string;
  rows: CommandRow[];
}
