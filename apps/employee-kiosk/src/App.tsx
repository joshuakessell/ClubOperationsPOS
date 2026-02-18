import { BrowserRouter as Router } from "react-router-dom";
import { AuthGateProvider } from "./context/AuthGateContext";
import CheckInPage from "./pages/CheckInPage";

/**
 * App always renders CheckInPage (→ AppRoot → NavigationRoot).
 * NavigationRoot handles auth state and conditionally shows
 * SignInPage vs the main content with sidebar/header.
 */
export default function App() {
  return (
    <AuthGateProvider>
      <Router>
        <CheckInPage />
      </Router>
    </AuthGateProvider>
  );
}
