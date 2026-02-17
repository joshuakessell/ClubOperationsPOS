import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import CheckInPage from "./pages/CheckInPage";
import CustomerSearchPage from "./pages/CustomerSearchPage";
import InventoryPage from "./pages/InventoryPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index path="/" element={<CheckInPage />} />
          <Route path="/search" element={<CustomerSearchPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
