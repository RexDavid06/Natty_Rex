import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MailCheck, Search, UserPlus, Users } from "lucide-react";
import { api } from "../../lib/api";
import type { Client, Paginated } from "../../lib/types";
import { PageHeader } from "../../components/layout/AppLayout";
import { Avatar, Badge, Button, Card, EmptyState, Input, Select, Skeleton } from "../../components/ui";
import { AddClientModal } from "../../components/trainer/AddClientModal";
import { formatDate, pluralize } from "../../lib/utils";

export function ClientsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", page, deferredSearch, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (deferredSearch) params.set("q", deferredSearch);
      if (status) params.set("status", status);
      return api.get<Paginated<Client>>(`/clients/?${params.toString()}`);
    },
  });

  const clients = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Client management"
        title="Clients"
        subtitle="Register, invite and keep every athlete's training on track."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add client
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or phone"
            className="pl-10"
          />
        </div>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="active">Active clients</option>
          <option value="inactive">Inactive</option>
          <option value="">All clients</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={search ? "No matching clients" : "No clients yet"}
            description={
              search
                ? "Try a different name, email or phone number."
                : "Add your first client. It takes a name and a phone number or email."
            }
            action={
              !search && (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Add your first client
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.client_id}
                to={`/trainer/clients/${client.client_id}`}
                className="surface surface-hover group block p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={client.full_name} src={client.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{client.full_name}</h3>
                        <p className="truncate text-[11px] text-white/35">{client.email || client.phone || "No contact"}</p>
                      </div>
                      <Badge tone={client.is_active_client ? "lime" : "neutral"}>
                        {client.is_active_client ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-white/40">
                      {client.fitness_goals || "No fitness goals added yet."}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
                      <span className="text-[10px] text-white/30">
                        {client.assigned_programs.length
                          ? pluralize(client.assigned_programs.length, "program")
                          : "No program"}
                      </span>
                      {!client.has_account ? (
                        <Badge tone={client.invitation ? "amber" : "neutral"}>
                          <MailCheck className="h-3 w-3" />
                          {client.invitation ? "Invite active" : "Not invited"}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-lime-400/70">Account active</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-white/20">Added {formatDate(client.created_at)}</p>
              </Link>
            ))}
          </div>
          {data && data.count > 25 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-white/30">
                {data.count} clients · page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
