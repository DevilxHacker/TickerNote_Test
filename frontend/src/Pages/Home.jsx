import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <h1 className="mb-8 text-3xl font-bold text-center text-gray-800 sm:text-4xl">
        Welcome! Choose an option
      </h1>

      <div className="grid w-full max-w-md gap-6 sm:grid-cols-2">
        <button
          onClick={() => navigate("/summarizer")}
          className="w-full py-4 text-lg font-semibold text-white transition duration-300 bg-blue-500 shadow-md rounded-2xl hover:bg-blue-600"
        >
          Summarizer
        </button>

        <button
          onClick={() => navigate("/screener")}
          className="w-full py-4 text-lg font-semibold text-white transition duration-300 bg-green-500 shadow-md rounded-2xl hover:bg-green-600"
        >
          Screener
        </button>
      </div>
    </div>
  );
}

export default Home;
