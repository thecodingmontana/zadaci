import type { ColumnDef } from "@tanstack/vue-table";
import type { TeammatesWithProfile } from "~/types";
import { format } from "date-fns";
import { h } from "vue";
import { Checkbox } from "~/components/ui/checkbox";
import DataGridColumnHeader from "~/components/ui/data-grid/data-grid-column-header.vue";
import ActionsCell from "./action-cell.vue";
import Member from "./member.vue";
import Role from "./role.vue";

export const columns: ColumnDef<TeammatesWithProfile>[] = [
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
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Member", visibility: true }),
    cell: ({ row }) => h(Member, { row }),
    filterFn: (row, _, filterValue: string) => {
      const username = row.original.user?.username?.toLowerCase() ?? "";
      return username.includes(filterValue.toLowerCase());
    },
    size: 300,
    enableHiding: false,
    meta: { headerTitle: "Member" },
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
    id: "registered2FA",
    accessorFn: (row) => row.user?.registered2FA,
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "2FA Auth", visibility: true }),
    cell: ({ row }) => {
      const is2FA = row.original.user?.registered2FA;
      return h(
        "div",
        { class: is2FA ? "font-medium text-green-600" : "font-medium text-yellow-600" },
        is2FA ? "Enabled" : "Disabled",
      );
    },
    filterFn: (row, _, filterValue: string[]) => {
      const is2FA = row.getValue<boolean>("registered2FA");
      return filterValue.includes(is2FA ? "enabled" : "disabled");
    },
    size: 130,
    meta: { headerTitle: "2FA Auth" },
  },
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Joined Date", visibility: true }),
    cell: ({ row }) =>
      h(
        "div",
        { class: "font-medium text-muted-foreground" },
        format(row.original.createdAt, "PPP"),
      ),
    size: 160,
    meta: { headerTitle: "Joined Date" },
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
