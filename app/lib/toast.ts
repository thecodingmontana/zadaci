import type { Component } from "vue";
import { reactive } from "vue";

export type ToastType = "success" | "error" | "info" | "pending";

export interface ToastAction {
  label: string;
  icon?: Component;
  onClick?: () => void;
}

export interface ToastInput {
  title: string;
  desc?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

export type ToastData = ToastInput & { id: number; type: ToastType; duration: number };

const state = reactive<{ list: ToastData[] }>({ list: [] });
let uid = 0;

function defaultDuration(type: ToastType) {
  return type === "pending" ? 0 : type === "error" ? 5200 : 4200;
}

function push(input: ToastInput): number {
  const id = ++uid;
  const type = input.type ?? "info";
  const duration = input.duration ?? defaultDuration(type);
  state.list = [{ ...input, id, type, duration }, ...state.list];
  return id;
}

function dismiss(id: number) {
  state.list = state.list.filter((t) => t.id !== id);
}

function update(id: number, patch: Partial<ToastInput>) {
  state.list = state.list.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...patch } as ToastData;
    if (patch.duration === undefined && patch.type && patch.type !== "pending") {
      next.duration = patch.type === "error" ? 5200 : 4200;
    }
    return next;
  });
}

export const toast = Object.assign((input: ToastInput) => push(input), {
  success: (title: string, o: Partial<ToastInput> = {}) => push({ ...o, title, type: "success" }),
  error: (title: string, o: Partial<ToastInput> = {}) => push({ ...o, title, type: "error" }),
  info: (title: string, o: Partial<ToastInput> = {}) => push({ ...o, title, type: "info" }),
  pending: (title: string, o: Partial<ToastInput> = {}) =>
    push({ ...o, title, type: "pending", duration: 0 }),
  dismiss,
  update,
  promise<Tn>(
    run: Promise<Tn>,
    msg: { loading: string; success: string | ((v: Tn) => string); error: string; desc?: string },
  ) {
    const id = push({ title: msg.loading, type: "pending", duration: 0 });
    run
      .then((v) =>
        update(id, {
          title: typeof msg.success === "function" ? msg.success(v) : msg.success,
          desc: msg.desc,
          type: "success",
        }),
      )
      .catch(() => update(id, { title: msg.error, type: "error" }));
    return id;
  },
});

// Vue's reactive() array is already a live, reactive reference — no
// useSyncExternalStore equivalent needed. Just read state.list in the component.
export function getToastState() {
  return state;
}
