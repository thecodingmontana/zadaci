export interface Project {
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  stack: TechStack[];
  github: string;
  color: string;
  website?: string;
  is_working: boolean;
  image_url: string;
}

export interface TechStack {
  name: string;
  icon: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  registeredTOTP: boolean;
  registeredPasskey: boolean;
  registered2FA: boolean;
  avatar: string;
  twoFactorVerified: boolean;
}

export type ModalType =
  | "joinWaitlist"
  | "setupAuthenticatorApp"
  | "setupPasskeys"
  | "setupSecurityKeys"
  | "signout"
  | "addNewProject"
  | "addNewTask"
  | "setupPassword"
  | "resetPassword"
  | "transferOwnership"
  | "deleteWorkspace"
  | "mobileSidebar"
  | "inviteTeammate"
  | "notificationCenter"
  | "changeTeammateRole"
  | "totpAuthentication"
  | "deleteAccount"
  | "editProject"
  | "editProjectTask"
  | "createWorkspace"
  | "deleteProject";

export interface ModalData {
  qrcode?: string;
  encodedTOTPKey?: string;
  encodedCredentialUserId?: string;
  user?: User;
  encodedCredentialIds?: string[];
  projectId?: string;
  project?: DBProject | null;
  members?: ProjectMembers[];
  teammates?: ChangeTeammateRole[];
}

export interface ModalStore {
  type: ModalType | null;
  isOpen: boolean;
  data: ModalData;
}

export interface WorkspaceBreadcrumb {
  name: string;
  path: string;
  children: WorkspaceBreadcrumb[] | null;
}

export interface IProject {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: Date | null;
  workspaceId: string;
}

export interface Workspace {
  id: string;
  name: string;
  imageUrl: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  userRole: UserRole;
}

export type UserRole = "OWNER" | "MEMBER" | "GUEST";

export interface WorkspaceStore {
  isOpenSidebar: boolean;
  breadcrumb: WorkspaceBreadcrumb | null;
  task: {
    project: IProject;
    data: Task;
  } | null;
  onboardingWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
}

export interface IProjectColumn {
  description: string;
  name: string;
  icon: string;
}

export const priorityOptions = [
  { name: "High", value: "HIGH", color: "#ef4444" },
  { name: "Medium", value: "MEDIUM", color: "#f59e0b" },
  { name: "Low", value: "LOW", color: "#10b981" },
  { name: "None", value: "NONE", color: "#9ca3af" },
];

export type Status = "IDEA" | "TODO" | "IN PROGRESS" | "IN REVIEW" | "COMPLETED" | "ABANDONED";
export type Priority = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface IDBProject {
  description: string | null;
  status: Status;
  priority: Priority;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  title: string;
  dueDate: Date | null;
  user: {
    avatar: string;
  };
}

export const validStatuses = ["IDEA", "TODO", "IN PROGRESS", "IN REVIEW", "COMPLETED", "ABANDONED"];
export const validPriorities = ["HIGH", "MEDIUM", "LOW", "NONE"];

export interface Task {
  name: string;
  status: Status;
  priority: Priority;
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  description: string | null;
  dueDate: Date | null | string;
  projectId: string;
  subtasks: Subtask[];
  assignees: ProjectMembers[];
}

export interface MyTask {
  name: string;
  status: Status;
  priority: Priority;
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  description: string | null;
  dueDate: Date | null | string;
  projectId: string;
  subtasks: Subtask[];
  assignees: ProjectMembers[];
  project: IProject;
}

export interface Subtask {
  name: string;
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  taskId: string;
  is_completed: boolean;
}

export const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface IOauth {
  isSigninWithOauth: boolean;
  provider: "google" | "github" | null;
}

export interface OauthStore {
  oauth: IOauth;
}

export type IAuthProvider = "google" | "github";

export interface Teammate {
  id: string;
  avatar: string;
  email: string;
  username: string;
}

export interface DBProject {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: Date | null;
  workspaceId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  members: ProjectMembers[];
}

export interface ProjectMembers {
  email: string;
  username: string;
  avatar: string | null;
  member_id: string;
}

export interface MFAPasskey {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  backedUp: boolean;
  transports: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TeammatesWithProfile {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
  workspaceId: string;
  role: UserRole;
  user: {
    id: string;
    email: string;
    username: string | null;
    emailVerified: boolean;
    registered2FA: boolean;
    profilePictureUrl: string | null;
  };
}

export interface ChangeTeammateRole {
  id: string;
  role: UserRole;
  username: string;
  avatar: string;
  email: string;
}

export interface WorkspaceInvite {
  status: string;
  workspaceId: string;
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string | null;
  expiresAt: string;
  role: UserRole;
  invitedBy: string;
  user: {
    id: string;
    email: string;
    username: string | null;
    profilePictureUrl: string | null;
  };
}

export const appLink = process.env.NUXT_PUBLIC_SITE_URL as string;

export interface DueItem {
  id: string;
  type: "project" | "task";
  title: string;
  dueDate: Date;
  assignee: string;
  avatar: string | null;
  priority: string | null;
  description: string | null;
  workspaceId: string;
  projectId: string;
}
