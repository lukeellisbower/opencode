import "./index.css";
import { AuthStatus } from "./components/AuthStatus";
import { AiChat } from "./components/AiChat";
import { useState } from "react";

export function App() {
  const [error, setError] = useState<string | null>(null);

  const handleChatError = (errorMsg: string) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          OpenCode Dashboard
        </h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <AuthStatus />
          </div>
          <div>
            <AiChat onError={handleChatError} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
