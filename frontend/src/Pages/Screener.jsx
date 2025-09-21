import { useState } from "react";

const API_BASE = "http://localhost:3000";

function Screener() {
  const [sentence, setSentence] = useState("");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

 const handleSubmit = async (e) => {
  e.preventDefault();
  console.log("Form submitted with sentence:", sentence);
  setLoading(true);

  try {
    console.log("Sending POST request to backend...");
    const res = await fetch(`${API_BASE}/screener/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: sentence }),
    });

    console.log("Response received:", res.status, res.statusText);

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    console.log("Data received from backend:", data);

    // FIX: Use 'tickers' instead of 'companies'
    setCompanies(data.tickers || []);
  } catch (err) {
    console.error("Error fetching companies:", err);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <h1 className="mb-6 text-3xl font-bold text-center text-gray-800 sm:text-4xl">
        Screener
      </h1>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-md gap-3 sm:flex-row"
      >
        <input
          type="text"
          placeholder="Enter your prompt..."
          value={sentence}
          onChange={(e) => {
            setSentence(e.target.value);
            console.log("Input changed:", e.target.value);
          }}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          className="px-6 py-3 font-semibold text-white transition duration-300 bg-blue-500 rounded-lg shadow-md hover:bg-blue-600"
        >
          {loading ? "Loading..." : "Submit"}
        </button>
      </form>

      {/* Results */}
      <div className="flex flex-col w-full max-w-md gap-3 mt-8">
        {companies.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-center text-gray-700">
              Companies Found
            </h2>
            {companies.map((company, idx) => (
              <button
                key={idx}
                className="w-full py-3 text-white transition duration-300 bg-green-500 rounded-lg shadow-md hover:bg-green-600"
              >
                {company}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default Screener;
