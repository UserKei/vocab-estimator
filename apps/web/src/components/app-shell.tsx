import { BookOpenCheck, Database, FileUp, FlaskConical, Users } from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"

const navItems = [
  { title: "词汇测试", href: "/test", icon: BookOpenCheck },
  { title: "批处理", href: "/batch", icon: FileUp },
  { title: "测试记录", href: "/students", icon: Users },
  { title: "实验输出", href: "/reports", icon: FlaskConical },
]

const pageTitles: Record<string, string> = {
  "/test": "词汇测试",
  "/batch": "批处理",
  "/students": "测试记录",
  "/reports": "实验输出",
}

export function AppShell() {
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? "词汇测试"

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg">
                <Link to="/test">
                  <Database />
                  <span className="font-semibold">vocab-estimator</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                      <NavLink to={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="min-h-[calc(100svh-3.5rem)] px-4 py-5 md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <Toaster richColors />
    </SidebarProvider>
  )
}
