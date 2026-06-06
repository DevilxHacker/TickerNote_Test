import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <h1 className="mb-4 text-3xl font-bold text-center text-gray-800 sm:text-4xl">
        Welcome! To TickerNote
      </h1>
      <h4 className="mb-8 text-sm text-center text-gray-500">
        Continue with summarizer and wait a few minutes for the backend to respond
      </h4>

      <div className="flex justify-center w-full max-w-md">
        <button
          onClick={() => navigate("/summarizer")}
          className="w-full py-4 text-lg font-semibold text-white transition duration-300 bg-blue-500 shadow-md rounded-2xl hover:bg-blue-600"
        >
          Summarizer
        </button>
      </div>
    </div>
  );
}

export default Home;