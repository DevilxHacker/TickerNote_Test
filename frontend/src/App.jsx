import './App.css'
import { Routes, Route } from 'react-router-dom';
import Home from './Pages/Home';
import Screener from './Pages/Screener';
import Summarizer from './Pages/Summarizer';
function App() {
return (

  <Routes>
  <Route path="/" element={<Home />} />
  <Route path="/screener" element={<Screener />} /> 
  <Route path="/Summarizer" element={<Summarizer />} /> 
  </Routes>
)

}

export default App
