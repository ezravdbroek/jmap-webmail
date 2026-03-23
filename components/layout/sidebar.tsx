"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Inbox,
  Send,
  File,
  Star,
  Trash2,
  Archive,
  PenSquare,
  Search,
  Menu,
  LogOut,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Users,
  User,
  Palmtree,
  SlidersHorizontal,
  Settings,
  X,
  Tag,
} from "lucide-react";
import { cn, buildMailboxTree, MailboxNode, formatFileSize } from "@/lib/utils";
import { Mailbox } from "@/lib/jmap/types";
import { useDragDropContext } from "@/contexts/drag-drop-context";
import { useMailboxDrop } from "@/hooks/use-mailbox-drop";
import { useEmailStore } from "@/stores/email-store";
import { useAuthStore } from "@/stores/auth-store";
import { activeFilterCount } from "@/lib/jmap/search-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useVacationStore } from "@/stores/vacation-store";
import { useResizeHandle } from "@/hooks/use-resize-handle";
import { toast } from "@/stores/toast-store";
import { debug } from "@/lib/debug";

interface SidebarProps {
  mailboxes: Mailbox[];
  selectedMailbox?: string;
  onMailboxSelect?: (mailboxId: string) => void;
  onCompose?: () => void;
  onLogout?: () => void;
  onSidebarClose?: () => void;
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  activeSearchQuery?: string;
  quota?: { used: number; total: number } | null;
  isPushConnected?: boolean;
  className?: string;
}

const getIconForMailbox = (role?: string, name?: string, hasChildren?: boolean, isExpanded?: boolean, isShared?: boolean, id?: string) => {
  const lowerName = name?.toLowerCase() || "";

  if (id === 'shared-folders-root') {
    return isExpanded ? FolderOpen : Users;
  }

  if (id?.startsWith('shared-account-')) {
    return isExpanded ? FolderOpen : User;
  }

  if (isShared && hasChildren && !id?.startsWith('shared-')) {
    return isExpanded ? FolderOpen : Folder;
  }

  if (hasChildren) {
    return isExpanded ? FolderOpen : Folder;
  }

  if (role === "inbox" || lowerName.includes("inbox")) return Inbox;
  if (role === "sent" || lowerName.includes("sent")) return Send;
  if (role === "drafts" || lowerName.includes("draft")) return File;
  if (role === "trash" || lowerName.includes("trash")) return Trash2;
  if (role === "archive" || lowerName.includes("archive")) return Archive;
  if (lowerName.includes("star") || lowerName.includes("flag")) return Star;
  return Inbox;
};

