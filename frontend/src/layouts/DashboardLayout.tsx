import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck2,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/api/types";
import coopVoteLogo from "@/assets/coop-vote-logo-cropped.png";

interface NavItem {
  label: string;
  path: string;
  roles: UserRole[];
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Ballot", path: "/elections/active", roles: ["voter"], icon: Vote },
  { label: "Dashboard", path: "/admin/dashboard", roles: ["super_admin", "election_admin"], icon: LayoutDashboard },
  { label: "Attendance", path: "/admin/attendance", roles: ["super_admin", "election_admin"], icon: CalendarCheck2 },
  { label: "Voters", path: "/admin/voters", roles: ["super_admin", "election_admin"], icon: Users },
  { label: "Ballot", path: "/admin/ballot", roles: ["super_admin", "election_admin"], icon: Vote },
  { label: "Settings", path: "/admin/settings", roles: ["super_admin", "election_admin"], icon: Settings },
];

function roleLabel(role: UserRole) {
  return role.replace("_", " ");
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  if (!user) {
    return null;
  }

  const homePath = user.role === "voter" ? "/elections/active" : "/admin/dashboard";
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  const exact = visibleNav.find((item) => item.path === location.pathname);
  const nested = visibleNav.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = exact?.label ?? nested?.label ?? "Dashboard";
  const isVotingOnlyRoute = /^\/voting\/\d+$/.test(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (isVotingOnlyRoute) {
    return (
      <div className="min-h-screen app-shell-bg">
        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto max-w-[1200px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell-bg">
      {mobileSidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[#11142d]/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[270px] border-r bg-card shadow-card transition-all duration-200 md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopSidebarCollapsed ? "md:w-[88px]" : "md:w-[270px]"}`}
      >
        <div className={`flex h-[70px] items-center border-b ${desktopSidebarCollapsed ? "justify-center px-2" : "justify-between px-6"}`}>
          <Link
            to={homePath}
            className={`inline-flex min-w-0 items-center gap-2 text-lg font-bold text-foreground ${
              desktopSidebarCollapsed ? "md:justify-center" : "flex-1"
            }`}
            onClick={() => setMobileSidebarOpen(false)}
            title="Coop Vote"
          >
            <img
              src={coopVoteLogo}
              alt=""
              aria-hidden="true"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className={`rounded bg-white/95 p-0.5 ${desktopSidebarCollapsed ? "h-7 w-7 object-cover object-left" : "h-9 w-auto shrink-0"}`}
            />
            <span className={`truncate whitespace-nowrap ${desktopSidebarCollapsed ? "md:hidden" : ""}`}>Coop Vote</span>
          </Link>
          <button
            aria-label="Close navigation"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100vh-70px)] flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className={`mb-3 px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground ${desktopSidebarCollapsed ? "md:hidden" : ""}`}>
              Menu
            </p>
            <nav className="space-y-1">
              {visibleNav.map((item, index) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileSidebarOpen(false)}
                    title={desktopSidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center rounded-[9px] px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-primary !text-primary-foreground shadow-sm hover:bg-primary/95 hover:!text-primary-foreground"
                          : "!text-foreground hover:bg-secondary hover:!text-primary"
                      } ${desktopSidebarCollapsed ? "md:justify-center md:px-2" : "justify-between"} ${index < 2 ? "animate-slide-in-left" : ""}`
                    }
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <span className={desktopSidebarCollapsed ? "md:hidden" : ""}>{item.label}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 ${desktopSidebarCollapsed ? "md:hidden" : ""}`} />
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="border-t p-4">
            <div className="rounded-lg bg-muted p-3">
              <p className={`truncate text-sm font-semibold ${desktopSidebarCollapsed ? "md:hidden" : ""}`}>{user.name}</p>
              <p className={`mt-0.5 text-xs text-muted-foreground ${desktopSidebarCollapsed ? "md:hidden" : ""}`}>
                {user.email ?? user.voter_id ?? "-"}
              </p>
              <div className={`mt-3 flex items-center ${desktopSidebarCollapsed ? "justify-center" : "justify-between"}`}>
                <Badge variant="secondary" className={`capitalize ${desktopSidebarCollapsed ? "hidden" : ""}`}>
                  {roleLabel(user.role)}
                </Badge>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ${desktopSidebarCollapsed ? "md:pl-[88px]" : "md:pl-[270px]"}`}>
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
          <div className="flex h-[70px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border bg-card text-foreground transition hover:bg-muted md:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                aria-label={desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                className="hidden h-9 w-9 items-center justify-center rounded-[9px] border bg-card text-foreground transition hover:bg-muted md:inline-flex"
                onClick={() => setDesktopSidebarCollapsed((current) => !current)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Coop Vote
                </p>
                <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <Badge variant="outline" className="capitalize text-muted-foreground">
                {roleLabel(user.role)}
              </Badge>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto max-w-[1400px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
