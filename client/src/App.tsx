import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import BecomeTutor from "./pages/BecomeTutor";
import FindTutor from "./pages/FindTutor";
import TutorListing from "./pages/TutorListing";
import TutorDetail from "./pages/TutorDetail";
import Admin from "./pages/Admin";
import Rating from "./pages/Rating";
import Matching from "./pages/Matching";
import TutorDashboard from "./pages/TutorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Auth from "./pages/Auth";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

function Router() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to auth if trying to access protected routes without login
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (
      !isAuthenticated &&
      (currentPath === "/become-tutor" ||
        currentPath === "/find-tutor" ||
        currentPath === "/tutor-dashboard" ||
        currentPath === "/student-dashboard")
    ) {
      navigate("/auth");
    }
  }, [isAuthenticated]);

  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/become-tutor"} component={BecomeTutor} />
      <Route path={"/find-tutor"} component={FindTutor} />
      <Route path={"/tutors"} component={TutorListing} />
      <Route path={"/tutor/:id"} component={TutorDetail} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/rating"} component={Rating} />
      <Route path={"/matching"} component={Matching} />
      <Route path={"/tutor-dashboard"} component={TutorDashboard} />
      <Route path={"/student-dashboard"} component={StudentDashboard} />
      <Route path={"/auth"} component={Auth} />
      <Route path={"/login"} component={Auth} />
      <Route path={"/register"} component={Auth} />
      <Route path={"/dashboard"} component={() => <div>Dashboard Page</div>} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
