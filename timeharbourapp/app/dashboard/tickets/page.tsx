"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Play,
  Square,
  Clock,
  Trash2,
  Check,
  Video,
  Users,
  RefreshCw,
  Share2,
  Search,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Card,
  CardContent,
  Text,
  SmallMuted,
} from "@mieweb/ui";
import { useRouter } from "next/navigation";
import { useClockIn } from "@/components/dashboard/ClockInContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { tickets as ticketsApi } from "@/TimeharborAPI";
import { Ticket as TicketType } from "@/TimeharborAPI/tickets";

type SourceTab = "All" | "Personal" | "From Timehuddle";

export default function TicketsPage() {
  const router = useRouter();
  const {
    isSessionActive,
    activeTicketId,
    toggleTicketTimer,
    getFormattedTotalTime,
    toggleSession,
  } = useClockIn();
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showClockInWarning, setShowClockInWarning] = useState(false);

  const [modalType, setModalType] = useState<"stop" | "switch">("stop");
  const [comment, setComment] = useState("");
  const [link, setLink] = useState("");
  const [pendingTicket, setPendingTicket] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedTicketForAction, setSelectedTicketForAction] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<SourceTab>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const fetched = await ticketsApi.getAllTickets();
      setAllTickets(fetched);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: SourceTab[] = ["All", "Personal", "From Timehuddle"];

  const statusFilters = ["All", "Open", "In Progress", "Done"];

  const applyFilters = (tickets: TicketType[]) => {
    let filtered = tickets;
    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (t) => t.status === statusFilter || (statusFilter === "Done" && t.status === "Closed"),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.teamName?.toLowerCase().includes(q),
      );
    }
    return filtered;
  };

  const personalTickets = applyFilters(
    allTickets.filter((t) => t.source !== "timehuddle"),
  );
  const timehuddleTickets = applyFilters(
    allTickets.filter((t) => t.source === "timehuddle"),
  );

  const displayTickets =
    activeTab === "All"
      ? applyFilters(allTickets)
      : activeTab === "Personal"
        ? personalTickets
        : timehuddleTickets;

  const handleTicketClick = (
    e: React.MouseEvent,
    ticketId: string,
    ticketTitle: string,
  ) => {
    e.stopPropagation();
    if (!isSessionActive) {
      setShowClockInWarning(true);
      return;
    }
    if (activeTicketId === ticketId) {
      setPendingTicket({ id: ticketId, title: ticketTitle });
      setModalType("stop");
      setComment("");
      setIsModalOpen(true);
    } else if (activeTicketId) {
      setPendingTicket({ id: ticketId, title: ticketTitle });
      setModalType("switch");
      setComment("");
      setIsModalOpen(true);
    } else {
      toggleTicketTimer(ticketId, ticketTitle);
    }
  };

  const handleConfirm = () => {
    if (!pendingTicket) return;
    toggleTicketTimer(
      pendingTicket.id,
      pendingTicket.title,
      undefined,
      comment,
      link || undefined,
    );
    setIsModalOpen(false);
    setPendingTicket(null);
    setComment("");
    setLink("");
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicketForAction) return;
    try {
      await ticketsApi.updatePersonalTicket(selectedTicketForAction.id, {
        status: newStatus as any,
      });
      setIsStatusModalOpen(false);
      setSelectedTicketForAction(null);
      loadTickets();
    } catch (error: any) {
      console.error("Failed to update status:", error);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicketForAction) return;
    try {
      await ticketsApi.deletePersonalTicket(selectedTicketForAction.id);
      setIsDeleteModalOpen(false);
      setSelectedTicketForAction(null);
      loadTickets();
    } catch (error: any) {
      console.error("Failed to delete ticket:", error);
    }
  };

  const handleShareToTimehuddle = async (ticketId: string) => {
    try {
      await ticketsApi.shareToTimehuddle(ticketId);
      loadTickets();
    } catch (error: any) {
      console.error("Failed to share:", error);
    }
  };

  const getStatusDisplay = (status: string) =>
    status === "Closed" ? "Done" : status;

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.floor(hrs / 24) + " days ago";
  };

  const TicketCard = ({
    ticket,
    borderColor,
  }: {
    ticket: TicketType;
    borderColor: string;
  }) => {
    const isTimehuddle = ticket.source === "timehuddle";
    const isPersonal = !isTimehuddle;
    const assignerName =
      ticket.creator?.full_name?.split(" ")[0] || "Someone";

    return (
      <Card
        className={
          "border-2 " +
          borderColor
        }
      >
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <Text className="text-lg font-bold leading-tight">
              {ticket.title}
            </Text>
          <Badge
            variant={
              ticket.status === "Open"
                ? "secondary"
                : ticket.status === "In Progress"
                  ? "warning"
                  : "success"
            }
            size="sm"
          >
            {getStatusDisplay(ticket.status)}
          </Badge>
        </div>

        <SmallMuted className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isTimehuddle ? (
            <>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {ticket.teamName}
              </span>
              <span>&middot;</span>
              <span>Assigned by {assignerName}</span>
              <span>&middot;</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                &#128100; Personal ticket
              </span>
              <span>&middot;</span>
            </>
          )}
          <span>{ticket.trackedTime || "0m"} tracked</span>
          {isTimehuddle && ticket.syncedWithTimehuddle && (
            <Badge variant="default" size="sm" icon={<RefreshCw className="w-3 h-3" />}>
              synced
            </Badge>
          )}
        </SmallMuted>

        {ticket.pulseVideo ? (
          <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                <Video className="w-4 h-4" />
              <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  Pulse Video
              </Text>
              </div>
              <SmallMuted>
                Recorded {formatRelativeTime(ticket.pulseVideo.recordedAt)}{" "}
                &middot; {ticket.pulseVideo.duration}
              </SmallMuted>
            </div>
            <a
              href={ticket.pulseVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground underline decoration-dashed underline-offset-2 hover:text-foreground shrink-0"
            >
              Open Vault &#8599;
            </a>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-dashed border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-transparent hover:bg-red-50 dark:hover:bg-red-950"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Record Pulse
          </Button>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
              variant={activeTicketId === ticket.id ? 'danger' : 'secondary'}
              size="sm"
              onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
              className="rounded-full"
          >
            {activeTicketId === ticket.id ? (
              <>
                <Square className="w-3 h-3 mr-1 fill-current" /> Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1 fill-current" /> Start
              </>
            )}
          </Button>

          {activeTicketId === ticket.id && (
            <SmallMuted className="flex items-center gap-1 font-mono text-primary-600 dark:text-primary-400">
              <Clock className="w-3 h-3" />
              {getFormattedTotalTime(ticket.id)}
            </SmallMuted>
          )}

          {isPersonal && !ticket.sharedToTimehuddle && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShareToTimehuddle(ticket.id)}
              className="rounded-full ml-auto"
            >
              <Share2 className="w-3 h-3 mr-1" /> Share to Timehuddle
            </Button>
          )}

          {isPersonal && ticket.sharedToTimehuddle && (
            <Badge
              variant="success"
              size="sm"
              icon={<Check className="w-3 h-3" />}
              className="ml-auto"
            >
              Shared
            </Badge>
          )}

          {isTimehuddle && (
            <Badge
              variant="warning"
              size="sm"
              icon={<Users className="w-3 h-3" />}
              className="ml-auto"
            >
              Timehuddle
            </Badge>
          )}
        </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Modal
        isOpen={showClockInWarning}
        onClose={() => setShowClockInWarning(false)}
        title="Clock In Required"
      >
        <div className="space-y-4">
          <SmallMuted>
            You must be clocked in to start a ticket timer.
          </SmallMuted>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowClockInWarning(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                toggleSession();
                setShowClockInWarning(false);
              }}
            >
              Clock In
            </Button>
          </div>
        </div>
      </Modal>

      <div className="space-y-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SourceTab)}
          variant="pills"
        >
          <TabsList className="w-full">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex-1">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search + Status Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((sf) => (
              <Badge
                key={sf}
                variant={statusFilter === sf ? "default" : "outline"}
                size="md"
                onClick={() => setStatusFilter(sf)}
                className={"cursor-pointer transition-all " + (statusFilter === sf ? "" : "hover:border-primary-400")}
              >
                {sf}
              </Badge>
            ))}
          </div>
        </div>

        {isLoading ? (
          <SmallMuted className="p-8 text-center block">
            Loading tickets...
          </SmallMuted>
        ) : (
          <div className="space-y-3">
            {(activeTab === "All" || activeTab === "Personal") &&
              personalTickets.length > 0 && (
                <div className="space-y-3">
                  {personalTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      borderColor="border-gray-200 dark:border-gray-700"
                    />
                  ))}
                </div>
              )}

            {activeTab === "All" && timehuddleTickets.length > 0 && (
              <div className="flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-amber-300 dark:bg-amber-700" />
                <span className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  <Users className="w-4 h-4" /> Timehuddle-Managed Teams
                </span>
                <div className="flex-1 h-px bg-amber-300 dark:bg-amber-700" />
              </div>
            )}

            {activeTab === "From Timehuddle" &&
              timehuddleTickets.length > 0 && (
                <SmallMuted className="text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Tickets entered here or in
                  Timehuddle stay in sync
                </SmallMuted>
              )}

            {(activeTab === "All" || activeTab === "From Timehuddle") &&
              timehuddleTickets.length > 0 && (
                <div className="space-y-3">
                  {timehuddleTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      borderColor="border-amber-400 dark:border-amber-700"
                    />
                  ))}
                </div>
              )}

            {displayTickets.length === 0 && (
              <div className="p-12 text-center">
                <Text className="text-lg font-medium mb-1">
                  {activeTab === "From Timehuddle"
                    ? "No Timehuddle tickets yet"
                    : "No tickets yet"}
                </Text>
                <SmallMuted>
                  {activeTab === "From Timehuddle"
                    ? "Tickets assigned to you from Timehuddle will appear here."
                    : "Create your first ticket to get started!"}
                </SmallMuted>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center pb-4">
          {activeTab === "From Timehuddle" ? (
            <Button
              onClick={() => window.open("https://timehuddle.com", "_blank")}
              className="px-8 py-3 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-colors shadow-lg text-base font-semibold"
            >
              <Users className="w-5 h-5 mr-2" /> Open Timehuddle
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/dashboard/tickets/create")}
              className="rounded-full px-8 py-3 shadow-lg text-base font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" /> New Personal Ticket
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setLink("");
        }}
        title={modalType === "stop" ? "Stop Working" : "Switch Ticket"}
      >
        <div className="space-y-4">
          <SmallMuted>
            {modalType === "stop"
              ? "Stop working on this ticket?"
              : "Switch to a different ticket?"}
          </SmallMuted>
          <div>
            <SmallMuted className="block text-sm font-medium mb-1">
              Work Description (Optional)
            </SmallMuted>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
            />
          </div>
          <div>
            <SmallMuted className="block text-sm font-medium mb-1">
              Link (optional)
            </SmallMuted>
            <Input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube or Pulse link..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
            >
              {modalType === "stop" ? "Stop Timer" : "Switch & Start"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Change Status"
      >
        <div className="space-y-4">
          <SmallMuted className="text-sm">
            Select a new status for{" "}
            <span className="font-semibold">
              {selectedTicketForAction?.title}
            </span>
            .
          </SmallMuted>
          <div className="space-y-2">
            {["Open", "In Progress", "Done"].map((status) => (
              <Button
                key={status}
                variant="ghost"
                onClick={() => handleStatusChange(status)}
                className={
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-all " +
                  (selectedTicketForAction &&
                  allTickets.find(
                    (t) => t.id === selectedTicketForAction.id,
                  )?.status === status
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-border hover:border-primary-500")
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "w-3 h-3 rounded-full " +
                      (status === "Open"
                        ? "bg-muted-foreground"
                        : status === "In Progress"
                          ? "bg-orange-500"
                          : "bg-green-500")
                    }
                  />
                  <span className="text-sm font-medium text-foreground">
                    {status}
                  </span>
                </div>
              </Button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              onClick={() => setIsStatusModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Ticket"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
            <Trash2 className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Are you sure you want to delete{" "}
              <span className="font-bold">
                {selectedTicketForAction?.title}
              </span>
              ?
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTicket}
              variant="danger"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
