import { HashRouter, Routes, Route } from "react-router-dom";
import { Library } from "./components/Library";
import { Mixer } from "./components/Mixer";
import "./styles/theme.css";
import "./styles/app.css";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/song/:songId" element={<Mixer />} />
      </Routes>
    </HashRouter>
  );
}