function MailboxTreeItem({
  node,
  selectedMailbox,
  expandedFolders,
  onMailboxSelect,
  onToggleExpand,
  onMailboxContextMenu,
  isCollapsed,
}: {
  node: MailboxNode;
  selectedMailbox: string;
  expandedFolders: Set<string>;
  onMailboxSelect?: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMailboxContextMenu?: (e: React.MouseEvent, mailbox: Mailbox) => void;
  isCollapsed: boolean;
}) {
  const t = useTranslations('sidebar');
  const tNotifications = useTranslations('notifications');
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedFolders.has(node.id);
  const Icon = getIconForMailbox(node.role, node.name, hasChildren, isExpanded, node.isShared, node.id);
  const indentPixels = node.depth * 16;
  const isVirtualNode = node.id.startsWith('shared-');

  const { isDragging: globalDragging } = useDragDropContext();
  const { dropHandlers, isValidDropTarget, isInvalidDropTarget } = useMailboxDrop({
    mailbox: node,
    onSuccess: (count, mailboxName) => {
      if (count === 1) {
        toast.success(
          tNotifications('email_moved'),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      } else {
        toast.success(
          tNotifications('emails_moved', { count }),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      }
    },
    onError: () => {
      toast.error(tNotifications('move_failed'), tNotifications('move_error'));
    },
  });

  return (
    <>
      <div
        {...(globalDragging ? dropHandlers : {})}
        onContextMenu={(e) => onMailboxContextMenu?.(e, node)}
        className={cn(
          "group w-full flex items-center px-2 py-1 lg:py-1 max-lg:py-3 max-lg:min-h-[44px] text-sm transition-all duration-200",
          isVirtualNode
            ? "text-muted-foreground"
            : selectedMailbox === node.id
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted text-foreground",
          node.depth === 0 && !isVirtualNode && "font-medium",
          isValidDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
          isInvalidDropTarget && "bg-destructive/10 ring-2 ring-destructive/30 ring-inset opacity-50"
        )}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={cn(
              "p-0.5 rounded mr-1 transition-all duration-200",
              "hover:bg-muted active:bg-accent"
            )}
            style={{ marginLeft: indentPixels }}
            title={isExpanded ? t('collapse_tooltip') : t('expand_tooltip')}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        )}

        <button
          onClick={() => !isVirtualNode && onMailboxSelect?.(node.id)}
          disabled={isVirtualNode}
          className={cn(
            "flex-1 flex items-center text-left py-1 lg:py-1 max-lg:py-2 px-1 rounded",
            "transition-colors duration-150",
            isVirtualNode && "cursor-default select-none"
          )}
          style={{
            paddingLeft: hasChildren ? '4px' : `${indentPixels + 24}px`
          }}
          title={isCollapsed ? node.name : undefined}
        >
          <Icon className={cn(
            "w-4 h-4 mr-2 flex-shrink-0 transition-colors",
            hasChildren && isExpanded && "text-primary",
            selectedMailbox === node.id && "text-accent-foreground",
            !hasChildren && node.depth > 0 && "text-muted-foreground",
            node.isShared && "text-blue-500"
          )} />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{node.name}</span>
              {node.unreadEmails > 0 && (
                <span className={cn(
                  "text-xs rounded-full px-2 py-0.5 ml-2 font-medium",
                  selectedMailbox === node.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground text-background"
                )}>
                  {node.unreadEmails}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {hasChildren && isExpanded && !isCollapsed && (
        <div className="relative">
          {node.children.map((child) => (
            <MailboxTreeItem
              key={child.id}
              node={child}
              selectedMailbox={selectedMailbox}
              expandedFolders={expandedFolders}
              onMailboxSelect={onMailboxSelect}
              onToggleExpand={onToggleExpand}
              onMailboxContextMenu={onMailboxContextMenu}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      )}
    </>
  );
}

function VacationBanner() {
  const t = useTranslations('sidebar');
  const router = useRouter();
  const { isEnabled, isSupported } = useVacationStore();

  if (!isSupported || !isEnabled) return null;

  return (
    <button
      onClick={() => router.push('/settings')}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-xs",
        "bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400",
        "hover:bg-amber-500/15 dark:hover:bg-amber-400/15 transition-colors"
      )}
    >
      <Palmtree className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate font-medium">{t("vacation_active")}</span>
      <Settings className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" />
    </button>
  );
}

function AdvancedSearchToggle() {
  const tSearch = useTranslations("advanced_search");
  const { searchFilters, isAdvancedSearchOpen, toggleAdvancedSearch } = useEmailStore();
  const filterCount = activeFilterCount(searchFilters);

  return (
    <button
      type="button"
      onClick={toggleAdvancedSearch}
      className={cn(
        "relative flex-shrink-0 p-2 rounded-md transition-colors",
        isAdvancedSearchOpen || filterCount > 0
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      title={tSearch("toggle_filters")}
    >
      <SlidersHorizontal className="w-4 h-4" />
      {filterCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
          {filterCount}
        </span>
      )}
    </button>
  );
}

const tagDotColors: Record<string, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

function TagsSection({
  isCollapsed,
  onSearch,
}: {
  isCollapsed: boolean;
  onSearch?: (query: string) => void;
}) {
  const t = useTranslations("sidebar");
  const { tagCounts } = useEmailStore();
  const [expanded, setExpanded] = useState(true);

  const tags = Object.entries(tagCounts);
  if (tags.length === 0 || isCollapsed) return null;

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted transition-colors"
      >
        <Tag className="w-3 h-3 mr-2" />
        <span className="flex-1 text-left">{t("tags.title")}</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
      {expanded && (
        <div className="py-1">
          {tags.map(([color, count]) => (
            <button
              key={color}
              onClick={() => onSearch?.(`keyword:$color:${color}`)}
              className="flex items-center w-full px-4 py-1.5 text-sm hover:bg-muted transition-colors text-foreground"
            >
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0",
                  tagDotColors[color] || "bg-gray-500"
                )}
              />
              <span className="flex-1 text-left capitalize">{color}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyFolderConfirmDialog({
  mailbox,
  onConfirm,
  onCancel,
}: {
  mailbox: { name: string; totalEmails: number };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("sidebar");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <div className="relative bg-background rounded-lg shadow-xl p-6 max-w-sm mx-4 border border-border">
        <h3 className="text-lg font-semibold mb-2">{t("empty_folder.title")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("empty_folder.confirm", {
            count: mailbox.totalEmails,
            folder: mailbox.name,
          })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            {t("empty_folder.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {t("empty_folder.title")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StorageQuota({ quota, isCollapsed }: { quota: { used: number; total: number } | null; isCollapsed: boolean }) {
  const t = useTranslations('sidebar');

  if (!quota || quota.total <= 0) return null;

  const usagePercent = Math.min((quota.used / quota.total) * 100, 100);
  const barColor = usagePercent > 90
    ? "bg-red-500 dark:bg-red-400"
    : usagePercent > 70
      ? "bg-amber-500 dark:bg-amber-400"
      : "bg-green-500 dark:bg-green-400";

  if (isCollapsed) {
    return (
      <div className="px-2 py-2" title={`${formatFileSize(quota.used)} / ${formatFileSize(quota.total)}`}>
        <div className="w-full bg-muted rounded-full h-1">
          <div className={cn(barColor, "h-1 rounded-full transition-all")} style={{ width: `${usagePercent}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t("storage")}</span>
        <span className="text-foreground tabular-nums">
          {formatFileSize(quota.used)} / {formatFileSize(quota.total)}
        </span>
      </div>
      <div className="mt-1 w-full bg-muted rounded-full h-1">
        <div className={cn(barColor, "h-1 rounded-full transition-all")} style={{ width: `${usagePercent}%` }} />
      </div>
    </div>
  );
}

export function Sidebar({
  mailboxes = [],
  selectedMailbox = "",
  onMailboxSelect,
  onCompose,
  onLogout,
  onSidebarClose,
  onSearch,
  onClearSearch,
  activeSearchQuery = "",
  quota,
  isPushConnected = false,
  className,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mailbox: Mailbox } | null>(null);
  const [emptyFolderTarget, setEmptyFolderTarget] = useState<Mailbox | null>(null);
  const t = useTranslations('sidebar');
  const { client } = useAuthStore();
  const { emptyFolder } = useEmailStore();
  const { sidebarWidth, updateSetting } = useSettingsStore();

  const handleSidebarResize = useCallback((width: number) => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  }, []);

  const handleSidebarResizeEnd = useCallback((width: number) => {
    updateSetting('sidebarWidth', width);
  }, [updateSetting]);

  const resizeHandle = useResizeHandle({
    min: 180,
    max: 400,
    initial: sidebarWidth,
    onResize: handleSidebarResize,
    onResizeEnd: handleSidebarResizeEnd,
  });

  useEffect(() => {
    setSearchQuery(activeSearchQuery);
  }, [activeSearchQuery]);

  useEffect(() => {
    const stored = localStorage.getItem('expandedMailboxes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpandedFolders(new Set(parsed));
      } catch (e) {
        debug.error('Failed to parse expanded mailboxes:', e);
      }
    } else {
      const tree = buildMailboxTree(mailboxes);
      const defaultExpanded = tree
        .filter(node => node.children.length > 0)
        .map(node => node.id);
      setExpandedFolders(new Set(defaultExpanded));
    }
  }, [mailboxes]);

  const handleToggleExpand = (mailboxId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(mailboxId)) {
        next.delete(mailboxId);
      } else {
        next.add(mailboxId);
      }
      try {
        localStorage.setItem('expandedMailboxes', JSON.stringify(Array.from(next)));
      } catch { /* storage full or unavailable */ }
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleMailboxContextMenu = useCallback((e: React.MouseEvent, mailbox: Mailbox) => {
    if (mailbox.role !== "trash" && mailbox.role !== "junk") return;
    if (!mailbox.totalEmails || mailbox.totalEmails <= 0) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, mailbox });
  }, []);

  const handleEmptyFolder = useCallback(async () => {
    if (!emptyFolderTarget || !client) return;
    const folderName = emptyFolderTarget.name;
    const totalCount = emptyFolderTarget.totalEmails || 0;
    const targetId = emptyFolderTarget.id;
    setEmptyFolderTarget(null);

    toast.info(t("empty_folder.title"), t("empty_folder.progress", { deleted: 0, total: totalCount }));

    try {
      await emptyFolder(client, targetId);
      toast.success(t("empty_folder.title"), t("empty_folder.success"));
    } catch (error) {
      const match = error instanceof Error && error.message.match(/Deleted (\d+) of (\d+)/);
      const deleted = match ? parseInt(match[1], 10) : 0;
      toast.error(t("empty_folder.title"), t("empty_folder.error", { deleted, total: totalCount, folder: folderName }));
    }
  }, [emptyFolderTarget, client, emptyFolder, t]);

  const mailboxTree = buildMailboxTree(mailboxes);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMailbox || isCollapsed) return;

      const findNode = (nodes: MailboxNode[]): MailboxNode | null => {
        for (const node of nodes) {
          if (node.id === selectedMailbox) return node;
          const found = findNode(node.children);
          if (found) return found;
        }
        return null;
      };

      const selectedNode = findNode(mailboxTree);
      if (!selectedNode) return;

      if (e.key === 'ArrowRight' && selectedNode.children.length > 0) {
        if (!expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      } else if (e.key === 'ArrowLeft' && selectedNode.children.length > 0) {
        if (expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMailbox, isCollapsed, expandedFolders, mailboxTree]);

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-r transition-all duration-300 overflow-hidden",
        "bg-secondary border-border",
        "max-lg:w-full",
        isCollapsed && "lg:w-16",
        className
      )}
      style={!isCollapsed ? { width: `var(--sidebar-width, ${sidebarWidth}px)` } : undefined}
    >
      {/* Brandways Logo */}
      <div className={cn(
        "flex items-center justify-center border-b border-border",
        isCollapsed ? "px-2 py-3" : "px-4 py-4"
      )}>
        {isCollapsed ? (
          <img
            src="/brandways-icon.svg"
            alt="Brandways"
            className="h-8 w-auto"
          />
        ) : (
          <picture>
            <source srcSet="/brandways-logo-dark.svg" media="(prefers-color-scheme: dark)" />
            <img
              src="/brandways-logo.svg"
              alt="Brandways"
              className="h-8 w-auto logo-themed"
            />
          </picture>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarClose}
          className="lg:hidden h-11 w-11 flex-shrink-0"
          aria-label={t("close")}
        >
          <X className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {!isCollapsed && (
          <Button onClick={onCompose} className="flex-1" title={t("compose_hint")}>
            <PenSquare className="w-4 h-4 mr-2" />
            {t("compose")}
          </Button>
        )}
      </div>

      {/* Vacation Banner */}
      {!isCollapsed && <VacationBanner />}

      {/* Search + Advanced Filter Toggle */}
      {!isCollapsed && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("search_placeholder_hint")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("pl-9", searchQuery && "pr-8")}
                data-search-input
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    onClearSearch?.();
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('clear_search')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
            <AdvancedSearchToggle />
          </div>
        </div>
      )}

      {/* Mailbox List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          {mailboxes.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              {!isCollapsed && t("loading_mailboxes")}
            </div>
          ) : (
            <>
              {mailboxTree.map((node) => (
                <MailboxTreeItem
                  key={node.id}
                  node={node}
                  selectedMailbox={selectedMailbox}
                  expandedFolders={expandedFolders}
                  onMailboxSelect={onMailboxSelect}
                  onToggleExpand={handleToggleExpand}
                  onMailboxContextMenu={handleMailboxContextMenu}
                  isCollapsed={isCollapsed}
                />
              ))}
            </>
          )}
        </div>

        {/* Tags Section */}
        <TagsSection isCollapsed={isCollapsed} onSearch={onSearch} />
      </div>

      {/* Mailbox Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setEmptyFolderTarget(contextMenu.mailbox);
                setContextMenu(null);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("empty_folder.title")}
            </button>
          </div>
        </>
      )}

      {/* Empty Folder Confirmation Dialog */}
      {emptyFolderTarget && (
        <EmptyFolderConfirmDialog
          mailbox={{
            name: emptyFolderTarget.name,
            totalEmails: emptyFolderTarget.totalEmails || 0,
          }}
          onConfirm={handleEmptyFolder}
          onCancel={() => setEmptyFolderTarget(null)}
        />
      )}

      {/* Footer: Storage Quota + Sign Out + Push Status */}
      <div className="border-t border-border">
        <StorageQuota quota={quota ?? null} isCollapsed={isCollapsed} />

        <div className={cn(
          "flex items-center border-t border-border",
          isCollapsed ? "justify-center py-2" : "justify-between px-3 py-2"
        )}>
          {onLogout && (
            <button
              onClick={onLogout}
              className={cn(
                "flex items-center gap-2 rounded-md transition-colors text-sm text-muted-foreground hover:text-foreground hover:bg-muted",
                isCollapsed ? "p-2" : "px-2 py-1.5"
              )}
              title={t("sign_out")}
            >
              <LogOut className="w-4 h-4" />
              {!isCollapsed && t("sign_out")}
            </button>
          )}

          {!isCollapsed && (
            <span
              className="relative group"
              title={isPushConnected ? t("push_connected") : t("push_disconnected")}
            >
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full transition-all duration-300",
                  isPushConnected ? "bg-green-500" : "bg-muted-foreground/40"
                )}
              />
              <span className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1",
                "bg-popover text-popover-foreground text-xs rounded shadow-lg",
                "whitespace-nowrap opacity-0 group-hover:opacity-100",
                "pointer-events-none transition-opacity duration-200 z-50"
              )}>
                {isPushConnected ? t("push_connected") : t("push_disconnected")}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hidden lg:block hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          onMouseDown={resizeHandle.handleMouseDown}
          onTouchStart={resizeHandle.handleTouchStart}
          onKeyDown={resizeHandle.handleKeyDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={180}
          aria-valuemax={400}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
        />
      )}
    </div>
  );
}
