import { HashRouter, Routes, Route } from "react-router-dom";
import { Library } from "./components/Library";
import { Mixer } from "./components/Mixer";
import { PlayerProvider } from "./store/player";
import "./styles/theme.css";
import "./styles/app.css";

export default function App() {
  return (
    <PlayerProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/song/:songId" element={<Mixer />} />
        </Routes>
      </HashRouter>
    </PlayerProvider>
  );
}
