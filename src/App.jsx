import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WebSearch from "./pages/WebSearch";
import ContractSearch from "./pages/ContractSearch";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WebSearch />} />
        <Route path="/websearch" element={<WebSearch />} />
        <Route path="/contractsearch" element={<ContractSearch />} />
      </Routes>
    </Router>
  );
}

export default App;
