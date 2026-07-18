import type { ColumnDef } from "@tanstack/vue-table";
import type { WorkspaceInvite } from "~/types";
import { formatDistance, isPast } from "date-fns";
import { h } from "vue";
import { Checkbox } from "~/components/ui/checkbox";
import DataGridColumnHeader from "~/components/ui/data-grid/data-grid-column-header.vue";
import ActionsCell from "./action-cell.vue";
import Inviter from "./inviter.vue";
import Role from "./role.vue";

export const columns: ColumnDef<WorkspaceInvite>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate"),
        "onUpdate:modelValue": (value: boolean) => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: "Select all",
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean) => row.toggleSelected(!!value),
        ariaLabel: "Select row",
      }),
    enableSorting: false,
    enableHiding: false,
    size: 35,
  },
  {
    accessorKey: "user",
    id: "user",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Inviter", visibility: true }),
    cell: ({ row }) => h(Inviter, { row }),
    filterFn: (row, _, filterValue: string) => {
      const username = row.original.user?.username?.toLowerCase() ?? "";
      return username.includes(filterValue.toLowerCase());
    },
    size: 300,
    enableHiding: false,
    meta: { headerTitle: "Inviter" },
  },
  {
    accessorKey: "email",
    id: "email",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Invitee Email", visibility: true }),
    cell: ({ row }) => h("div", { class: "font-medium" }, row.getValue("email")),
    size: 250,
    meta: { headerTitle: "Invitee Email" },
  },
  {
    accessorKey: "role",
    id: "role",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Role", visibility: true }),
    cell: ({ row }) => h(Role, { row }),
    size: 120,
    meta: { headerTitle: "Role" },
  },
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Status", visibility: true }),
    cell: ({ row }) => {
      const status = row.original.status;
      return h(
        "div",
        {
          class: status === "PENDING" ? "font-medium text-yellow-600" : "font-medium text-rose-600",
        },
        status,
      );
    },
    size: 120,
    meta: { headerTitle: "Status" },
  },
  {
    accessorKey: "expiresAt",
    id: "expiresAt",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Invite Expiry", visibility: true }),
    cell: ({ row }) => {
      const expiresAt = row.original.expiresAt;

      const cleanTimestamp = expiresAt.replace(" EAT", "");
      const parsed = new Date(cleanTimestamp);

      const expiry = isPast(parsed)
        ? "expired"
        : formatDistance(parsed, new Date(), { addSuffix: true });

      return h("div", { class: "font-medium text-muted-foreground" }, expiry);
    },
    size: 160,
    meta: { headerTitle: "Invite Expiry" },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => h(ActionsCell, { row }),
    enableSorting: false,
    enableHiding: false,
    size: 60,
  },
];
